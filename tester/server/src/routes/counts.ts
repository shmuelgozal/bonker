import { Router, Request, Response } from 'express';
import { InventoryCount, InventoryCountItem, AmmoType, Bunker } from '../db/mongo';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/counts
router.get('/', async (req: Request, res: Response) => {
  try {
    const counts = await InventoryCount.find({ bunker_id: req.params.id }).sort({ created_at: -1 }).lean();
    const result = await Promise.all(
      (counts as any[]).map(async (c) => {
        const itemCount = await InventoryCountItem.countDocuments({ count_id: c._id });
        return {
          id: c._id,
          bunker_id: c.bunker_id,
          count_date: c.count_date,
          notes: c.notes,
          status: c.status,
          created_at: c.created_at,
          item_count: itemCount,
        };
      })
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// POST /api/bunkers/:id/counts — create new count
router.post('/', async (req: Request, res: Response) => {
  try {
    const { count_date, notes, items } = req.body as {
      count_date?: string;
      notes?: string;
      items?: Array<{ ammo_type_id: string; counted_qty: number }>;
    };

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const count = await InventoryCount.create({
      bunker_id: req.params.id,
      count_date: count_date ? new Date(count_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      notes: notes || undefined,
      status: 'draft',
      created_at: new Date(),
    });

    if (items && items.length > 0) {
      await InventoryCountItem.create(
        items.map(item => ({
          count_id: count._id,
          ammo_type_id: item.ammo_type_id,
          counted_qty: item.counted_qty || 0,
        }))
      );
    }

    res.status(201).json({
      id: count._id,
      bunker_id: count.bunker_id,
      count_date: count.count_date,
      notes: count.notes,
      status: count.status,
      created_at: count.created_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create count' });
  }
});

// GET /api/bunkers/:id/counts/:countId
router.get('/:countId', async (req: Request, res: Response) => {
  try {
    const count = await InventoryCount.findOne({
      _id: req.params.countId,
      bunker_id: req.params.id,
    }).lean();

    if (!count) return res.status(404).json({ error: 'ספירה לא נמצאה' });

    const items = await InventoryCountItem.find({ count_id: req.params.countId }).lean();
    
    const itemsWithAmmo = await Promise.all(
      (items as any[]).map(async (i) => {
        const ammo = await AmmoType.findById(i.ammo_type_id).lean();
        return {
          id: i._id,
          count_id: i.count_id,
          ammo_type_id: i.ammo_type_id,
          counted_qty: i.counted_qty,
          ammo_name: ammo?.name,
          unit: ammo?.unit,
          category: ammo?.category,
        };
      })
    );

    res.json({
      id: count._id,
      bunker_id: count.bunker_id,
      count_date: count.count_date,
      notes: count.notes,
      status: count.status,
      created_at: count.created_at,
      items: itemsWithAmmo.sort((a, b) => {
        if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
        return (a.ammo_name || '').localeCompare(b.ammo_name || '');
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// PUT /api/bunkers/:id/counts/:countId
router.put('/:countId', async (req: Request, res: Response) => {
  try {
    const { status, notes, items } = req.body as {
      status?: string;
      notes?: string;
      items?: Array<{ ammo_type_id: string; counted_qty: number }>;
    };

    const count = await InventoryCount.findOne({
      _id: req.params.countId,
      bunker_id: req.params.id,
    });

    if (!count) return res.status(404).json({ error: 'ספירה לא נמצאה' });

    if (notes !== undefined || status !== undefined) {
      await InventoryCount.findByIdAndUpdate(req.params.countId, {
        status: status || count.status,
        notes: notes !== undefined ? notes : count.notes,
      });
    }

    if (items && items.length > 0) {
      for (const item of items) {
        await InventoryCountItem.findOneAndUpdate(
          { count_id: req.params.countId, ammo_type_id: item.ammo_type_id },
          { counted_qty: item.counted_qty },
          { upsert: true }
        );
      }
    }

    const updated = await InventoryCount.findById(req.params.countId).lean();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update count' });
  }
});

export default router;
