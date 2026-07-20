import { Router, Request, Response } from 'express';
import { Bunker, Unit, Inventory } from '../db/mongo';

const router = Router();

// GET /api/bunkers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const bunkers = await Bunker.find().sort({ created_at: -1 }).lean();
    const result = await Promise.all(
      bunkers.map(async (b: any) => {
        const unit = b.unit_id ? await Unit.findById(b.unit_id).lean() : null;
        const stockedTypes = await Inventory.countDocuments({ 
          bunker_id: b._id, 
          quantity: { $gt: 0 } 
        });
        return {
          id: b._id,
          name: b.name,
          location: b.location,
          description: b.description,
          unit_id: b.unit_id,
          unit_name: unit?.name,
          unit_type: unit?.type,
          stocked_types: stockedTypes,
          issuance_count: 0,
          created_at: b.created_at,
        };
      })
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bunkers' });
  }
});

// POST /api/bunkers
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, location, description, unit_id } = req.body as { name: string; location?: string; description?: string; unit_id?: string | null };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'שם הבונקר הוא שדה חובה' });
    }
    const bunker = await Bunker.create({
      name: name.trim(),
      location: location?.trim() || undefined,
      description: description?.trim() || undefined,
      unit_id: unit_id || undefined,
      created_at: new Date(),
    });
    res.status(201).json({
      id: bunker._id,
      name: bunker.name,
      location: bunker.location,
      description: bunker.description,
      unit_id: bunker.unit_id,
      created_at: bunker.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bunker' });
  }
});

// GET /api/bunkers/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bunker = await Bunker.findById(req.params.id).lean();
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });
    
    const unit = bunker.unit_id ? await Unit.findById(bunker.unit_id).lean() : null;
    res.json({
      id: bunker._id,
      name: bunker.name,
      location: bunker.location,
      description: bunker.description,
      unit_id: bunker.unit_id,
      unit_name: unit?.name,
      unit_type: unit?.type,
      created_at: bunker.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bunker' });
  }
});

// PUT /api/bunkers/:id/link-unit - Link or unlink a bunker to/from a unit
router.put('/:id/link-unit', async (req: Request, res: Response) => {
  try {
    const { unit_id } = req.body as { unit_id: string | null };
    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    if (unit_id !== null && unit_id !== undefined) {
      const unit = await Unit.findById(unit_id);
      if (!unit) return res.status(404).json({ error: 'יחידה לא נמצאה' });
    }

    const updated = await Bunker.findByIdAndUpdate(req.params.id, { unit_id: unit_id || undefined }, { new: true }).lean();
    const unit = updated?.unit_id ? await Unit.findById(updated.unit_id).lean() : null;
    res.json({
      id: updated?._id,
      name: updated?.name,
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

// PUT /api/bunkers/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, location, description } = req.body as { name: string; location?: string; description?: string };
    if (!name?.trim()) {
      return res.status(400).json({ error: 'שם הבונקר הוא שדה חובה' });
    }
    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const updated = await Bunker.findByIdAndUpdate(req.params.id, {
      name: name.trim(),
      location: location?.trim() || undefined,
      description: description?.trim() || undefined,
    }, { new: true }).lean();

    const unit = updated?.unit_id ? await Unit.findById(updated.unit_id).lean() : null;
    res.json({
      id: updated?._id,
      name: updated?.name,
      location: updated?.location,
      description: updated?.description,
      unit_id: updated?.unit_id,
      unit_name: unit?.name,
      unit_type: unit?.type,
      created_at: updated?.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bunker' });
  }
});

// DELETE /api/bunkers/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    await Bunker.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bunker' });
  }
});

export default router;
