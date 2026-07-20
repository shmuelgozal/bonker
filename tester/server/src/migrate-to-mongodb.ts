/**
 * Migration script: SQLite → MongoDB with full foreign key mapping
 * Usage: npx ts-node src/migrate-to-mongodb.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env file (one level up from src/)
dotenv.config({ path: path.join(__dirname, '../.env') });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
import mongoose from 'mongoose';
import * as models from './db/mongo';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PATH = path.join(__dirname, '../data/bonker.db');

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable not set');
  process.exit(1);
}

async function migrate() {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    // Open SQLite database
    console.log('📖 Opening SQLite database...');
    const db = new DatabaseSync(DB_PATH);

    // Maps: old SQLite IDs → new MongoDB ObjectIds
    const unitMap = new Map<number, string>();
    const bunkerMap = new Map<number, string>();
    const ammoTypeMap = new Map<number, string>();

    // Migrate Units
    console.log('📤 Migrating Units...');
    const units = db.prepare('SELECT * FROM units').all() as any[];
    for (const unit of units) {
      const created = await models.Unit.create({
        name: unit.name,
        type: unit.type || 'battalion',
        description: unit.description,
        created_at: unit.created_at ? new Date(unit.created_at) : new Date(),
      });
      unitMap.set(unit.id, (created._id as any).toString());
    }
    console.log(`  ✅ Migrated ${units.length} units`);

    // Migrate Bunkers
    console.log('📤 Migrating Bunkers...');
    const bunkers = db.prepare('SELECT * FROM bunkers').all() as any[];
    for (const bunker of bunkers) {
      const created = await models.Bunker.create({
        name: bunker.name,
        location: bunker.location,
        description: bunker.description,
        created_at: bunker.created_at ? new Date(bunker.created_at) : new Date(),
      });
      bunkerMap.set(bunker.id, (created._id as any).toString());
    }
    console.log(`  ✅ Migrated ${bunkers.length} bunkers`);

    // Migrate Ammo Types
    console.log('📤 Migrating Ammo Types...');
    const ammoTypes = db.prepare('SELECT * FROM ammo_types').all() as any[];
    for (const type of ammoTypes) {
      const created = await models.AmmoType.create({
        name: type.name,
        category: type.category || 'תחמושת',
        unit: type.unit || 'יח',
        tracking_type: type.tracking_type || 'qty',
        created_at: type.created_at ? new Date(type.created_at) : new Date(),
      });
      ammoTypeMap.set(type.id, (created._id as any).toString());
    }
    console.log(`  ✅ Migrated ${ammoTypes.length} ammo types`);

    // Migrate Inventory
    console.log('📤 Migrating Inventory...');
    const inventory = db.prepare('SELECT * FROM inventory').all() as any[];
    let inventoryMigrated = 0;
    for (const inv of inventory) {
      const bunkerId = bunkerMap.get(inv.bunker_id);
      const ammoId = ammoTypeMap.get(inv.ammo_type_id);
      if (bunkerId && ammoId) {
        await models.Inventory.create({
          bunker_id: bunkerId,
          ammo_type_id: ammoId,
          quantity: inv.quantity || 0,
          updated_at: inv.updated_at ? new Date(inv.updated_at) : new Date(),
        });
        inventoryMigrated++;
      }
    }
    console.log(`  ✅ Migrated ${inventoryMigrated}/${inventory.length} inventory records`);

    // Migrate Bunker Standards
    console.log('📤 Migrating Bunker Standards...');
    const standards = db.prepare('SELECT * FROM bunker_standards').all() as any[];
    let standardsMigrated = 0;
    for (const std of standards) {
      const bunkerId = bunkerMap.get(std.bunker_id);
      const ammoId = ammoTypeMap.get(std.ammo_type_id);
      if (bunkerId && ammoId) {
        await models.BunkerStandard.create({
          bunker_id: bunkerId,
          ammo_type_id: ammoId,
          required_qty: std.required_qty || 0,
        });
        standardsMigrated++;
      }
    }
    console.log(`  ✅ Migrated ${standardsMigrated}/${standards.length} bunker standards`);

    // Migrate Issuances
    console.log('📤 Migrating Issuances...');
    const issuances = db.prepare('SELECT * FROM issuances').all() as any[];
    let issuancesMigrated = 0;
    for (const iss of issuances) {
      const bunkerId = bunkerMap.get(iss.bunker_id);
      if (bunkerId) {
        const created = await models.Issuance.create({
          bunker_id: bunkerId,
          issue_date: iss.issue_date ? new Date(iss.issue_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          recipient_name: iss.recipient_name || '',
          recipient_id: iss.recipient_id || '',
          unit_name: iss.unit_name || '',
          notes: iss.notes || '',
          created_at: iss.created_at ? new Date(iss.created_at) : new Date(),
        });

        // Migrate Issuance Items
        const items = db.prepare('SELECT * FROM issuance_items WHERE issuance_id = ?').all(iss.id) as any[];
        for (const item of items) {
          const ammoId = ammoTypeMap.get(item.ammo_type_id);
          if (ammoId) {
            await models.IssuanceItem.create({
              issuance_id: (created._id as any).toString(),
              ammo_type_id: ammoId,
              quantity: item.quantity || 0,
            });
          }
        }
        issuancesMigrated++;
      }
    }
    console.log(`  ✅ Migrated ${issuancesMigrated}/${issuances.length} issuances`);

    // Close connections
    db.close();
    await mongoose.disconnect();

    console.log('\n✅ Migration completed successfully!');
    console.log(`   Units: ${units.length} | Bunkers: ${bunkers.length} | Ammo Types: ${ammoTypes.length}`);
    console.log(`   Inventory: ${inventoryMigrated}/${inventory.length} | Standards: ${standardsMigrated}/${standards.length} | Issuances: ${issuancesMigrated}/${issuances.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
