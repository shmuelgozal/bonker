import { Router, Request, Response } from 'express';
import { AmmoType, InventoryEntry } from '../db/mongo';

const router = Router();

// GET /api/ammo-types
router.get('/', async (_req: Request, res: Response) => {
  try {
    const types = await AmmoType.find().sort({ category: 1, name: 1 });
    res.json(types.map(t => ({
      id: t._id,
      name: t.name,
      unit: t.unit,
      category: t.category,
      tracking_type: t.tracking_type,
      created_at: t.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ammo types' });
  }
});

// POST /api/ammo-types
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, unit, category, tracking_type } = req.body as { name: string; unit?: string; category?: string; tracking_type?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'שם הפריט הוא שדה חובה' });
    }
    const ammoType = await AmmoType.create({
      name: name.trim(),
      unit: unit?.trim() || "יח'",
      category: category?.trim() || 'תחמושת',
      tracking_type: tracking_type?.trim() || 'qty',
      created_at: new Date(),
    });
    res.status(201).json({
      id: ammoType._id,
      name: ammoType.name,
      unit: ammoType.unit,
      category: ammoType.category,
      tracking_type: ammoType.tracking_type,
      created_at: ammoType.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ammo type' });
  }
});

// PUT /api/ammo-types/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, unit, category, tracking_type } = req.body as { name: string; unit?: string; category?: string; tracking_type?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'שם הפריט הוא שדה חובה' });
    }
    const ammoType = await AmmoType.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      unit: unit?.trim() || "יח'",
      category: category?.trim() || 'תחמושת',
      tracking_type: tracking_type?.trim() || 'qty',
    }, { new: true });
    if (!ammoType) return res.status(404).json({ error: 'פריט לא נמצא' });
    res.json({
      id: ammoType._id,
      name: ammoType.name,
      unit: ammoType.unit,
      category: ammoType.category,
      tracking_type: ammoType.tracking_type,
      created_at: ammoType.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ammo type' });
  }
});

// DELETE /api/ammo-types/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ammoType = await AmmoType.findById(req.params.id);
    if (!ammoType) return res.status(404).json({ error: 'פריט לא נמצא' });

    // Check if in use
    const inUse = await InventoryEntry.countDocuments({ ammo_type_id: req.params.id });
    if (inUse > 0) {
      return res.status(400).json({ error: 'לא ניתן למחוק פריט שנמצא בשימוש' });
    }

    await AmmoType.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ammo type' });
  }
});

export default router;
