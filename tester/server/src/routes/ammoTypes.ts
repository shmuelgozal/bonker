import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/ammo-types
router.get('/', (_req: Request, res: Response) => {
  const types = db.prepare(
    'SELECT * FROM ammo_types ORDER BY category, name'
  ).all();
  res.json(types);
});

// POST /api/ammo-types
router.post('/', (req: Request, res: Response) => {
  const { name, unit, category, tracking_type } = req.body as { name: string; unit?: string; category?: string; tracking_type?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: 'שם הפריט הוא שדה חובה' });
  }
  const result = db.prepare(
    "INSERT INTO ammo_types (name, unit, category, tracking_type) VALUES (?, ?, ?, ?)"
  ).run(name.trim(), unit?.trim() || "יח'", category?.trim() || 'תחמושת', tracking_type?.trim() || 'qty');

  const ammoType = db.prepare('SELECT * FROM ammo_types WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(ammoType);
});

// PUT /api/ammo-types/:id
router.put('/:id', (req: Request, res: Response) => {
  const { name, unit, category, tracking_type } = req.body as { name: string; unit?: string; category?: string; tracking_type?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: 'שם הפריט הוא שדה חובה' });
  }
  const exists = db.prepare('SELECT id FROM ammo_types WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'פריט לא נמצא' });

  db.prepare(
    'UPDATE ammo_types SET name = ?, unit = ?, category = ?, tracking_type = ? WHERE id = ?'
  ).run(name.trim(), unit?.trim() || "יח'", category?.trim() || 'תחמושת', tracking_type?.trim() || 'qty', req.params.id);

  const ammoType = db.prepare('SELECT * FROM ammo_types WHERE id = ?').get(req.params.id);
  res.json(ammoType);
});

// DELETE /api/ammo-types/:id
router.delete('/:id', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT id FROM ammo_types WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'פריט לא נמצא' });

  // Check if in use
  const inUse = db.prepare(
    'SELECT COUNT(*) as cnt FROM inventory_entries WHERE ammo_type_id = ?'
  ).get(req.params.id) as { cnt: number };
  if (inUse.cnt > 0) {
    return res.status(400).json({ error: 'לא ניתן למחוק פריט שנמצא בשימוש' });
  }

  db.prepare('DELETE FROM ammo_types WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
