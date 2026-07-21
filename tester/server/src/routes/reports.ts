import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { AmmoType, Bunker, InventoryEntry } from '../db/mongo';

const router = Router();

type BunkerType = 'bunker' | 'vehicle_pillbox' | 'soldiers';

const normalizeBunkerType = (value: unknown): BunkerType => {
  if (value === 'soldiers') return 'soldiers';
  if (value === 'vehicle_pillbox') return 'vehicle_pillbox';
  return 'bunker';
};

// GET /api/reports/shatzal
router.get('/shatzal', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await InventoryEntry.find({ entry_type: 'shatzal' }).sort({ event_date: -1, created_at: -1 }).limit(365).lean();

    const result = await Promise.all(
      (rows as any[]).map(async (row) => {
        const [ammo, bunker] = await Promise.all([
          AmmoType.findById(row.ammo_type_id).lean(),
          Bunker.findById(row.bunker_id).lean(),
        ]);

        return {
          id: row._id,
          bunker_id: row.bunker_id,
          bunker_name: bunker?.name,
          bunker_type: normalizeBunkerType(bunker?.bunker_type),
          ammo_type_id: row.ammo_type_id,
          ammo_name: ammo?.name,
          ammo_unit: ammo?.unit,
          quantity_used: Math.abs(row.quantity_delta || 0),
          representative: row.created_by_username || 'מערכת',
          used_at: row.event_date || row.created_at,
          notes: row.notes || null,
        };
      })
    );

    res.json(result);
  } catch (error) {
    console.error('Failed to fetch shatzal report:', error);
    res.status(500).json({ error: 'Failed to fetch shatzal report' });
  }
});

export default router;
