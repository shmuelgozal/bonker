import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// GET /api/bunkers
router.get('/', (_req: Request, res: Response) => {
  const bunkers = db.prepare(`
    SELECT b.*,
      u.name as unit_name,
      u.type as unit_type,
      (SELECT COUNT(DISTINCT ammo_type_id) FROM inventory WHERE bunker_id = b.id AND quantity > 0) as stocked_types,
      (SELECT COUNT(*) FROM issuances WHERE bunker_id = b.id) as issuance_count
    FROM bunkers b
    LEFT JOIN units u ON b.unit_id = u.id
    ORDER BY b.created_at DESC
  `).all();
  res.json(bunkers);
});

// POST /api/bunkers
router.post('/', (req: Request, res: Response) => {
  const { name, location, description, unit_id } = req.body as { name: string; location?: string; description?: string; unit_id?: number | null };
  if (!name?.trim()) {
    return res.status(400).json({ error: 'שם הבונקר הוא שדה חובה' });
  }
  const result = db.prepare(
    'INSERT INTO bunkers (name, location, description, unit_id) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), location?.trim() || null, description?.trim() || null, unit_id || null);

  const bunker = db.prepare('SELECT * FROM bunkers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(bunker);
});

// GET /api/bunkers/:id
router.get('/:id', (req: Request, res: Response) => {
  const bunker = db.prepare(`
    SELECT b.*, u.name as unit_name, u.type as unit_type
    FROM bunkers b
    LEFT JOIN units u ON b.unit_id = u.id
    WHERE b.id = ?
  `).get(req.params.id);
  if (!bunker) return res.status(404).json({ error: 'בונקר לא נמצא' });
  res.json(bunker);
});

// PUT /api/bunkers/:id/link-unit - Link or unlink a bunker to/from a unit
router.put('/:id/link-unit', (req: Request, res: Response) => {
  const { unit_id } = req.body as { unit_id: number | null };
  const exists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  if (unit_id !== null && unit_id !== undefined) {
    const unitExists = db.prepare('SELECT id FROM units WHERE id = ?').get(unit_id);
    if (!unitExists) return res.status(404).json({ error: 'יחידה לא נמצאה' });
  }

  db.prepare('UPDATE bunkers SET unit_id = ? WHERE id = ?').run(unit_id ?? null, req.params.id);
  const bunker = db.prepare(`
    SELECT b.*, u.name as unit_name, u.type as unit_type
    FROM bunkers b LEFT JOIN units u ON b.unit_id = u.id
    WHERE b.id = ?
  `).get(req.params.id);
  res.json(bunker);
});

// PUT /api/bunkers/:id
router.put('/:id', (req: Request, res: Response) => {
  const { name, location, description } = req.body as { name: string; location?: string; description?: string };
  if (!name?.trim()) {
    return res.status(400).json({ error: 'שם הבונקר הוא שדה חובה' });
  }
  const exists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  db.prepare(
    'UPDATE bunkers SET name = ?, location = ?, description = ? WHERE id = ?'
  ).run(name.trim(), location?.trim() || null, description?.trim() || null, req.params.id);

  const bunker = db.prepare(`
    SELECT b.*, u.name as unit_name, u.type as unit_type
    FROM bunkers b LEFT JOIN units u ON b.unit_id = u.id
    WHERE b.id = ?
  `).get(req.params.id);
  res.json(bunker);
});

// DELETE /api/bunkers/:id
router.delete('/:id', (req: Request, res: Response) => {
  const exists = db.prepare('SELECT id FROM bunkers WHERE id = ?').get(req.params.id);
  if (!exists) return res.status(404).json({ error: 'בונקר לא נמצא' });

  db.prepare('DELETE FROM bunkers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
