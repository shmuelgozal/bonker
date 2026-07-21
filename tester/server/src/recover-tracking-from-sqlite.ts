import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { Bunker, AmmoType, InventoryBatch, InventorySerial } from './db/mongo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PATH = path.join(__dirname, '../data/bonker.db');

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function recoverTrackingData() {
  const db = new DatabaseSync(DB_PATH);

  try {
    await mongoose.connect(MONGODB_URI as string);

    const normalizeName = (s: string) =>
      s
        .replace(/["'׳״`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const bunkerAliases: Record<string, string> = {
      'חפק מגד פרו': 'מפגד - חפק',
      'בונקר פלוגתי': 'פל א - בונקר',
      'חפק פואה': 'פל א - חפק',
      'סיור פואה': 'פל א - סיור',
      'כיתת כוננות פואה': 'פל א - כיתת כוננות',
    };

    const mongoBunkers = await Bunker.find().lean();
    const mongoAmmoTypes = await AmmoType.find().lean();

    const bunkerByName = new Map(mongoBunkers.map(b => [normalizeName(String(b.name)), String(b._id)]));
    const ammoByName = new Map(mongoAmmoTypes.map(a => [normalizeName(String(a.name)), String(a._id)]));

    const sqliteBatches = db.prepare(`
      SELECT b.name AS bunker_name, a.name AS ammo_name, ib.batch_number, ib.quantity, ib.created_at
      FROM inventory_batches ib
      JOIN bunkers b ON b.id = ib.bunker_id
      JOIN ammo_types a ON a.id = ib.ammo_type_id
    `).all() as Array<{ bunker_name: string; ammo_name: string; batch_number: string; quantity: number; created_at?: string }>;

    const sqliteSerials = db.prepare(`
      SELECT b.name AS bunker_name, a.name AS ammo_name, s.serial_number, s.status, s.created_at
      FROM inventory_serials s
      JOIN bunkers b ON b.id = s.bunker_id
      JOIN ammo_types a ON a.id = s.ammo_type_id
    `).all() as Array<{ bunker_name: string; ammo_name: string; serial_number: string; status?: string; created_at?: string }>;

    let batchesUpserted = 0;
    let serialsUpserted = 0;
    const missingRefs = new Set<string>();

    for (const row of sqliteBatches) {
      const sourceBunkerName = normalizeName(row.bunker_name || '');
      const aliasedBunkerName = bunkerAliases[sourceBunkerName] || sourceBunkerName;
      const bunkerId = bunkerByName.get(aliasedBunkerName);
      const ammoId = ammoByName.get(normalizeName(row.ammo_name || ''));
      if (!bunkerId || !ammoId) {
        missingRefs.add(`batch:${row.bunker_name}|${row.ammo_name}`);
        continue;
      }

      await InventoryBatch.updateOne(
        { bunker_id: bunkerId, ammo_type_id: ammoId, batch_number: row.batch_number },
        {
          $set: {
            quantity: Number(row.quantity || 0),
            created_at: row.created_at ? new Date(row.created_at) : new Date(),
          },
        },
        { upsert: true }
      );
      batchesUpserted++;
    }

    for (const row of sqliteSerials) {
      const sourceBunkerName = normalizeName(row.bunker_name || '');
      const aliasedBunkerName = bunkerAliases[sourceBunkerName] || sourceBunkerName;
      const bunkerId = bunkerByName.get(aliasedBunkerName);
      const ammoId = ammoByName.get(normalizeName(row.ammo_name || ''));
      if (!bunkerId || !ammoId) {
        missingRefs.add(`serial:${row.bunker_name}|${row.ammo_name}`);
        continue;
      }

      await InventorySerial.updateOne(
        { bunker_id: bunkerId, ammo_type_id: ammoId, serial_number: row.serial_number },
        {
          $set: {
            status: row.status || 'in_stock',
            created_at: row.created_at ? new Date(row.created_at) : new Date(),
          },
        },
        { upsert: true }
      );
      serialsUpserted++;
    }

    const mongoBatchCount = await InventoryBatch.countDocuments();
    const mongoSerialCount = await InventorySerial.countDocuments();

    console.log('Recovery complete');
    console.log(`SQLite rows -> batches: ${sqliteBatches.length}, serials: ${sqliteSerials.length}`);
    console.log(`Upserted -> batches: ${batchesUpserted}, serials: ${serialsUpserted}`);
    console.log(`Mongo totals -> batches: ${mongoBatchCount}, serials: ${mongoSerialCount}`);

    if (missingRefs.size > 0) {
      console.log('Unmatched bunker/ammo references:');
      for (const m of missingRefs) console.log(`  - ${m}`);
    }
  } catch (error) {
    console.error('Failed to recover tracking data:', error);
    process.exitCode = 1;
  } finally {
    db.close();
    await mongoose.disconnect();
  }
}

recoverTrackingData();
