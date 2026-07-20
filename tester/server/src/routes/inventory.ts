import { Router, Request, Response } from 'express';
import { Inventory, InventoryEntry, AmmoType, Bunker } from '../db/mongo';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/inventory — current stock
router.get('/', async (req: Request, res: Response) => {
  try {
    const inventory = await Inventory.find({ bunker_id: req.params.id }).lean();
    const result = await Promise.all(
      (inventory as any[]).map(async (i) => {
        const ammoType = await AmmoType.findById(i.ammo_type_id).lean();
        return {
          id: i._id,
          bunker_id: i.bunker_id,
          ammo_type_id: i.ammo_type_id,
          quantity: i.quantity,
          updated_at: i.updated_at,
          ammo_name: ammoType?.name,
          unit: ammoType?.unit,
          category: ammoType?.category,
          tracking_type: ammoType?.tracking_type,
        };
      })
    );
    res.json(result.sort((a, b) => {
      if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
      return (a.ammo_name || '').localeCompare(b.ammo_name || '');
    }));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/bunkers/:id/inventory/history — all entries
router.get('/history', async (req: Request, res: Response) => {
  try {
    const entries = await InventoryEntry.find({ bunker_id: req.params.id }).sort({ created_at: -1 }).lean();
    const result = await Promise.all(
      (entries as any[]).map(async (e) => {
        const ammoType = await AmmoType.findById(e.ammo_type_id).lean();
        return {
          id: e._id,
          bunker_id: e.bunker_id,
          ammo_type_id: e.ammo_type_id,
          quantity_delta: e.quantity_delta,
          entry_type: e.entry_type,
          notes: e.notes,
          created_at: e.created_at,
          ammo_name: ammoType?.name,
          unit: ammoType?.unit,
          category: ammoType?.category,
          tracking_type: ammoType?.tracking_type,
        };
      })
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
});

// POST /api/bunkers/:id/inventory — add entry, update live stock
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      ammo_type_id,
      quantity_delta = 0,
      entry_type = 'add',
      notes,
    } = req.body as {
      ammo_type_id: string;
      quantity_delta?: number;
      entry_type?: string;
      notes?: string;
    };

    if (!ammo_type_id) return res.status(400).json({ error: 'ammo_type_id הוא שדה חובה' });

    const bunker = await Bunker.findById(req.params.id);
    if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });

    const ammoType = await AmmoType.findById(ammo_type_id);
    if (!ammoType) return res.status(400).json({ error: 'סוג תחמושת לא נמצא' });

    if (quantity_delta === 0) return res.status(400).json({ error: 'יש להזין כמות' });

    // Create inventory entry
    await InventoryEntry.create({
      bunker_id: req.params.id,
      ammo_type_id,
      quantity_delta,
      entry_type,
      notes: notes || undefined,
      created_at: new Date(),
    });

    // Update or create inventory record
    const existing = await Inventory.findOne({ bunker_id: req.params.id, ammo_type_id });
    if (existing) {
      await Inventory.findByIdAndUpdate(existing._id, {
        quantity: Math.max(0, existing.quantity + quantity_delta),
        updated_at: new Date(),
      });
    } else {
      await Inventory.create({
        bunker_id: req.params.id,
        ammo_type_id,
        quantity: Math.max(0, quantity_delta),
        updated_at: new Date(),
      });
    }

    const updated = await Inventory.findOne({ bunker_id: req.params.id, ammo_type_id }).lean();
    res.status(201).json(updated);
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

export default router;
