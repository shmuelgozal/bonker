import { Router, Request, Response } from 'express';
import { Issuance, IssuanceItem, AmmoType, Bunker, Inventory, InventoryEntry, SoldierBunkerRecord, InventoryBatch, InventorySerial } from '../db/mongo';
import upload from '../middleware/upload';

const router = Router({ mergeParams: true });

const normalizeBunkerType = (value: unknown): 'bunker' | 'vehicle_pillbox' | 'soldiers' => {
  if (value === 'soldiers') return 'soldiers';
  if (value === 'vehicle_pillbox') return 'vehicle_pillbox';
  return 'bunker';
};

// Helper to build absolute image URL
const getImageUrl = (req: Request, imagePath: string | undefined): string | undefined => {
  if (!imagePath) return undefined;
  // Use BACKEND_URL if available, otherwise construct from request
  const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  return imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`;
};

async function getSoldierBunkerAmmoBalance(bunkerId: string, ammoTypeId: string): Promise<number> {
  const agg = await SoldierBunkerRecord.aggregate([
    {
      $match: {
        bunker_id: bunkerId,
        ammo_type_id: ammoTypeId,
      }
    },
    { $group: { _id: null, total: { $sum: '$quantity' } } }
  ]);

  return Number(agg[0]?.total || 0);
}

async function getBatchStockBalance(bunkerId: string, ammoTypeId: string): Promise<number> {
  const agg = await InventoryBatch.aggregate([
    {
      $match: {
        bunker_id: bunkerId,
        ammo_type_id: ammoTypeId,
      }
    },
    { $group: { _id: null, total: { $sum: '$quantity' } } }
  ]);

  return Number(agg[0]?.total || 0);
}

async function getSerialStockBalance(bunkerId: string, ammoTypeId: string): Promise<number> {
  return InventorySerial.countDocuments({
    bunker_id: bunkerId,
    ammo_type_id: ammoTypeId,
    status: 'in_stock',
  });
}

async function deductFromSoldierBunkerStock(
  bunkerId: string,
  ammoTypeId: string,
  quantity: number,
  issueDate: string,
  issuanceId: string,
  notes?: string
): Promise<void> {
  let remaining = quantity;

  const grouped = await SoldierBunkerRecord.aggregate([
    {
      $match: {
        bunker_id: bunkerId,
        ammo_type_id: ammoTypeId,
      }
    },
    {
      $group: {
        _id: {
          soldier_name: '$soldier_name',
          soldier_id: '$soldier_id',
          unit_name: '$unit_name',
        },
        quantity: { $sum: '$quantity' },
        latest_created_at: { $max: '$created_at' },
      }
    },
    { $match: { quantity: { $gt: 0 } } },
    { $sort: { latest_created_at: 1 } },
  ]);

  for (const row of grouped as any[]) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(row.quantity || 0));
    if (take <= 0) continue;

    await SoldierBunkerRecord.create({
      bunker_id: bunkerId,
      issuance_id: issuanceId,
      movement_type: 'manual_remove',
      soldier_name: row._id.soldier_name,
      soldier_id: row._id.soldier_id || undefined,
      unit_name: row._id.unit_name || undefined,
      ammo_type_id: ammoTypeId,
      quantity: -take,
      issue_date: issueDate,
      notes: `גריעה עקב הנפקה #${issuanceId}${notes ? ` | ${notes}` : ''}`,
      created_at: new Date(),
    });

    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error('Insufficient soldier bunker stock for deduction');
  }
}

// GET /api/bunkers/:id/issuances
router.get('/', async (req: Request, res: Response) => {
  try {
    const view = req.query.view;
    const filter = view === 'linked_to'
      ? { linked_bunker_id: req.params.id }
      : { bunker_id: req.params.id };

    const issuances = await Issuance.find(filter).sort({ created_at: -1 }).lean();
    const result = await Promise.all(
      (issuances as any[]).map(async (iss) => {
        const itemCount = await IssuanceItem.countDocuments({ issuance_id: iss._id });
        const totalQty = (await IssuanceItem.aggregate([
          { $match: { issuance_id: iss._id } },
          { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]))[0]?.total || 0;

        return {
          id: iss._id,
          bunker_id: iss.bunker_id,
          linked_bunker_id: iss.linked_bunker_id,
          recipient_name: iss.recipient_name,
          recipient_id: iss.recipient_id,
          unit_name: iss.unit_name,
          issue_date: iss.issue_date,
          form_image_path: getImageUrl(req, iss.form_image_path),
          notes: iss.notes,
          created_at: iss.created_at,
          item_count: itemCount,
          total_qty: totalQty,
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Error fetching issuances:', error);
    res.status(500).json({ error: 'Failed to fetch issuances' });
  }
});

// POST /api/bunkers/:id/issuances
router.post('/', upload.single('form_image'), async (req: Request, res: Response) => {
  try {
    const {
      recipient_name,
      recipient_id,
      unit_name,
      issue_date,
      notes,
      items,
      linked_bunker_id
    } = req.body as {
      recipient_name?: string;
      recipient_id?: string;
      unit_name?: string;
      issue_date?: string;
      notes?: string;
      items: string;
      linked_bunker_id?: string;
    };

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const sourceBunkerType = normalizeBunkerType(bunker.bunker_type);

    let linkedBunkerId: string | null = null;
    let linkedBunkerType: 'bunker' | 'vehicle_pillbox' | 'soldiers' = 'bunker';
    if (linked_bunker_id) {
      const linkedBunker = await Bunker.findById(linked_bunker_id);
      if (!linkedBunker) return res.status(404).json({ error: 'בונקר יעד לא נמצא' });
      if (linked_bunker_id === req.params.id) return res.status(400).json({ error: 'לא ניתן לקשור הנפקה לאותו בונקר' });
      linkedBunkerId = linked_bunker_id;
      linkedBunkerType = normalizeBunkerType(linkedBunker.bunker_type);

      if (linkedBunkerType === 'soldiers' && !recipient_name?.trim()) {
        return res.status(400).json({ error: 'בהנפקה לבונקר חיילים חובה למלא שם חייל' });
      }
    }

    interface IssuanceItemInput {
      ammo_type_id: string;
      quantity: number;
      batch_details?: Array<{ batch_number: string; quantity: number }>;
      serial_numbers?: string[];
    }
    let parsedItems: IssuanceItemInput[] = [];
    try {
      parsedItems = JSON.parse(items || '[]');
    } catch {
      return res.status(400).json({ error: 'פורמט items לא תקין' });
    }

    if (!parsedItems.length) return res.status(400).json({ error: 'חובה לכלול לפחות פריט אחד' });

    // Validate stock and tracking-specific details
    for (const item of parsedItems) {
      if (item.quantity <= 0) continue;
      const ammoType = await AmmoType.findById(item.ammo_type_id);
      if (!ammoType) {
        return res.status(400).json({ error: 'סוג תחמושת לא נמצא' });
      }

      let sourceQty = 0;
      if (sourceBunkerType === 'soldiers') {
        if (ammoType.tracking_type === 'qty') {
          sourceQty = await getSoldierBunkerAmmoBalance(req.params.id, item.ammo_type_id);
        } else if (ammoType.tracking_type === 'batch') {
          sourceQty = await getBatchStockBalance(req.params.id, item.ammo_type_id);
        } else if (ammoType.tracking_type === 'serial') {
          sourceQty = await getSerialStockBalance(req.params.id, item.ammo_type_id);
        }
      } else {
        sourceQty = (await Inventory.findOne({
          bunker_id: req.params.id,
          ammo_type_id: item.ammo_type_id,
        }))?.quantity || 0;
      }

      if (sourceQty < item.quantity) {
        return res.status(400).json({ error: `אין מספיק מלאי עבור "${ammoType.name || ''}"` });
      }

      if (ammoType.tracking_type === 'batch') {
        const requestedBatches = (item.batch_details || [])
          .map((b) => ({ batch_number: (b.batch_number || '').trim(), quantity: Number(b.quantity || 0) }))
          .filter((b) => b.batch_number && b.quantity > 0);

        if (!requestedBatches.length) {
          return res.status(400).json({ error: `חובה לבחור סדרות עבור "${ammoType.name || ''}"` });
        }

        const requestedTotal = requestedBatches.reduce((sum, b) => sum + b.quantity, 0);
        if (requestedTotal !== item.quantity) {
          return res.status(400).json({ error: `כמות הסדרות אינה תואמת לפריט "${ammoType.name || ''}"` });
        }

        for (const batchRow of requestedBatches) {
          const sourceBatch = await InventoryBatch.findOne({
            bunker_id: req.params.id,
            ammo_type_id: item.ammo_type_id,
            batch_number: batchRow.batch_number,
          });

          if (!sourceBatch || sourceBatch.quantity < batchRow.quantity) {
            return res.status(400).json({ error: `אין מספיק כמות בסדרה ${batchRow.batch_number} עבור "${ammoType.name || ''}"` });
          }
        }
      }

      if (ammoType.tracking_type === 'serial') {
        const serialNumbers = Array.from(new Set((item.serial_numbers || []).map((s) => (s || '').trim()).filter(Boolean)));

        if (!serialNumbers.length) {
          return res.status(400).json({ error: `חובה לבחור מספרים סידוריים עבור "${ammoType.name || ''}"` });
        }

        if (serialNumbers.length !== item.quantity) {
          return res.status(400).json({ error: `מספר הסידוריים אינו תואם לכמות עבור "${ammoType.name || ''}"` });
        }

        const existingSerials = await InventorySerial.find({
          bunker_id: req.params.id,
          ammo_type_id: item.ammo_type_id,
          serial_number: { $in: serialNumbers },
          status: 'in_stock',
        }).lean();

        if (existingSerials.length !== serialNumbers.length) {
          return res.status(400).json({ error: `חלק מהמספרים הסידוריים אינם זמינים במלאי עבור "${ammoType.name || ''}"` });
        }
      }
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const issuance = await Issuance.create({
      bunker_id: req.params.id,
      linked_bunker_id: linkedBunkerId || undefined,
      recipient_name: recipient_name || undefined,
      recipient_id: recipient_id || undefined,
      unit_name: unit_name || undefined,
      issue_date: issue_date ? new Date(issue_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      form_image_path: imagePath || undefined,
      notes: notes || undefined,
      created_at: new Date(),
    });

    // Create issuance items and update inventory
    for (const item of parsedItems) {
      if (item.quantity <= 0) continue;

      const ammoType = await AmmoType.findById(item.ammo_type_id);
      if (!ammoType) {
        return res.status(400).json({ error: 'סוג תחמושת לא נמצא' });
      }

      const selectedBatches = (item.batch_details || [])
        .map((b) => ({ batch_number: (b.batch_number || '').trim(), quantity: Number(b.quantity || 0) }))
        .filter((b) => b.batch_number && b.quantity > 0);
      const selectedSerials = Array.from(new Set((item.serial_numbers || []).map((s) => (s || '').trim()).filter(Boolean)));

      const issuanceItem = await IssuanceItem.create({
        issuance_id: issuance._id,
        ammo_type_id: item.ammo_type_id,
        quantity: item.quantity,
      });

      // Deduct from source bunker
      if (sourceBunkerType === 'soldiers' && ammoType.tracking_type === 'qty') {
        await deductFromSoldierBunkerStock(
          req.params.id,
          item.ammo_type_id,
          item.quantity,
          issuance.issue_date,
          String(issuance._id),
          notes?.trim() || undefined
        );
      } else {
        const existing = await Inventory.findOne({
          bunker_id: req.params.id,
          ammo_type_id: item.ammo_type_id,
        });

        if (existing) {
          await Inventory.findByIdAndUpdate(existing._id, {
            quantity: Math.max(0, existing.quantity - item.quantity),
            updated_at: new Date(),
          });
        }
      }

      if (ammoType.tracking_type === 'batch') {
        for (const batchRow of selectedBatches) {
          const sourceBatch = await InventoryBatch.findOne({
            bunker_id: req.params.id,
            ammo_type_id: item.ammo_type_id,
            batch_number: batchRow.batch_number,
          });

          if (sourceBatch) {
            const nextQty = Math.max(0, sourceBatch.quantity - batchRow.quantity);
            if (nextQty === 0) {
              await InventoryBatch.findByIdAndDelete(sourceBatch._id);
            } else {
              await InventoryBatch.findByIdAndUpdate(sourceBatch._id, { quantity: nextQty });
            }
          }
        }
      }

      if (ammoType.tracking_type === 'serial') {
        if (linkedBunkerId) {
          for (const serial of selectedSerials) {
            await InventorySerial.findOneAndUpdate(
              {
                bunker_id: req.params.id,
                ammo_type_id: item.ammo_type_id,
                serial_number: serial,
                status: 'in_stock',
              },
              {
                bunker_id: linkedBunkerId,
                status: 'in_stock',
                issuance_id: issuance._id,
              }
            );
          }
        } else {
          await InventorySerial.updateMany(
            {
              bunker_id: req.params.id,
              ammo_type_id: item.ammo_type_id,
              serial_number: { $in: selectedSerials },
              status: 'in_stock',
            },
            {
              status: 'issued',
              issuance_id: issuance._id,
            }
          );
        }
      }

      // Record entry
      await InventoryEntry.create({
        bunker_id: req.params.id,
        ammo_type_id: item.ammo_type_id,
        quantity_delta: -item.quantity,
        entry_type: 'issuance',
        notes: `הנפקה #${issuance._id}`,
        created_at: new Date(),
      });

      // If linked to another bunker, either add inventory or create soldier records
      if (linkedBunkerId) {
        const destExisting = await Inventory.findOne({
          bunker_id: linkedBunkerId,
          ammo_type_id: item.ammo_type_id,
        });

        if (destExisting) {
          await Inventory.findByIdAndUpdate(destExisting._id, {
            quantity: destExisting.quantity + item.quantity,
            updated_at: new Date(),
          });
        } else {
          await Inventory.create({
            bunker_id: linkedBunkerId,
            ammo_type_id: item.ammo_type_id,
            quantity: item.quantity,
            updated_at: new Date(),
          });
        }

        if (ammoType.tracking_type === 'batch') {
          for (const batchRow of selectedBatches) {
            const destBatch = await InventoryBatch.findOne({
              bunker_id: linkedBunkerId,
              ammo_type_id: item.ammo_type_id,
              batch_number: batchRow.batch_number,
            });

            if (destBatch) {
              await InventoryBatch.findByIdAndUpdate(destBatch._id, {
                quantity: destBatch.quantity + batchRow.quantity,
              });
            } else {
              await InventoryBatch.create({
                bunker_id: linkedBunkerId,
                ammo_type_id: item.ammo_type_id,
                batch_number: batchRow.batch_number,
                quantity: batchRow.quantity,
                created_at: new Date(),
              });
            }
          }
        }

        if (linkedBunkerType === 'soldiers') {
          await SoldierBunkerRecord.create({
            bunker_id: linkedBunkerId,
            issuance_id: issuance._id,
            issuance_item_id: issuanceItem._id,
            movement_type: 'issuance',
            soldier_name: recipient_name?.trim(),
            soldier_id: recipient_id?.trim() || undefined,
            unit_name: unit_name?.trim() || undefined,
            ammo_type_id: item.ammo_type_id,
            quantity: item.quantity,
            issue_date: issuance.issue_date,
            notes: notes?.trim() || undefined,
            created_at: new Date(),
          });
        }

        await InventoryEntry.create({
          bunker_id: linkedBunkerId,
          ammo_type_id: item.ammo_type_id,
          quantity_delta: item.quantity,
          entry_type: 'inter_bunker_transfer',
          notes: `קבלה מהנפקה #${issuance._id}`,
          created_at: new Date(),
        });
      }
    }

    res.status(201).json({
      id: issuance._id,
      bunker_id: issuance.bunker_id,
      recipient_name: issuance.recipient_name,
      created_at: issuance.created_at,
    });
  } catch (error) {
    console.error('Error creating issuance:', error);
    res.status(500).json({ error: 'Failed to create issuance' });
  }
});

// GET /api/bunkers/:id/issuances/:issuanceId
router.get('/:issuanceId', async (req: Request, res: Response) => {
  try {
    const issuance = await Issuance.findOne({
      _id: req.params.issuanceId,
      bunker_id: req.params.id,
    }).lean();

    if (!issuance) return res.status(404).json({ error: 'הנפקה לא נמצאה' });

    const items = await IssuanceItem.find({ issuance_id: req.params.issuanceId }).lean();
    const itemsWithAmmo = await Promise.all(
      (items as any[]).map(async (i) => {
        const ammo = await AmmoType.findById(i.ammo_type_id).lean();
        return {
          id: i._id,
          issuance_id: i.issuance_id,
          ammo_type_id: i.ammo_type_id,
          quantity: i.quantity,
          ammo_name: ammo?.name,
          unit: ammo?.unit,
          category: ammo?.category,
          tracking_type: ammo?.tracking_type,
        };
      })
    );

    res.json({
      id: issuance._id,
      bunker_id: issuance.bunker_id,
      linked_bunker_id: issuance.linked_bunker_id,
      recipient_name: issuance.recipient_name,
      recipient_id: issuance.recipient_id,
      unit_name: issuance.unit_name,
      issue_date: issuance.issue_date,
      form_image_path: getImageUrl(req, issuance.form_image_path),
      notes: issuance.notes,
      created_at: issuance.created_at,
      items: itemsWithAmmo.sort((a, b) => {
        if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
        return (a.ammo_name || '').localeCompare(b.ammo_name || '');
      }),
    });
  } catch (error) {
    console.error('Error fetching issuance:', error);
    res.status(500).json({ error: 'Failed to fetch issuance' });
  }
});

// PUT /api/bunkers/:id/issuances/:issuanceId
router.put('/:issuanceId', upload.single('form_image'), async (req: Request, res: Response) => {
  try {
    const { recipient_name, recipient_id, unit_name, issue_date, notes } = req.body as {
      recipient_name?: string;
      recipient_id?: string;
      unit_name?: string;
      issue_date?: string;
      notes?: string;
    };

    const issuance = await Issuance.findOne({
      _id: req.params.issuanceId,
      bunker_id: req.params.id,
    });

    if (!issuance) return res.status(404).json({ error: 'הנפקה לא נמצאה' });

    const imagePath = req.file ? `/uploads/${req.file.filename}` : (issuance.form_image_path || undefined);

    const updated = await Issuance.findByIdAndUpdate(req.params.issuanceId, {
      recipient_name: recipient_name !== undefined ? recipient_name : issuance.recipient_name,
      recipient_id: recipient_id !== undefined ? recipient_id : issuance.recipient_id,
      unit_name: unit_name !== undefined ? unit_name : issuance.unit_name,
      issue_date: issue_date ? new Date(issue_date).toISOString().split('T')[0] : issuance.issue_date,
      notes: notes !== undefined ? notes : issuance.notes,
      form_image_path: imagePath,
    }, { new: true }).lean();

    res.json({
      ...(updated as any),
      form_image_path: getImageUrl(req, updated?.form_image_path),
    });
  } catch (error) {
    console.error('Error updating issuance:', error);
    res.status(500).json({ error: 'Failed to update issuance' });
  }
});

export default router;
