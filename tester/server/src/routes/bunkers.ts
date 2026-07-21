import { Router, Response } from 'express';
import { Bunker, Unit, Inventory, User, SoldierBunkerRecord, AmmoType, Issuance } from '../db/mongo';
import { AuthenticatedRequest } from '../middleware/auth';
import { getAccessibleUnits } from '../middleware/authorization';

const router = Router();

type BunkerType = 'bunker' | 'vehicle_pillbox' | 'soldiers';

const normalizeBunkerType = (value: unknown): BunkerType => {
  if (value === 'soldiers') return 'soldiers';
  if (value === 'vehicle_pillbox') return 'vehicle_pillbox';
  return 'bunker';
};

// GET /api/bunkers - Get bunkers filtered by user permissions
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let bunkers: any[];
    if (user.role === 'admin') {
      // Admin can see all bunkers
      bunkers = await Bunker.find().sort({ created_at: -1 }).lean();
    } else {
      // User can only see bunkers in their accessible units
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      bunkers = await Bunker.find({
        $or: [
          { unit_id: { $in: accessibleUnitIds } },
          { unit_id: null } // Include bunkers not assigned to any unit
        ]
      }).sort({ created_at: -1 }).lean();
    }

    const result = await Promise.all(
      bunkers.map(async (b: any) => {
        const bunkerType = normalizeBunkerType(b.bunker_type);
        const unit = b.unit_id ? await Unit.findById(b.unit_id).lean() : null;

        const stockedTypes = bunkerType === 'soldiers'
          ? (await SoldierBunkerRecord.distinct('ammo_type_id', { bunker_id: b._id })).length
          : await Inventory.countDocuments({
              bunker_id: b._id,
              quantity: { $gt: 0 }
            });

        const issuanceCount = bunkerType === 'soldiers'
          ? await Issuance.countDocuments({ linked_bunker_id: b._id })
          : await Issuance.countDocuments({ bunker_id: b._id });

        return {
          id: b._id,
          name: b.name,
          bunker_type: bunkerType,
          location: b.location,
          description: b.description,
          unit_id: b.unit_id,
          unit_name: unit?.name,
          unit_type: unit?.type,
          stocked_types: stockedTypes,
          issuance_count: issuanceCount,
          created_at: b.created_at,
        };
      })
    );
    res.json(result);
  } catch (error) {
    console.error('Failed to fetch bunkers:', error);
    res.status(500).json({ error: 'Failed to fetch bunkers' });
  }
});

// POST /api/bunkers - Create bunker (admin only or in accessible units)
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, location, description, unit_id, bunker_type } = req.body as {
      name: string;
      location?: string;
      description?: string;
      unit_id?: string | null;
      bunker_type?: 'bunker' | 'vehicle_pillbox' | 'soldiers' | 'regular';
    };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'שם הבונקר הוא שדה חובה' });
    }

    // Non-admin users can only create bunkers in their accessible units
    if (user.role !== 'admin' && unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this unit' });
      }
    }

    const bunker = await Bunker.create({
      name: name.trim(),
      bunker_type: normalizeBunkerType(bunker_type),
      location: location?.trim() || undefined,
      description: description?.trim() || undefined,
      unit_id: unit_id || undefined,
      created_at: new Date(),
    });
    res.status(201).json({
      id: bunker._id,
      name: bunker.name,
      bunker_type: normalizeBunkerType(bunker.bunker_type),
      location: bunker.location,
      description: bunker.description,
      unit_id: bunker.unit_id,
      created_at: bunker.created_at,
    });
  } catch (error) {
    console.error('Failed to create bunker:', error);
    res.status(500).json({ error: 'Failed to create bunker' });
  }
});

// GET /api/bunkers/:id - Get bunker with permission check
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bunker = await Bunker.findById(req.params.id).lean();
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });
    
    // Check permissions for non-admin users
    const user = await User.findById(req.user.id);
    if (user?.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }
    
    const unit = bunker.unit_id ? await Unit.findById(bunker.unit_id).lean() : null;
    res.json({
      id: bunker._id,
      name: bunker.name,
      bunker_type: normalizeBunkerType(bunker.bunker_type),
      location: bunker.location,
      description: bunker.description,
      unit_id: bunker.unit_id,
      unit_name: unit?.name,
      unit_type: unit?.type,
      created_at: bunker.created_at,
    });
  } catch (error) {
    console.error('Failed to fetch bunker:', error);
    res.status(500).json({ error: 'Failed to fetch bunker' });
  }
});

// PUT /api/bunkers/:id/link-unit - Link or unlink a bunker to/from a unit
router.put('/:id/link-unit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { unit_id } = req.body as { unit_id: string | null };
    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    // Check permissions for non-admin users
    if (user.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    if (unit_id !== null && unit_id !== undefined) {
      const unit = await Unit.findById(unit_id);
      if (!unit) return res.status(404).json({ error: 'יחידה לא נמצאה' });

      // Check if user can assign to this unit
      if (user.role !== 'admin') {
        const accessibleUnitIds = await getAccessibleUnits(req.user.id);
        const canAccess = accessibleUnitIds.some(id => String(id) === String(unit_id));
        if (!canAccess) {
          return res.status(403).json({ error: 'Access denied to this unit' });
        }
      }
    }

    const updated = await Bunker.findByIdAndUpdate(req.params.id, { unit_id: unit_id || undefined }, { new: true }).lean();
    const unit = updated?.unit_id ? await Unit.findById(updated.unit_id).lean() : null;
    res.json({
      id: updated?._id,
      name: updated?.name,
      bunker_type: normalizeBunkerType(updated?.bunker_type),
      location: updated?.location,
      description: updated?.description,
      unit_id: updated?.unit_id,
      unit_name: unit?.name,
      unit_type: unit?.type,
      created_at: updated?.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to link unit' });
  }
});

// PUT /api/bunkers/:id - Update bunker details
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, location, description, bunker_type } = req.body as {
      name: string;
      location?: string;
      description?: string;
      bunker_type?: 'bunker' | 'vehicle_pillbox' | 'soldiers' | 'regular';
    };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'שם הבונקר הוא שדה חובה' });
    }
    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    // Check permissions for non-admin users
    if (user.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    const updated = await Bunker.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      bunker_type: normalizeBunkerType(bunker_type),
      location: location?.trim() || undefined,
      description: description?.trim() || undefined,
    }, { new: true }).lean();

    const unit = updated?.unit_id ? await Unit.findById(updated.unit_id).lean() : null;
    res.json({
      id: updated?._id,
      name: updated?.name,
      bunker_type: normalizeBunkerType(updated?.bunker_type),
      location: updated?.location,
      description: updated?.description,
      unit_id: updated?.unit_id,
      unit_name: unit?.name,
      unit_type: unit?.type,
      created_at: updated?.created_at,
    });
  } catch (error) {
    console.error('Failed to update bunker:', error);
    res.status(500).json({ error: 'Failed to update bunker' });
  }
});

// GET /api/bunkers/:id/soldier-records - List soldier->ammo records for soldier bunkers
router.get('/:id/soldier-records', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bunker = await Bunker.findById(req.params.id).lean();
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const user = await User.findById(req.user.id);
    if (user?.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    if (normalizeBunkerType(bunker.bunker_type) !== 'soldiers') {
      return res.status(400).json({ error: 'נתיב זה זמין רק לבונקר מסוג חיילים' });
    }

    const groupedRecords = await SoldierBunkerRecord.aggregate([
      { $match: { bunker_id: bunker._id } },
      {
        $group: {
          _id: {
            soldier_name: '$soldier_name',
            soldier_id: '$soldier_id',
            unit_name: '$unit_name',
            ammo_type_id: '$ammo_type_id',
          },
          quantity: { $sum: '$quantity' },
          latest_issue_date: { $max: '$issue_date' },
          latest_created_at: { $max: '$created_at' },
        }
      },
      { $match: { quantity: { $gt: 0 } } },
      { $sort: { '_id.soldier_name': 1, latest_created_at: -1 } },
    ]);

    const result = await Promise.all((groupedRecords as any[]).map(async (r) => {
      const ammoTypeId = String(r._id.ammo_type_id);
      const ammo = await AmmoType.findById(ammoTypeId).lean();
      return {
        id: `${r._id.soldier_name}::${ammoTypeId}::${r._id.soldier_id || ''}`,
        bunker_id: bunker._id,
        soldier_name: r._id.soldier_name,
        soldier_id: r._id.soldier_id,
        unit_name: r._id.unit_name,
        ammo_type_id: ammoTypeId,
        ammo_name: ammo?.name,
        ammo_unit: ammo?.unit,
        ammo_category: ammo?.category,
        quantity: r.quantity,
        issue_date: r.latest_issue_date,
        notes: null,
        created_at: r.latest_created_at,
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('Failed to fetch soldier bunker records:', error);
    res.status(500).json({ error: 'Failed to fetch soldier bunker records' });
  }
});

// GET /api/bunkers/:id/soldier-records/history - Movement history for soldier bunkers
router.get('/:id/soldier-records/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bunker = await Bunker.findById(req.params.id).lean();
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const user = await User.findById(req.user.id);
    if (user?.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    if (normalizeBunkerType(bunker.bunker_type) !== 'soldiers') {
      return res.status(400).json({ error: 'נתיב זה זמין רק לבונקר מסוג חיילים' });
    }

    const records = await SoldierBunkerRecord.find({ bunker_id: bunker._id }).sort({ created_at: -1 }).lean();
    const result = await Promise.all((records as any[]).map(async (r) => {
      const ammo = await AmmoType.findById(r.ammo_type_id).lean();
      return {
        id: r._id,
        bunker_id: r.bunker_id,
        issuance_id: r.issuance_id,
        issuance_item_id: r.issuance_item_id,
        movement_type: r.movement_type || 'issuance',
        soldier_name: r.soldier_name,
        soldier_id: r.soldier_id,
        unit_name: r.unit_name,
        ammo_type_id: r.ammo_type_id,
        ammo_name: ammo?.name,
        ammo_unit: ammo?.unit,
        ammo_category: ammo?.category,
        quantity: r.quantity,
        issue_date: r.issue_date,
        notes: r.notes,
        created_at: r.created_at,
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('Failed to fetch soldier bunker movement history:', error);
    res.status(500).json({ error: 'Failed to fetch soldier bunker movement history' });
  }
});

// POST /api/bunkers/:id/soldier-records/movements - Manual add/remove for soldier bunker
router.post('/:id/soldier-records/movements', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const user = await User.findById(req.user.id);
    if (user?.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    if (normalizeBunkerType(bunker.bunker_type) !== 'soldiers') {
      return res.status(400).json({ error: 'נתיב זה זמין רק לבונקר מסוג חיילים' });
    }

    const {
      soldier_name,
      soldier_id,
      unit_name,
      ammo_type_id,
      quantity,
      action,
      notes,
      move_date,
    } = req.body as {
      soldier_name?: string;
      soldier_id?: string;
      unit_name?: string;
      ammo_type_id?: string;
      quantity?: number;
      action?: 'add' | 'remove';
      notes?: string;
      move_date?: string;
    };

    if (!soldier_name?.trim()) {
      return res.status(400).json({ error: 'חובה למלא שם חייל' });
    }
    if (!ammo_type_id) {
      return res.status(400).json({ error: 'חובה לבחור פריט תחמושת' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'כמות חייבת להיות גדולה מ-0' });
    }
    if (action !== 'add' && action !== 'remove') {
      return res.status(400).json({ error: 'פעולה לא תקינה' });
    }

    const ammo = await AmmoType.findById(ammo_type_id);
    if (!ammo) {
      return res.status(404).json({ error: 'פריט תחמושת לא נמצא' });
    }

    const currentBalanceAgg = await SoldierBunkerRecord.aggregate([
      {
        $match: {
          bunker_id: bunker._id,
          soldier_name: soldier_name.trim(),
          ammo_type_id: ammo._id,
        }
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);
    const currentBalance = currentBalanceAgg[0]?.total || 0;

    if (action === 'remove' && currentBalance < quantity) {
      return res.status(400).json({
        error: `לא ניתן לגרוע ${quantity}. קיימים אצל החייל ${currentBalance} בלבד עבור ${ammo.name}`
      });
    }

    const signedQty = action === 'add' ? quantity : -quantity;
    const issueDate = move_date
      ? new Date(move_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const created = await SoldierBunkerRecord.create({
      bunker_id: bunker._id,
      movement_type: action === 'add' ? 'manual_add' : 'manual_remove',
      soldier_name: soldier_name.trim(),
      soldier_id: soldier_id?.trim() || undefined,
      unit_name: unit_name?.trim() || undefined,
      ammo_type_id: ammo._id,
      quantity: signedQty,
      issue_date: issueDate,
      notes: notes?.trim() || undefined,
      created_at: new Date(),
    });

    res.status(201).json({
      id: created._id,
      bunker_id: created.bunker_id,
      movement_type: created.movement_type,
      soldier_name: created.soldier_name,
      ammo_type_id: created.ammo_type_id,
      ammo_name: ammo.name,
      quantity: created.quantity,
      issue_date: created.issue_date,
      notes: created.notes,
      created_at: created.created_at,
    });
  } catch (error) {
    console.error('Failed to create soldier bunker movement:', error);
    res.status(500).json({ error: 'Failed to create soldier bunker movement' });
  }
});

// PATCH /api/bunkers/:id/soldier-records/adjust - Edit existing soldier row via quantity adjustment (logged as movement)
router.patch('/:id/soldier-records/adjust', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const user = await User.findById(req.user.id);
    if (user?.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    if (normalizeBunkerType(bunker.bunker_type) !== 'soldiers') {
      return res.status(400).json({ error: 'נתיב זה זמין רק לבונקר מסוג חיילים' });
    }

    const {
      soldier_name,
      soldier_id,
      unit_name,
      ammo_type_id,
      new_quantity,
      notes,
      move_date,
    } = req.body as {
      soldier_name?: string;
      soldier_id?: string;
      unit_name?: string;
      ammo_type_id?: string;
      new_quantity?: number;
      notes?: string;
      move_date?: string;
    };

    if (!soldier_name?.trim()) {
      return res.status(400).json({ error: 'חובה למלא שם חייל' });
    }
    if (!ammo_type_id) {
      return res.status(400).json({ error: 'חובה לבחור פריט תחמושת' });
    }
    if (new_quantity === undefined || new_quantity < 0) {
      return res.status(400).json({ error: 'כמות חדשה חייבת להיות 0 או יותר' });
    }

    const ammo = await AmmoType.findById(ammo_type_id);
    if (!ammo) {
      return res.status(404).json({ error: 'פריט תחמושת לא נמצא' });
    }

    const currentBalanceAgg = await SoldierBunkerRecord.aggregate([
      {
        $match: {
          bunker_id: bunker._id,
          soldier_name: soldier_name.trim(),
          soldier_id: soldier_id?.trim() || null,
          ammo_type_id: ammo._id,
        }
      },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);
    const currentBalance = currentBalanceAgg[0]?.total || 0;

    const diff = new_quantity - currentBalance;
    if (diff === 0) {
      return res.json({ success: true, changed: false, message: 'לא נדרש שינוי בכמות' });
    }

    const issueDate = move_date
      ? new Date(move_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const created = await SoldierBunkerRecord.create({
      bunker_id: bunker._id,
      movement_type: diff > 0 ? 'manual_add' : 'manual_remove',
      soldier_name: soldier_name.trim(),
      soldier_id: soldier_id?.trim() || undefined,
      unit_name: unit_name?.trim() || undefined,
      ammo_type_id: ammo._id,
      quantity: diff,
      issue_date: issueDate,
      notes: notes?.trim() || `תיקון רשומה: ${currentBalance} -> ${new_quantity}`,
      created_at: new Date(),
    });

    return res.json({
      success: true,
      changed: true,
      id: created._id,
      movement_type: created.movement_type,
      quantity_delta: diff,
      previous_quantity: currentBalance,
      new_quantity,
    });
  } catch (error) {
    console.error('Failed to adjust soldier bunker record:', error);
    return res.status(500).json({ error: 'Failed to adjust soldier bunker record' });
  }
});

// DELETE /api/bunkers/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    // Check permissions for non-admin users
    if (user.role !== 'admin' && bunker.unit_id) {
      const accessibleUnitIds = await getAccessibleUnits(req.user.id);
      const canAccess = accessibleUnitIds.some(id => String(id) === String(bunker.unit_id));
      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied to this bunker' });
      }
    }

    await Bunker.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bunker:', error);
    res.status(500).json({ error: 'Failed to delete bunker' });
  }
});

export default router;
