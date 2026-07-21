import { Router, Request, Response } from 'express';
import { Issuance, IssuanceItem, AmmoType, Bunker, Inventory, InventoryEntry } from '../db/mongo';
import upload from '../middleware/upload';

const router = Router({ mergeParams: true });

// Helper to build absolute image URL
const getImageUrl = (req: Request, imagePath: string | undefined): string | undefined => {
  if (!imagePath) return undefined;
  // Use BACKEND_URL if available, otherwise construct from request
  const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  return imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`;
};

// GET /api/bunkers/:id/issuances
router.get('/', async (req: Request, res: Response) => {
  try {
    const issuances = await Issuance.find({ bunker_id: req.params.id }).sort({ created_at: -1 }).lean();
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

    let linkedBunkerId: string | null = null;
    if (linked_bunker_id) {
      const linkedBunker = await Bunker.findById(linked_bunker_id);
      if (!linkedBunker) return res.status(404).json({ error: 'בונקר יעד לא נמצא' });
      if (linked_bunker_id === req.params.id) return res.status(400).json({ error: 'לא ניתן לקשור הנפקה לאותו בונקר' });
      linkedBunkerId = linked_bunker_id;
    }

    interface IssuanceItemInput {
      ammo_type_id: string;
      quantity: number;
    }
    let parsedItems: IssuanceItemInput[] = [];
    try {
      parsedItems = JSON.parse(items || '[]');
    } catch {
      return res.status(400).json({ error: 'פורמט items לא תקין' });
    }

    if (!parsedItems.length) return res.status(400).json({ error: 'חובה לכלול לפחות פריט אחד' });

    // Validate stock
    for (const item of parsedItems) {
      if (item.quantity <= 0) continue;
      const stock = await Inventory.findOne({
        bunker_id: req.params.id,
        ammo_type_id: item.ammo_type_id,
      });
      if ((stock?.quantity || 0) < item.quantity) {
        const ammo = await AmmoType.findById(item.ammo_type_id);
        return res.status(400).json({ error: `אין מספיק מלאי עבור "${ammo?.name || ''}"` });
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

      await IssuanceItem.create({
        issuance_id: issuance._id,
        ammo_type_id: item.ammo_type_id,
        quantity: item.quantity,
      });

      // Deduct from source bunker
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

      // Record entry
      await InventoryEntry.create({
        bunker_id: req.params.id,
        ammo_type_id: item.ammo_type_id,
        quantity_delta: -item.quantity,
        entry_type: 'issuance',
        notes: `הנפקה #${issuance._id}`,
        created_at: new Date(),
      });

      // If linked to another bunker, add inventory
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
