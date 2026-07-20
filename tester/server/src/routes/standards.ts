import { Router, Request, Response } from 'express';
import db, { runInTransaction } from '../db/database';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/standard
router.get('/', (req: Request, res: Response) => {
  const standards = db.prepare(`
    SELECT bs.*, at.name as ammo_name, at.unit, at.category
    FROM bunker_standards bs
    JOIN ammo_types at ON at.id = bs.ammo_type_id
    WHERE bs.bunker_id = ?
    ORDER BY at.category, at.name
  `).all(req.params.id);
  res.json(standards);
});

// PUT /api/bunkers/:id/standard — upsert full standard
router.put('/', (req: Request, res: Response) => {
  const { items } = req.body as {
    items: Array<{ ammo_type_id: number; required_qty: number }>;
  };

  const bunkerExists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!bunkerExists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  runInTransaction(() => {
    // Delete removed entries
    const ammoIds = items.map(i => i.ammo_type_id);
    if (ammoIds.length > 0) {
      const placeholders = ammoIds.map(() => '?').join(',');
      db.prepare(
        `DELETE FROM bunker_standards WHERE bunker_id = ? AND ammo_type_id NOT IN (${placeholders})`
      ).run(req.params.id, ...ammoIds);
    } else {
      db.prepare('DELETE FROM bunker_standards WHERE bunker_id = ?').run(req.params.id);
    }

    const upsert = db.prepare(`
      INSERT INTO bunker_standards (bunker_id, ammo_type_id, required_qty)
      VALUES (?, ?, ?)
      ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET required_qty = excluded.required_qty
    `);

    for (const item of items) {
      if (item.required_qty > 0) {
        upsert.run(req.params.id, item.ammo_type_id, item.required_qty);
      }
    }
  });

  const standards = db.prepare(`
    SELECT bs.*, at.name as ammo_name, at.unit, at.category
    FROM bunker_standards bs
    JOIN ammo_types at ON at.id = bs.ammo_type_id
    WHERE bs.bunker_id = ?
    ORDER BY at.category, at.name
  `).all(req.params.id);
  res.json(standards);
});

// GET /api/bunkers/:id/standard/gaps — compare inventory vs standard
router.get('/gaps', (req: Request, res: Response) => {
  const gaps = db.prepare(`
    SELECT
      at.id as ammo_type_id,
      at.name as ammo_name,
      at.unit,
      at.category,
      COALESCE(bs.required_qty, 0) as required_qty,
      COALESCE(inv.quantity, 0) as current_qty,
      COALESCE(inv.quantity, 0) - COALESCE(bs.required_qty, 0) as gap
    FROM ammo_types at
    LEFT JOIN bunker_standards bs ON bs.ammo_type_id = at.id AND bs.bunker_id = ?
    LEFT JOIN inventory inv ON inv.ammo_type_id = at.id AND inv.bunker_id = ?
    WHERE bs.required_qty IS NOT NULL AND bs.required_qty > 0
    ORDER BY gap ASC, at.category, at.name
  `).all(req.params.id, req.params.id);

  const summary = {
    total: (gaps as Array<{ gap: number }>).length,
    deficit: (gaps as Array<{ gap: number }>).filter(g => g.gap < 0).length,
    ok: (gaps as Array<{ gap: number }>).filter(g => g.gap >= 0).length,
  };

  res.json({ gaps, summary });
});

export default router;
