import { Router, Request, Response } from 'express';
import db, { runInTransaction } from '../db/database';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/counts
router.get('/', (req: Request, res: Response) => {
  const counts = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM inventory_count_items WHERE count_id = c.id) as item_count
    FROM inventory_counts c
    WHERE c.bunker_id = ?
    ORDER BY c.created_at DESC
  `).all(req.params.id);
  res.json(counts);
});

// POST /api/bunkers/:id/counts — create new count
router.post('/', (req: Request, res: Response) => {
  const { count_date, notes, items } = req.body as {
    count_date?: string;
    notes?: string;
    items: Array<{ ammo_type_id: number; counted_qty: number }>;
  };

  const bunkerExists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!bunkerExists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  const countId = runInTransaction(() => {
    const result = db.prepare(
      "INSERT INTO inventory_counts (bunker_id, count_date, notes, status) VALUES (?, ?, ?, 'draft')"
    ).run(req.params.id, count_date || null, notes || null);

    const countId = result.lastInsertRowid;

    if (items && items.length > 0) {
      const insertItem = db.prepare(
        'INSERT INTO inventory_count_items (count_id, ammo_type_id, counted_qty) VALUES (?, ?, ?)'
      );
      for (const item of items) {
        insertItem.run(countId, item.ammo_type_id, item.counted_qty ?? 0);
      }
    }

    return countId;
  });
  const count = db.prepare('SELECT * FROM inventory_counts WHERE id = ?').get(countId);
  res.status(201).json(count);
});

// GET /api/bunkers/:id/counts/:countId
router.get('/:countId', (req: Request, res: Response) => {
  const count = db.prepare(
    'SELECT * FROM inventory_counts WHERE id = ? AND bunker_id = ?'
  ).get(req.params.countId, req.params.id);

  if (!count) return res.status(404).json({ error: 'ספירה לא נמצאה' });

  const items = db.prepare(`
    SELECT ici.*, at.name as ammo_name, at.unit, at.category
    FROM inventory_count_items ici
    JOIN ammo_types at ON at.id = ici.ammo_type_id
    WHERE ici.count_id = ?
    ORDER BY at.category, at.name
  `).all(req.params.countId);

  res.json({ ...(count as object), items });
});

// PUT /api/bunkers/:id/counts/:countId — complete count (optionally sync inventory)
router.put('/:countId', (req: Request, res: Response) => {
  const { status, notes, items, sync_inventory } = req.body as {
    status?: string;
    notes?: string;
    items?: Array<{ ammo_type_id: number; counted_qty: number }>;
    sync_inventory?: boolean;
  };

  const count = db.prepare(
    'SELECT * FROM inventory_counts WHERE id = ? AND bunker_id = ?'
  ).get(req.params.countId, req.params.id) as { id: number; status: string } | undefined;

  if (!count) return res.status(404).json({ error: 'ספירה לא נמצאה' });

  runInTransaction(() => {
    if (notes !== undefined || status !== undefined) {
      db.prepare(
        'UPDATE inventory_counts SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?'
      ).run(status || null, notes || null, req.params.countId);
    }

    if (items && items.length > 0) {
      const upsertItem = db.prepare(`
        INSERT INTO inventory_count_items (count_id, ammo_type_id, counted_qty)
        VALUES (?, ?, ?)
        ON CONFLICT(count_id, ammo_type_id) DO UPDATE SET counted_qty = excluded.counted_qty
      `);
      for (const item of items) {
        upsertItem.run(req.params.countId, item.ammo_type_id, item.counted_qty ?? 0);
      }
    }

    // If completing count and syncing inventory
    if (status === 'complete' && sync_inventory) {
      const countItems = db.prepare(
        'SELECT * FROM inventory_count_items WHERE count_id = ?'
      ).all(req.params.countId) as Array<{ ammo_type_id: number; counted_qty: number }>;

      for (const item of countItems) {
        const current = db.prepare(
          'SELECT quantity FROM inventory WHERE bunker_id = ? AND ammo_type_id = ?'
        ).get(req.params.id, item.ammo_type_id) as { quantity: number } | undefined;

        const delta = item.counted_qty - (current?.quantity ?? 0);

        db.prepare(`
          INSERT INTO inventory (bunker_id, ammo_type_id, quantity, updated_at)
          VALUES (?, ?, ?, datetime('now','localtime'))
          ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET
            quantity = excluded.quantity,
            updated_at = datetime('now','localtime')
        `).run(req.params.id, item.ammo_type_id, item.counted_qty);

        if (delta !== 0) {
          db.prepare(
            "INSERT INTO inventory_entries (bunker_id, ammo_type_id, quantity_delta, entry_type, notes) VALUES (?, ?, ?, 'count', ?)"
          ).run(req.params.id, item.ammo_type_id, delta, `סנכרון מספירה #${req.params.countId}`);
        }
      }
    }
  });

  const updated = db.prepare('SELECT * FROM inventory_counts WHERE id = ?').get(req.params.countId);
  res.json(updated);
});

export default router;
