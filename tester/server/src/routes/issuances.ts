import { Router, Request, Response } from 'express';
import db, { runInTransaction } from '../db/database';
import upload from '../middleware/upload';

const router = Router({ mergeParams: true });

// GET /api/bunkers/:id/issuances
router.get('/', (req: Request, res: Response) => {
  const issuances = db.prepare(`
    SELECT iss.*,
      (SELECT COUNT(*) FROM issuance_items WHERE issuance_id = iss.id) as item_count,
      (SELECT SUM(quantity) FROM issuance_items WHERE issuance_id = iss.id) as total_qty
    FROM issuances iss
    WHERE iss.bunker_id = ?
    ORDER BY iss.created_at DESC
  `).all(req.params.id);
  res.json(issuances);
});

// POST /api/bunkers/:id/issuances — multipart: image + JSON fields
router.post('/', upload.single('form_image'), (req: Request, res: Response) => {
  const { recipient_name, recipient_id, unit_name, issue_date, notes, items, linked_bunker_id } = req.body as {
    recipient_name?: string; recipient_id?: string; unit_name?: string;
    issue_date?: string; notes?: string; items: string; linked_bunker_id?: string;
  };

  const bunkerExists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!bunkerExists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  // Validate linked bunker if provided
  let linkedBunkerId: number | null = null;
  if (linked_bunker_id) {
    linkedBunkerId = Number(linked_bunker_id);
    const linkedBunkerExists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(linkedBunkerId);
    if (!linkedBunkerExists) return res.status(404).json({ error: 'בונקר יעד לא נמצא' });
    if (linkedBunkerId === Number(req.params.id)) return res.status(400).json({ error: 'לא ניתן לקשור הנפקה לאותו בונקר' });
  }

  interface IssuanceItemInput {
    ammo_type_id: number; quantity: number;
    batch_details?: Array<{ batch_number: string; quantity: number }>;
    serial_numbers?: string[];
  }
  let parsedItems: IssuanceItemInput[] = [];
  try { parsedItems = JSON.parse(items || '[]'); }
  catch { return res.status(400).json({ error: 'פורמט items לא תקין' }); }

  if (!parsedItems.length) return res.status(400).json({ error: 'חובה לכלול לפחות פריט אחד' });

  // Validate stock
  for (const item of parsedItems) {
    if (item.quantity <= 0) continue;
    const stock = db.prepare('SELECT quantity FROM inventory WHERE bunker_id=? AND ammo_type_id=?')
      .get(req.params.id, item.ammo_type_id) as { quantity: number } | undefined;
    if ((stock?.quantity ?? 0) < item.quantity) {
      const name = (db.prepare('SELECT name FROM ammo_types WHERE id=?').get(item.ammo_type_id) as { name: string } | undefined)?.name ?? '';
      return res.status(400).json({ error: `אין מספיק מלאי עבור "${name}"` });
    }
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const issuanceId = runInTransaction(() => {
    const result = db.prepare(`
      INSERT INTO issuances (bunker_id, linked_bunker_id, recipient_name, recipient_id, unit_name, issue_date, form_image_path, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, linkedBunkerId||null, recipient_name||null, recipient_id||null,
           unit_name||null, issue_date||null, imagePath, notes||null);

    const issId = result.lastInsertRowid;

    for (const item of parsedItems) {
      if (item.quantity <= 0) continue;

      const itemRes = db.prepare(
        'INSERT INTO issuance_items (issuance_id, ammo_type_id, quantity) VALUES (?, ?, ?)'
      ).run(issId, item.ammo_type_id, item.quantity);
      const itemRowId = itemRes.lastInsertRowid;

      const { tracking_type } = (db.prepare('SELECT tracking_type FROM ammo_types WHERE id=?')
        .get(item.ammo_type_id) as { tracking_type: string } | undefined) ?? { tracking_type: 'qty' };

      // Deduct from source bunker
      db.prepare(`
        INSERT INTO inventory (bunker_id, ammo_type_id, quantity, updated_at)
        VALUES (?, ?, 0, datetime('now','localtime'))
        ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET
          quantity = MAX(0, quantity - ?), updated_at = datetime('now','localtime')
      `).run(req.params.id, item.ammo_type_id, item.quantity);

      db.prepare(
        "INSERT INTO inventory_entries (bunker_id,ammo_type_id,quantity_delta,entry_type,notes) VALUES(?,?,?,'issuance',?)"
      ).run(req.params.id, item.ammo_type_id, -item.quantity, `הנפקה #${issId}`);

      // If linked to another bunker, add inventory to destination
      if (linkedBunkerId) {
        db.prepare(`
          INSERT INTO inventory (bunker_id, ammo_type_id, quantity, updated_at)
          VALUES (?, ?, ?, datetime('now','localtime'))
          ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET
            quantity = quantity + ?, updated_at = datetime('now','localtime')
        `).run(linkedBunkerId, item.ammo_type_id, item.quantity, item.quantity);

        db.prepare(
          "INSERT INTO inventory_entries (bunker_id,ammo_type_id,quantity_delta,entry_type,notes) VALUES(?,?,?,'inter_bunker_transfer',?)"
        ).run(linkedBunkerId, item.ammo_type_id, item.quantity, `קבלה מהנפקה #${issId}`);
      }

      if (tracking_type === 'batch' && item.batch_details?.length) {
        const ins = db.prepare('INSERT INTO issuance_item_batches (issuance_item_id,batch_number,quantity) VALUES (?,?,?)');
        const deduct = db.prepare('UPDATE inventory_batches SET quantity=MAX(0,quantity-?) WHERE bunker_id=? AND ammo_type_id=? AND batch_number=?');
        for (const bd of item.batch_details) {
          if (bd.quantity > 0) { deduct.run(bd.quantity, req.params.id, item.ammo_type_id, bd.batch_number); ins.run(itemRowId, bd.batch_number, bd.quantity); }
        }
        db.prepare('DELETE FROM inventory_batches WHERE bunker_id=? AND ammo_type_id=? AND quantity<=0').run(req.params.id, item.ammo_type_id);
      }

      if (tracking_type === 'serial' && item.serial_numbers?.length) {
        const mark = db.prepare("UPDATE inventory_serials SET status='issued', issuance_id=? WHERE bunker_id=? AND ammo_type_id=? AND serial_number=?");
        for (const sn of item.serial_numbers) mark.run(issId, req.params.id, item.ammo_type_id, sn);
        const cnt = db.prepare("SELECT COUNT(*) as c FROM inventory_serials WHERE bunker_id=? AND ammo_type_id=? AND status='in_stock'")
          .get(req.params.id, item.ammo_type_id) as { c: number };
        db.prepare("UPDATE inventory SET quantity=?,updated_at=datetime('now','localtime') WHERE bunker_id=? AND ammo_type_id=?")
          .run(cnt.c, req.params.id, item.ammo_type_id);
      }
    }
    return issId;
  });

  res.status(201).json(db.prepare('SELECT * FROM issuances WHERE id=?').get(issuanceId));
});

// GET /api/bunkers/:id/issuances/:issuanceId
router.get('/:issuanceId', (req: Request, res: Response) => {
  const issuance = db.prepare(
    'SELECT * FROM issuances WHERE id = ? AND bunker_id = ?'
  ).get(req.params.issuanceId, req.params.id);

  if (!issuance) return res.status(404).json({ error: 'הנפקה לא נמצאה' });

  const items = db.prepare(`
    SELECT ii.*, at.name as ammo_name, at.unit, at.category, at.tracking_type
    FROM issuance_items ii
    JOIN ammo_types at ON at.id = ii.ammo_type_id
    WHERE ii.issuance_id = ?
    ORDER BY at.category, at.name
  `).all(req.params.issuanceId) as Array<{ id: number; tracking_type: string }>;

  // Attach batch details for batch-type items
  const itemsWithDetails = items.map(item => {
    if (item.tracking_type === 'batch') {
      const batchDetails = db.prepare(
        'SELECT * FROM issuance_item_batches WHERE issuance_item_id = ? ORDER BY batch_number'
      ).all(item.id);
      return { ...item, batch_details: batchDetails };
    }
    if (item.tracking_type === 'serial') {
      const serials = db.prepare(
        'SELECT serial_number FROM inventory_serials WHERE issuance_id = ? AND ammo_type_id = ? ORDER BY serial_number'
      ).all(req.params.issuanceId, (item as unknown as { ammo_type_id: number }).ammo_type_id);
      return { ...item, serial_numbers: serials.map((s: unknown) => (s as { serial_number: string }).serial_number) };
    }
    return item;
  });

  res.json({ ...(issuance as object), items: itemsWithDetails });
});

// PUT /api/bunkers/:id/issuances/:issuanceId — update metadata and optionally item quantities
router.put('/:issuanceId', upload.single('form_image'), (req: Request, res: Response) => {
  const { recipient_name, recipient_id, unit_name, issue_date, notes, items } = req.body as {
    recipient_name?: string; recipient_id?: string; unit_name?: string;
    issue_date?: string; notes?: string; items?: string;
  };

  const issuance = db.prepare(
    'SELECT * FROM issuances WHERE id = ? AND bunker_id = ?'
  ).get(req.params.issuanceId, req.params.id) as { id: number; bunker_id: number; form_image_path: string | null } | undefined;

  if (!issuance) return res.status(404).json({ error: 'הנפקה לא נמצאה' });

  interface ItemUpdate { issuance_item_id: number; new_quantity: number }
  let parsedItemUpdates: ItemUpdate[] = [];
  if (items) {
    try { parsedItemUpdates = JSON.parse(items); }
    catch { return res.status(400).json({ error: 'פורמט items לא תקין' }); }
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : (issuance.form_image_path ?? null);

  runInTransaction(() => {
    // Update metadata
    db.prepare(`
      UPDATE issuances SET
        recipient_name = COALESCE(?, recipient_name),
        recipient_id   = COALESCE(?, recipient_id),
        unit_name      = COALESCE(?, unit_name),
        issue_date     = COALESCE(?, issue_date),
        notes          = ?,
        form_image_path = ?
      WHERE id = ?
    `).run(
      recipient_name ?? null, recipient_id ?? null,
      unit_name ?? null, issue_date ?? null,
      notes ?? null, imagePath,
      req.params.issuanceId
    );

    // Update item quantities if provided
    for (const upd of parsedItemUpdates) {
      const oldItem = db.prepare(
        'SELECT ii.quantity, ii.ammo_type_id FROM issuance_items ii WHERE ii.id = ? AND ii.issuance_id = ?'
      ).get(upd.issuance_item_id, req.params.issuanceId) as { quantity: number; ammo_type_id: number } | undefined;

      if (!oldItem || upd.new_quantity < 0) continue;

      const delta = upd.new_quantity - oldItem.quantity; // positive = need more stock, negative = return stock

      // Adjust inventory
      db.prepare(`
        INSERT INTO inventory (bunker_id, ammo_type_id, quantity, updated_at)
        VALUES (?, ?, MAX(0, ?), datetime('now','localtime'))
        ON CONFLICT(bunker_id, ammo_type_id) DO UPDATE SET
          quantity = MAX(0, inventory.quantity + ?),
          updated_at = datetime('now','localtime')
      `).run(req.params.id, oldItem.ammo_type_id, -delta, -delta);

      if (delta !== 0) {
        db.prepare(
          "INSERT INTO inventory_entries (bunker_id, ammo_type_id, quantity_delta, entry_type, notes) VALUES (?, ?, ?, 'issuance', ?)"
        ).run(req.params.id, oldItem.ammo_type_id, -delta, `תיקון הנפקה #${req.params.issuanceId}`);
      }

      // Update item quantity
      db.prepare('UPDATE issuance_items SET quantity = ? WHERE id = ?')
        .run(upd.new_quantity, upd.issuance_item_id);
    }
  });

  const updated = db.prepare('SELECT * FROM issuances WHERE id = ?').get(req.params.issuanceId);
  res.json(updated);
});

export default router;
