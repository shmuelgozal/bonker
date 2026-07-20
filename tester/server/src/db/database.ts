// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'bonker.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// Transaction helper (node:sqlite has no db.transaction() helper)
export function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ignore rollback error */ }
    throw e;
  }
}

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'battalion',
      parent_unit_id INTEGER,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (parent_unit_id) REFERENCES units(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storage_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL UNIQUE,
      location_type TEXT NOT NULL,
      location_details TEXT,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bunkers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS ammo_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT DEFAULT 'יח',
      category TEXT DEFAULT 'תחמושת',
      tracking_type TEXT DEFAULT 'qty',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS bunker_standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      required_qty INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE,
      UNIQUE(bunker_id, ammo_type_id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE,
      UNIQUE(bunker_id, ammo_type_id)
    );

    CREATE TABLE IF NOT EXISTS inventory_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      quantity_delta INTEGER NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'add',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      count_date TEXT DEFAULT (date('now','localtime')),
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_count_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      count_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      counted_qty INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (count_id) REFERENCES inventory_counts(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE,
      UNIQUE(count_id, ammo_type_id)
    );

    CREATE TABLE IF NOT EXISTS issuances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      linked_bunker_id INTEGER,
      recipient_name TEXT,
      recipient_id TEXT,
      unit_name TEXT,
      issue_date TEXT DEFAULT (date('now','localtime')),
      form_image_path TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_bunker_id) REFERENCES bunkers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS issuance_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issuance_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (issuance_id) REFERENCES issuances(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE,
      UNIQUE(bunker_id, ammo_type_id, batch_number)
    );

    CREATE TABLE IF NOT EXISTS inventory_serials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bunker_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      serial_number TEXT NOT NULL,
      status TEXT DEFAULT 'in_stock',
      issuance_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (bunker_id) REFERENCES bunkers(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE,
      UNIQUE(bunker_id, ammo_type_id, serial_number)
    );

    CREATE TABLE IF NOT EXISTS issuance_item_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issuance_item_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (issuance_item_id) REFERENCES issuance_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_unit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE,
      UNIQUE(unit_id, ammo_type_id)
    );

    CREATE TABLE IF NOT EXISTS issuances_unit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL,
      recipient_name TEXT,
      recipient_id TEXT,
      unit_name TEXT,
      issue_date TEXT DEFAULT (date('now','localtime')),
      form_image_path TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS issuance_items_unit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issuance_id INTEGER NOT NULL,
      ammo_type_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (issuance_id) REFERENCES issuances_unit(id) ON DELETE CASCADE,
      FOREIGN KEY (ammo_type_id) REFERENCES ammo_types(id) ON DELETE CASCADE
    );
  `);

  seedAmmoTypes();
  runMigrations();
}

// Handles schema updates for existing databases
function runMigrations(): void {
  // Add tracking_type column to ammo_types if it doesn't exist
  try {
    db.exec("ALTER TABLE ammo_types ADD COLUMN tracking_type TEXT DEFAULT 'qty'");
  } catch { /* column already exists */ }

  // Set known tracking types for seeded items
  db.prepare("UPDATE ammo_types SET tracking_type = 'batch' WHERE name = 'רימון הלם' AND tracking_type = 'qty'").run();
  db.prepare("UPDATE ammo_types SET tracking_type = 'batch' WHERE name = ? AND tracking_type = 'qty'").run("רימון רסס מ'ס 26");
  db.prepare("UPDATE ammo_types SET tracking_type = 'serial' WHERE name = 'לאו' AND tracking_type = 'qty'").run();

  // Add unit_id column to bunkers if not exists
  try {
    db.exec("ALTER TABLE bunkers ADD COLUMN unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL");
  } catch { /* column already exists */ }

  // Add linked_bunker_id column to issuances if not exists
  try {
    db.exec("ALTER TABLE issuances ADD COLUMN linked_bunker_id INTEGER REFERENCES bunkers(id) ON DELETE SET NULL");
  } catch { /* column already exists */ }
}

function seedAmmoTypes(): void {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM ammo_types').get() as { cnt: number } | undefined;
  if ((row?.cnt ?? 0) > 0) return;

  const insert = db.prepare(
    'INSERT INTO ammo_types (name, unit, category, tracking_type) VALUES (?, ?, ?, ?)'
  );

  runInTransaction(() => {
    const items: Array<{ name: string; unit: string; category: string; tracking_type: string }> = [
    // ציוד
    { name: 'רחפן איבו', unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: 'רחפן מאביק', unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: 'רוגר (הוגר)', unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "כוונת ליאופולד (לרוגר)", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: 'מחסנית מעגלית (לרוגר)', unit: "יח'", category: 'ציוד', tracking_type: 'qty' },
    { name: "רובה רינגו (טפי)", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "מטולון עצמאי", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "התקן מדוכה לריילון גז", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "התקן ר' ומה", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "ערכת פריחה הידראולית", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "זרקור גאמא", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "ערכת יובל", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    { name: "ערכת מלאכי", unit: "יח'", category: 'ציוד', tracking_type: 'serial' },
    // תחמושת
    { name: 'רימון הלם', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: "רימון רסס מ'ס 26", unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'לאו', unit: "יח'", category: 'תחמושת', tracking_type: 'serial' },
    { name: 'יד', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'חולית', unit: "יח'", category: 'תחמושת', tracking_type: 'qty' },
    { name: 'פצצת מטול לפיץ', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'פצצת מטול קלע רך (מטול ספוג)', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'פצצת מטול תאורה', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'פצצת מטול גז', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'פצצת מטול עשן', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: 'רימון גז (למדוכה)', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: "תחמיש 5.56", unit: "כד'", category: 'תחמושת', tracking_type: 'qty' },
    { name: "שלישיות גומי", unit: "יח'", category: 'תחמושת', tracking_type: 'qty' },
    { name: 'רימון עשן', unit: "יח'", category: 'תחמושת', tracking_type: 'batch' },
    { name: "תחמושת כדור 0.22", unit: "כד'", category: 'תחמושת', tracking_type: 'qty' },
    ];
    for (const item of items) {
      insert.run(item.name, item.unit, item.category, item.tracking_type);
    }
  });
}

export default db;
