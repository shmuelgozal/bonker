import { Router, Request, Response } from 'express';
import db, { runInTransaction } from '../db/database';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/inventory — current stock
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT i.*, at.name as ammo_name, at.unit, at.category, at.tracking_type
    FROM inventory i
    JOIN ammo_types at ON at.id = i.ammo_type_id
    WHERE i.bunker_id = ?
    ORDER BY at.category, at.name
  `).all(req.params.id);
  res.json(rows);
});

// GET /api/bunkers/:id/inventory/history — all entries
router.get('/history', (req: Request, res: Response) => {
  const rows = db.prepare(`
    SELECT ie.*, at.name as ammo_name, at.unit, at.category, at.tracking_type
    FROM inventory_entries ie
    JOIN ammo_types at ON at.id = ie.ammo_type_id
    WHERE ie.bunker_id = ?
    ORDER BY ie.created_at DESC
  `).all(req.params.id);
  res.json(rows);
});

// GET /api/bunkers/:id/inventory/:ammoTypeId/batches
router.get('/:ammoTypeId/batches', (req: Request, res: Response) => {
  const batches = db.prepare(`
    SELECT * FROM inventory_batches
    WHERE bunker_id = ? AND ammo_type_id = ? AND quantity > 0
    ORDER BY batch_number
  `).all(req.params.id, req.params.ammoTypeId);
  res.json(batches);
});

// GET /api/bunkers/:id/inventory/:ammoTypeId/serials
router.get('/:ammoTypeId/serials', (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  let sql = 'SELECT * FROM inventory_serials WHERE bunker_id = ? AND ammo_type_id = ?';
  const params: string[] = [req.params.id, req.params.ammoTypeId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY serial_number';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/bunkers/:id/inventory — add entry, update live stock
router.post('/', (req: Request, res: Response) => {
  const {
    ammo_type_id, quantity_delta, entry_type, notes,
    batches,       // tracking_type='batch': [{batch_number, quantity}]
    serial_numbers // tracking_type='serial': string[]
  } = req.body as {
    ammo_type_id: number;
    quantity_delta?: number;
    entry_type?: string;
    notes?: string;
    batches?: Array<{ batch_number: string; quantity: number }>;
    serial_numbers?: string[];
  };

  if (!ammo_type_id) return res.status(400).json({ error: 'ammo_type_id הוא שדה חובה' });

  const bunkerExists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!bunkerExists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  const ammoType = db.prepare('SELECT * FROM ammo_types WHERE id = ?').get(ammo_type_id) as
    { id: number; tracking_type: string } | undefined;
  if (!ammoType) return res.status(400).json({ error: 'סוג תחמושת לא נמצא' });

  const trackingType = ammoType.tracking_type;
  let effectiveDelta = quantity_delta ?? 0;

  if (trackingType === 'batch' && batches?.length) {
    effectiveDelta = batches.reduce((s, b) => s + (b.quantity || 0), 0);
  } else if (trackingType === 'serial' && serial_numbers?.length) {
    effectiveDelta = serial_numbers.filter(s => s.trim()).length;
  }

  if (effectiveDelta === 0) return res.status(400).json({ error: 'יש להזין כמות' });

  runInTransaction(() => {
    db.prepare(
      'INSERT INTO inventory_entries (bunker_id, ammo_type_id, quantity_delta, entry_type, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, ammo_type_id, effectiveDelta, entry_type || 'add', notes || null);

    if (trackingType !== 'serial') {
      // For qty and batch: update inventory
      // Note: INSERT uses MAX(0, delta) to avoid negative initial values,
      // but ON CONFLICT passes the real delta directly so negative corrections work.
      db.prepare(`
        INSERT INTO inventory (bunker_id, ammo_type_id, quantity, updated_at)
        VALUES (?, ?, MAX(0, ?), datetime('now','localtime'))
        ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET
          quantity = MAX(0, inventory.quantity + ?),
          updated_at = datetime('now','localtime')
      `).run(req.params.id, ammo_type_id, effectiveDelta, effectiveDelta);
    }

    if (trackingType === 'batch' && batches?.length) {
      const upsertBatch = db.prepare(`
        INSERT INTO inventory_batches (bunker_id, ammo_type_id, batch_number, quantity)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bunker_id, ammo_type_id, batch_number) DO UPDATE SET
          quantity = quantity + excluded.quantity
      `);
      for (const b of batches) {
        if (b.quantity > 0) upsertBatch.run(req.params.id, ammo_type_id, b.batch_number.trim(), b.quantity);
      }
    }

    if (trackingType === 'serial' && serial_numbers?.length) {
      const insertSerial = db.prepare(
        "INSERT OR IGNORE INTO inventory_serials (bunker_id, ammo_type_id, serial_number, status) VALUES (?, ?, ?, 'in_stock')"
      );
      for (const sn of serial_numbers) {
        const t = sn.trim();
        if (t) insertSerial.run(req.params.id, ammo_type_id, t);
      }
      // Sync inventory count from actual serials
      const cnt = db.prepare(
        "SELECT COUNT(*) as c FROM inventory_serials WHERE bunker_id=? AND ammo_type_id=? AND status='in_stock'"
      ).get(req.params.id, ammo_type_id) as { c: number };
      db.prepare(`
        INSERT INTO inventory (bunker_id, ammo_type_id, quantity, updated_at) VALUES (?, ?, ?, datetime('now','localtime'))
        ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET quantity = excluded.quantity, updated_at = excluded.updated_at
      `).run(req.params.id, ammo_type_id, cnt.c);
    }
  });

  res.status(201).json(db.prepare(
    'SELECT * FROM inventory WHERE bunker_id = ? AND ammo_type_id = ?'
  ).get(req.params.id, ammo_type_id));
});

export default router;
