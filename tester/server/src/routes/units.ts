import { Router, Request, Response } from 'express';
import type { SQLInputValue } from 'node:sqlite';
import db, { runInTransaction } from '../db/database';

const router = Router();

// Types
interface Unit {
  id: number;
  name: string;
  type: string;
  parent_unit_id: number | null;
  description: string | null;
  created_at: string;
}

interface StorageLocation {
  id: number;
  unit_id: number;
  location_type: string;
  location_details: string | null;
}

interface UnitWithChildren extends Unit {
  children: UnitWithChildren[];
  storage_location?: StorageLocation;
}

// GET /api/units - Get all units as a tree
router.get('/', (req: Request, res: Response) => {
  try {
    const units = db
      .prepare('SELECT * FROM units ORDER BY parent_unit_id, created_at')
      .all() as unknown as Unit[];

    const storageLocations = db
      .prepare('SELECT * FROM storage_locations')
      .all() as unknown as StorageLocation[];

    const buildTree = (parentId: number | null = null): UnitWithChildren[] => {
      return units
        .filter((u) => u.parent_unit_id === parentId)
        .map((unit) => {
          const storage = storageLocations.find((s) => s.unit_id === unit.id);
          return {
            ...unit,
            children: buildTree(unit.id),
            storage_location: storage,
          };
        });
    };

    const tree = buildTree();
    res.json(tree);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

// GET /api/units/:id - Get specific unit with full hierarchy info
router.get('/:id', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit | undefined;

    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const storage = db
      .prepare('SELECT * FROM storage_locations WHERE unit_id = ?')
      .get(unitId) as unknown as StorageLocation | undefined;

    const children = db
      .prepare('SELECT * FROM units WHERE parent_unit_id = ? ORDER BY created_at')
      .all(unitId) as unknown as Unit[];

    const parent = unit.parent_unit_id
      ? (db.prepare('SELECT * FROM units WHERE id = ?').get(unit.parent_unit_id) as unknown as Unit | undefined)
      : null;

    res.json({
      ...unit,
      storage_location: storage,
      parent,
      children,
    });
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

// POST /api/units - Create new unit
router.post('/', (req: Request, res: Response) => {
  try {
    console.log('POST /units received body:', JSON.stringify(req.body));
    const { name, type = 'battalion', parent_unit_id = null, description = null } = req.body;

    if (!name?.trim()) {
      console.error('Name is empty or not provided');
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!['battalion', 'company', 'storage_location'].includes(type)) {
      console.error('Invalid type:', type);
      return res.status(400).json({ error: 'Invalid unit type' });
    }

    const desc = typeof description === 'string' ? description.trim() || null : null;
    console.log('Inserting unit:', { name: name.trim(), type, parent_unit_id, description: desc });
    const result = db
      .prepare(
        'INSERT INTO units (name, type, parent_unit_id, description) VALUES (?, ?, ?, ?)'
      )
      .run(name.trim(), type, parent_unit_id, desc);

    console.log('Unit created with ID:', result.lastInsertRowid);
    const unit = db
      .prepare('SELECT * FROM units WHERE id = ?')
      .get(result.lastInsertRowid) as unknown as Unit;

    res.status(201).json(unit);
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Failed to create unit', details: String(error) });
  }
});

// PUT /api/units/:id - Update unit
router.put('/:id', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const { name, type, description, parent_unit_id } = req.body;

    // Check if unit exists
    const existing = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit | undefined;
    if (!existing) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (type !== undefined && ['battalion', 'company', 'storage_location'].includes(type)) {
      updates.push('type = ?');
      values.push(type);
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(typeof description === 'string' ? description.trim() || null : null);
    }

    if (parent_unit_id !== undefined) {
      updates.push('parent_unit_id = ?');
      values.push(parent_unit_id);
    }

    if (updates.length === 0) {
      return res.json(existing);
    }

    values.push(unitId);
    db.prepare(`UPDATE units SET ${updates.join(', ')} WHERE id = ?`).run(...(values as SQLInputValue[]));

    const updated = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit;
    res.json(updated);
  } catch (error) {
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Failed to update unit' });
  }
});

// DELETE /api/units/:id - Delete unit (and all children)
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);

    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit | undefined;
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    // Check if this unit is referenced in inventory or issuances
    const invCount = db
      .prepare('SELECT COUNT(*) as cnt FROM inventory_unit WHERE unit_id = ?')
      .get(unitId) as { cnt: number } | undefined;

    if ((invCount?.cnt ?? 0) > 0) {
      return res.status(409).json({ error: 'Cannot delete unit with inventory' });
    }

    db.prepare('DELETE FROM units WHERE id = ?').run(unitId);
    res.json({ success: true, message: 'Unit deleted' });
  } catch (error) {
    console.error('Error deleting unit:', error);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
});

// POST /api/units/:id/storage - Add storage location to unit
router.post('/:id/storage', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const { location_type, location_details = '' } = req.body;

    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as Unit | undefined;
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }

    if (!['bunker', 'vehicle', 'pillbox'].includes(location_type)) {
      return res.status(400).json({ error: 'Invalid location type' });
    }

    const existing = db
      .prepare('SELECT * FROM storage_locations WHERE unit_id = ?')
      .get(unitId) as unknown as StorageLocation | undefined;

    if (existing) {
      db.prepare(
        'UPDATE storage_locations SET location_type = ?, location_details = ? WHERE unit_id = ?'
      ).run(location_type, location_details || null, unitId);

      const updated = db
        .prepare('SELECT * FROM storage_locations WHERE unit_id = ?')
        .get(unitId) as unknown as StorageLocation;

      return res.json(updated);
    }

    db.prepare('INSERT INTO storage_locations (unit_id, location_type, location_details) VALUES (?, ?, ?)')
      .run(unitId, location_type, location_details || null);

    const storage = db
      .prepare('SELECT * FROM storage_locations WHERE unit_id = ?')
      .get(unitId) as unknown as StorageLocation;

    res.status(201).json(storage);
  } catch (error) {
    console.error('Error adding storage location:', error);
    res.status(500).json({ error: 'Failed to add storage location' });
  }
});

// GET /api/units/:id/storage - Get storage location for unit
router.get('/:id/storage', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);

    const storage = db
      .prepare('SELECT * FROM storage_locations WHERE unit_id = ?')
      .get(unitId) as unknown as StorageLocation | undefined;

    if (!storage) {
      return res.status(404).json({ error: 'Storage location not found for this unit' });
    }

    res.json(storage);
  } catch (error) {
    console.error('Error fetching storage location:', error);
    res.status(500).json({ error: 'Failed to fetch storage location' });
  }
});

// GET /api/units/:id/bunkers - Get bunkers linked to this unit
router.get('/:id/bunkers', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const bunkers = db.prepare(`
      SELECT b.*,
        (SELECT COALESCE(SUM(i.quantity), 0) FROM inventory i WHERE i.bunker_id = b.id) as total_qty
      FROM bunkers b
      WHERE b.unit_id = ?
      ORDER BY b.name
    `).all(unitId) as unknown as any[];
    res.json(bunkers);
  } catch (error) {
    console.error('Error fetching unit bunkers:', error);
    res.status(500).json({ error: 'Failed to fetch unit bunkers' });
  }
});

// POST /api/units/:id/ensure-bunker - Get or create a bunker for this storage location unit
router.post('/:id/ensure-bunker', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit | undefined;
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    // Check if a bunker already exists for this unit
    const existing = db.prepare('SELECT * FROM bunkers WHERE unit_id = ?').get(unitId) as unknown as any;
    if (existing) return res.json(existing);

    // Get storage location details for description
    const storage = db.prepare('SELECT * FROM storage_locations WHERE unit_id = ?').get(unitId) as unknown as any;
    const locType = storage?.location_type || 'storage';
    const locTypeHeb = locType === 'bunker' ? 'בונקר' : locType === 'vehicle' ? 'רכב' : 'מנמ"כ';

    // Create a new bunker linked to this unit
    const result = db.prepare(
      'INSERT INTO bunkers (name, location, description, unit_id) VALUES (?, ?, ?, ?)'
    ).run(
      unit.name,
      storage?.location_details || null,
      `${locTypeHeb} - נוצר אוטומטית ממסגרת`,
      unitId
    );

    const bunker = db.prepare('SELECT * FROM bunkers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(bunker);
  } catch (error) {
    console.error('Error ensuring bunker:', error);
    res.status(500).json({ error: 'Failed to ensure bunker' });
  }
});

// Helper function to recursively get all unit IDs in a unit's subtree
const getAllUnitIds = (unitId: number): number[] => {
  const allIds: number[] = [unitId];
  const children = db.prepare('SELECT id FROM units WHERE parent_unit_id = ?').all(unitId) as unknown as Array<{ id: number }>;
  for (const child of children) {
    allIds.push(...getAllUnitIds(child.id));
  }
  return allIds;
};

// GET /api/units/:id/inventory-summary - Aggregated inventory for all bunkers of a unit (including children)
router.get('/:id/inventory-summary', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit | undefined;
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    // Get all unit IDs in this unit's subtree (including children recursively)
    const unitIds = getAllUnitIds(unitId);

    // Get all bunkers linked to any of these units
    const placeholders = unitIds.map(() => '?').join(',');
    const bunkers = db.prepare(`SELECT id FROM bunkers WHERE unit_id IN (${placeholders})`).all(...unitIds) as unknown as Array<{ id: number }>;
    const bunkerIds = bunkers.map(b => b.id);

    if (bunkerIds.length === 0) {
      return res.json({
        unit_id: unitId,
        unit_name: unit.name,
        bunker_count: 0,
        inventory: []
      });
    }

    // Aggregate inventory from all bunkers
    const bunkerPlaceholders = bunkerIds.map(() => '?').join(',');
    const inventory = db.prepare(`
      SELECT
        at.id as ammo_type_id,
        at.name as ammo_name,
        at.unit,
        at.category,
        SUM(COALESCE(inv.quantity, 0)) as total_qty
      FROM ammo_types at
      LEFT JOIN inventory inv ON inv.ammo_type_id = at.id AND inv.bunker_id IN (${bunkerPlaceholders})
      GROUP BY at.id, at.name, at.unit, at.category
      HAVING SUM(COALESCE(inv.quantity, 0)) > 0
      ORDER BY at.category, at.name
    `).all(...bunkerIds) as unknown as any[];

    res.json({
      unit_id: unitId,
      unit_name: unit.name,
      bunker_count: bunkerIds.length,
      inventory
    });
  } catch (error) {
    console.error('Error fetching unit inventory summary:', error);
    res.status(500).json({ error: 'Failed to fetch unit inventory summary' });
  }
});

// GET /api/units/:id/gaps - Aggregated gaps for all bunkers of a unit (including children)
router.get('/:id/gaps', (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.id);
    const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(unitId) as unknown as Unit | undefined;
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    // Get all unit IDs in this unit's subtree (including children recursively)
    const unitIds = getAllUnitIds(unitId);

    // Get all bunkers linked to any of these units
    const placeholders = unitIds.map(() => '?').join(',');
    const bunkers = db.prepare(`SELECT id FROM bunkers WHERE unit_id IN (${placeholders})`).all(...unitIds) as unknown as Array<{ id: number }>;
    const bunkerIds = bunkers.map(b => b.id);

    if (bunkerIds.length === 0) {
      return res.json({ gaps: [], summary: { total: 0, deficit: 0, ok: 0 } });
    }

    // Aggregate gaps from all bunkers (by ammo type)
    const bunkerPlaceholders = bunkerIds.map(() => '?').join(',');
    const gaps = db.prepare(`
      SELECT
        at.id as ammo_type_id,
        at.name as ammo_name,
        at.unit,
        at.category,
        SUM(COALESCE(bs.required_qty, 0)) as required_qty,
        SUM(COALESCE(inv.quantity, 0)) as current_qty,
        SUM(COALESCE(inv.quantity, 0)) - SUM(COALESCE(bs.required_qty, 0)) as gap
      FROM ammo_types at
      LEFT JOIN bunker_standards bs ON bs.ammo_type_id = at.id AND bs.bunker_id IN (${bunkerPlaceholders})
      LEFT JOIN inventory inv ON inv.ammo_type_id = at.id AND inv.bunker_id IN (${bunkerPlaceholders})
      GROUP BY at.id, at.name, at.unit, at.category
      HAVING SUM(COALESCE(bs.required_qty, 0)) > 0
      ORDER BY gap ASC, at.category, at.name
    `).all(...bunkerIds, ...bunkerIds) as unknown as any[];

    const summary = {
      total: gaps.length,
      deficit: gaps.filter(g => g.gap < 0).length,
      ok: gaps.filter(g => g.gap >= 0).length,
    };

    res.json({ gaps, summary });
  } catch (error) {
    console.error('Error fetching unit gaps:', error);
    res.status(500).json({ error: 'Failed to fetch unit gaps' });
  }
});

export default router;
