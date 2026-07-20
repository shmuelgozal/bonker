import { Router, Request, Response } from 'express';
import { BunkerStandard, AmmoType, Inventory, Bunker } from '../db/mongo';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/standard
router.get('/', async (req: Request, res: Response) => {
  try {
    const standards = await BunkerStandard.find({ bunker_id: req.params.id }).lean();
    const result = await Promise.all(
      (standards as any[]).map(async (s) => {
        const ammo = await AmmoType.findById(s.ammo_type_id).lean();
        return {
          id: s._id,
          bunker_id: s.bunker_id,
          ammo_type_id: s.ammo_type_id,
          required_qty: s.required_qty,
          ammo_name: ammo?.name,
          unit: ammo?.unit,
          category: ammo?.category,
        };
      })
    );
    res.json(result.sort((a, b) => {
      if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
      return (a.ammo_name || '').localeCompare(b.ammo_name || '');
    }));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch standards' });
  }
});

// PUT /api/bunkers/:id/standard — upsert full standard
router.put('/', async (req: Request, res: Response) => {
  try {
    const { items } = req.body as {
      items: Array<{ ammo_type_id: string; required_qty: number }>;
    };

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    // Delete standards not in new list
    const ammoIds = items.map(i => i.ammo_type_id);
    if (ammoIds.length > 0) {
      await BunkerStandard.deleteMany({
        bunker_id: req.params.id,
        ammo_type_id: { $nin: ammoIds }
      });
    } else {
      await BunkerStandard.deleteMany({ bunker_id: req.params.id });
    }

    // Upsert standards
    for (const item of items) {
      if (item.required_qty > 0) {
        await BunkerStandard.findOneAndUpdate(
          { bunker_id: req.params.id, ammo_type_id: item.ammo_type_id },
          { required_qty: item.required_qty },
          { upsert: true }
        );
      }
    }

    // Return updated standards
    const standards = await BunkerStandard.find({ bunker_id: req.params.id }).lean();
    const result = await Promise.all(
      (standards as any[]).map(async (s) => {
        const ammo = await AmmoType.findById(s.ammo_type_id).lean();
        return {
          id: s._id,
          bunker_id: s.bunker_id,
          ammo_type_id: s.ammo_type_id,
          required_qty: s.required_qty,
          ammo_name: ammo?.name,
          unit: ammo?.unit,
          category: ammo?.category,
        };
      })
    );
    res.json(result.sort((a, b) => {
      if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
      return (a.ammo_name || '').localeCompare(b.ammo_name || '');
    }));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update standards' });
  }
});

// GET /api/bunkers/:id/standard/gaps — compare inventory vs standard
router.get('/gaps', async (req: Request, res: Response) => {
  try {
    const standards = await BunkerStandard.find({ bunker_id: req.params.id }).lean();
    
    const gaps = await Promise.all(
      (standards as any[]).map(async (s) => {
        const ammo = await AmmoType.findById(s.ammo_type_id).lean();
        const inv = await Inventory.findOne({
          bunker_id: req.params.id,
          ammo_type_id: s.ammo_type_id,
        }).lean();

        const current_qty = inv?.quantity || 0;
        const gap = current_qty - s.required_qty;

        return {
          ammo_type_id: s.ammo_type_id,
          ammo_name: ammo?.name,
          unit: ammo?.unit,
          category: ammo?.category,
          required_qty: s.required_qty,
          current_qty,
          gap,
        };
      })
    );

    const summary = {
      total: gaps.length,
      deficit: gaps.filter(g => g.gap < 0).length,
      ok: gaps.filter(g => g.gap >= 0).length,
    };

    res.json({
      gaps: gaps.sort((a, b) => a.gap - b.gap),
      summary
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gaps' });
  }
});

export default router;
