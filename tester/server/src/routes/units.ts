import { Router, Request, Response } from 'express';
import { Unit, StorageLocation, Bunker, Inventory, AmmoType, BunkerStandard } from '../db/mongo';
import mongoose from 'mongoose';

const router = Router();

// GET /api/units - Get all units as a tree
router.get('/', async (req: Request, res: Response) => {
  try {
    const units = await Unit.find().sort({ parent_unit_id: 1, created_at: 1 }).lean();
    const storageLocations = await StorageLocation.find().lean();

    const buildTree = (parentId: string | null = null): any[] => {
      return (units as any[])
        .filter((u) => (u.parent_unit_id === parentId || (!u.parent_unit_id && parentId === null)))
        .map((unit) => {
          const storage = storageLocations.find((s: any) => String(s.unit_id) === String(unit._id));
          return {
            id: unit._id,
            name: unit.name,
            type: unit.type,
            parent_unit_id: unit.parent_unit_id,
            description: unit.description,
            created_at: unit.created_at,
            children: buildTree(String(unit._id)),
            storage_location: storage,
          };
        });
    };

    const tree = buildTree();
    res.json(tree);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// GET /api/units/:id - Get specific unit with full hierarchy info
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const unit = await Unit.findById(req.params.id).lean();
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const storage = await StorageLocation.findOne({ unit_id: req.params.id }).lean();
    const children = await Unit.find({ parent_unit_id: req.params.id }).sort({ created_at: 1 }).lean();
    const parent = unit.parent_unit_id ? await Unit.findById(unit.parent_unit_id).lean() : null;

    res.json({
      id: unit._id,
      name: unit.name,
      type: unit.type,
      parent_unit_id: unit.parent_unit_id,
      description: unit.description,
      created_at: unit.created_at,
      storage_location: storage,
      parent: parent ? { id: parent._id, name: parent.name } : null,
      children: children.map((c: any) => ({ id: c._id, name: c.name })),
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

// POST /api/units - Create new unit
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type = 'battalion', parent_unit_id = null, description = null } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!['battalion', 'company', 'storage_location'].includes(type)) {
      return res.status(400).json({ error: 'Invalid unit type' });
    }

    const unit = await Unit.create({
      name: name.trim(),
      type,
      parent_unit_id: parent_unit_id || undefined,
      description: typeof description === 'string' ? description.trim() || undefined : undefined,
      created_at: new Date(),
    });

    res.status(201).json({
      id: unit._id,
      name: unit.name,
      type: unit.type,
      parent_unit_id: unit.parent_unit_id,
      description: unit.description,
      created_at: unit.created_at,
    });
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

// PUT /api/units/:id - Update unit
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, type, description, parent_unit_id } = req.body;

    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const updates: any = {};

    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined && ['battalion', 'company', 'storage_location'].includes(type)) updates.type = type;
    if (description !== undefined) updates.description = typeof description === 'string' ? description.trim() || null : null;
    if (parent_unit_id !== undefined) updates.parent_unit_id = parent_unit_id || null;

    const updated = await Unit.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();

    res.json({
      id: updated?._id,
      name: updated?.name,
      type: updated?.type,
      parent_unit_id: updated?.parent_unit_id,
      description: updated?.description,
      created_at: updated?.created_at,
    });
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Failed to update unit' });
  }
});

// DELETE /api/units/:id - Delete unit
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    await Unit.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Unit deleted' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
});

// POST /api/units/:id/storage - Add storage location to unit
router.post('/:id/storage', async (req: Request, res: Response) => {
  try {
    const { location_type, location_details = '' } = req.body;

    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    if (!['bunker', 'vehicle', 'pillbox'].includes(location_type)) {
      return res.status(400).json({ error: 'Invalid location type' });
    }

    const existing = await StorageLocation.findOne({ unit_id: req.params.id });

    if (existing) {
      const updated = await StorageLocation.findByIdAndUpdate(existing._id, {
        location_type,
        location_details: location_details || null,
      }, { new: true }).lean();
      return res.json(updated);
    }

    const storage = await StorageLocation.create({
      unit_id: req.params.id,
      location_type,
      location_details: location_details || null,
    });

    res.status(201).json(storage);
  } catch (error) {
    console.error('Error adding storage location:', error);
    res.status(500).json({ error: 'Failed to add storage location' });
  }
});

// GET /api/units/:id/storage - Get storage location for unit
router.get('/:id/storage', async (req: Request, res: Response) => {
  try {
    const storage = await StorageLocation.findOne({ unit_id: req.params.id }).lean();
    if (!storage) return res.status(404).json({ error: 'Storage location not found' });
    res.json(storage);
  } catch (error) {
    console.error('Error fetching storage location:', error);
    res.status(500).json({ error: 'Failed to fetch storage location' });
  }
});

// GET /api/units/:id/bunkers - Get bunkers linked to this unit
router.get('/:id/bunkers', async (req: Request, res: Response) => {
  try {
    const bunkers = await Bunker.find({ unit_id: req.params.id }).sort({ name: 1 }).lean();
    
    const result = await Promise.all(
      (bunkers as any[]).map(async (b) => {
        const totalQty = await Inventory.aggregate([
          { $match: { bunker_id: new mongoose.Types.ObjectId(b._id) } },
          { $group: { _id: null, total: { $sum: '$quantity' } } }
        ]);
        
        return {
          id: b._id,
          name: b.name,
          location: b.location,
          total_qty: totalQty[0]?.total || 0,
        };
      })
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching unit bunkers:', error);
    res.status(500).json({ error: 'Failed to fetch unit bunkers' });
  }
});

// POST /api/units/:id/ensure-bunker - Get or create a bunker for this storage location unit
router.post('/:id/ensure-bunker', async (req: Request, res: Response) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    let existing = await Bunker.findOne({ unit_id: req.params.id }).lean();
    if (existing) return res.json(existing);

    const storage = await StorageLocation.findOne({ unit_id: req.params.id }).lean();
    const locType = storage?.location_type || 'storage';
    const locTypeHeb = locType === 'bunker' ? 'בונקר' : locType === 'vehicle' ? 'רכב' : 'מנמ"כ';

    const bunker = await Bunker.create({
      name: unit.name,
      location: storage?.location_details || undefined,
      description: `${locTypeHeb} - נוצר אוטומטית ממסגרת`,
      unit_id: req.params.id,
      created_at: new Date(),
    });

    res.status(201).json({
      id: bunker._id,
      name: bunker.name,
      location: bunker.location,
    });
  } catch (error) {
    console.error('Error ensuring bunker:', error);
    res.status(500).json({ error: 'Failed to ensure bunker' });
  }
});

// Helper: Get all unit IDs in a unit's subtree
const getAllUnitIds = async (unitId: string): Promise<string[]> => {
  const allIds: string[] = [unitId];
  const children = await Unit.find({ parent_unit_id: unitId }).select('_id').lean();
  for (const child of children) {
    allIds.push(...await getAllUnitIds(String(child._id)));
  }
  return allIds;
};

// GET /api/units/:id/inventory-summary
router.get('/:id/inventory-summary', async (req: Request, res: Response) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const unitIds = await getAllUnitIds(req.params.id);
    const unitObjectIds = unitIds.map(id => new mongoose.Types.ObjectId(id));

    const bunkers = await Bunker.find({ unit_id: { $in: unitObjectIds } }).select('_id').lean();
    const bunkerIds = bunkers.map(b => b._id);

    if (bunkerIds.length === 0) {
      return res.json({
        unit_id: req.params.id,
        unit_name: unit.name,
        bunker_count: 0,
        inventory: []
      });
    }

    const inventory = await Inventory.aggregate([
      { $match: { bunker_id: { $in: bunkerIds }, quantity: { $gt: 0 } } },
      { $group: {
          _id: '$ammo_type_id',
          total_qty: { $sum: '$quantity' }
        }
      },
      { $lookup: {
          from: 'ammotypes',
          localField: '_id',
          foreignField: '_id',
          as: 'ammo_type'
        }
      },
      { $unwind: '$ammo_type' },
      { $sort: { 'ammo_type.category': 1, 'ammo_type.name': 1 } },
      { $project: {
          ammo_type_id: '$_id',
          ammo_name: '$ammo_type.name',
          unit: '$ammo_type.unit',
          category: '$ammo_type.category',
          total_qty: 1
        }
      }
    ]);

    res.json({
      unit_id: req.params.id,
      unit_name: unit.name,
      bunker_count: bunkerIds.length,
      inventory
    });
  } catch (error) {
    console.error('Error fetching unit inventory summary:', error);
    res.status(500).json({ error: 'Failed to fetch unit inventory summary' });
  }
});

// GET /api/units/:id/gaps
router.get('/:id/gaps', async (req: Request, res: Response) => {
  try {
    const unit = await Unit.findById(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    const unitIds = await getAllUnitIds(req.params.id);
    const unitObjectIds = unitIds.map(id => new mongoose.Types.ObjectId(id));

    const bunkers = await Bunker.find({ unit_id: { $in: unitObjectIds } }).select('_id').lean();
    const bunkerIds = bunkers.map(b => b._id);

    if (bunkerIds.length === 0) {
      return res.json({ gaps: [], summary: { total: 0, deficit: 0, ok: 0 } });
    }

    const gaps = await AmmoType.aggregate([
      { $lookup: {
          from: 'bunkerstdards',
          localField: '_id',
          foreignField: 'ammo_type_id',
          as: 'standards'
        }
      },
      { $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: 'ammo_type_id',
          as: 'inventory'
        }
      },
      { $project: {
          ammo_type_id: '$_id',
          ammo_name: '$name',
          unit: '$unit',
          category: '$category',
          required_qty: { $sum: '$standards.required_qty' },
          current_qty: { $sum: '$inventory.quantity' },
          gap: { $subtract: [{ $sum: '$inventory.quantity' }, { $sum: '$standards.required_qty' }] }
        }
      },
      { $match: { required_qty: { $gt: 0 } } },
      { $sort: { gap: 1, category: 1, ammo_name: 1 } }
    ]);

    const summary = {
      total: gaps.length,
      deficit: gaps.filter(g => g.gap < 0).length,
      ok: gaps.filter(g => g.gap >= 0).length,
    };

    res.json({ gaps, summary });
  } catch (error) {
    console.error('Error fetching unit gaps:', error);
    res.status(500).json({ error: 'Failed to fetch unit gaps' });
  }
});

export default router;
