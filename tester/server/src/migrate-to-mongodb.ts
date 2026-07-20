/**
 * Migration script: SQLite → MongoDB
 * Usage: npx ts-node src/migrate-to-mongodb.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
import mongoose from 'mongoose';
import path from 'path';
import * as models from './db/mongo';

const MONGODB_URI = process.env.MONGODB_URI;
const DB_PATH = path.join(__dirname, '../../data/bonker.db');

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

    // Migrate Units
    console.log('📤 Migrating Units...');
    const units = db.prepare('SELECT * FROM units').all() as any[];
    for (const unit of units) {
      await models.Unit.updateOne(
        { _id: unit.id },
        {
          _id: unit.id,
          name: unit.name,
          parent_unit_id: unit.parent_unit_id,
          type: unit.type || 'battalion',
          description: unit.description,
          created_at: unit.created_at ? new Date(unit.created_at) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${units.length} units`);

    // Migrate Bunkers
    console.log('📤 Migrating Bunkers...');
    const bunkers = db.prepare('SELECT * FROM bunkers').all() as any[];
    for (const bunker of bunkers) {
      await models.Bunker.updateOne(
        { _id: bunker.id },
        {
          _id: bunker.id,
          name: bunker.name,
          location: bunker.location,
          description: bunker.description,
          created_at: bunker.created_at ? new Date(bunker.created_at) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${bunkers.length} bunkers`);

    // Migrate Ammo Types
    console.log('📤 Migrating Ammo Types...');
    const ammoTypes = db.prepare('SELECT * FROM ammo_types').all() as any[];
    for (const type of ammoTypes) {
      await models.AmmoType.updateOne(
        { _id: type.id },
        {
          _id: type.id,
          name: type.name,
          category: type.category || 'תחמושת',
          caliber: type.unit || 'יח',
          created_at: type.created_at ? new Date(type.created_at) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${ammoTypes.length} ammo types`);

    // Migrate Inventory
    console.log('📤 Migrating Inventory...');
    const inventory = db.prepare('SELECT * FROM inventory').all() as any[];
    for (const inv of inventory) {
      await models.Inventory.updateOne(
        { _id: inv.id },
        {
          _id: inv.id,
          bunker_id: inv.bunker_id,
          ammo_type_id: inv.ammo_type_id,
          quantity: inv.quantity,
          unit: inv.unit,
          lastUpdated: inv.last_updated ? new Date(inv.last_updated) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${inventory.length} inventory records`);

    // Migrate Issuances
    console.log('📤 Migrating Issuances...');
    const issuances = db.prepare('SELECT * FROM issuances').all() as any[];
    for (const issue of issuances) {
      await models.Issuance.updateOne(
        { _id: issue.id },
        {
          _id: issue.id,
          date: issue.date ? new Date(issue.date) : new Date(),
          recipient: issue.recipient,
          note: issue.note,
          created_at: issue.created_at ? new Date(issue.created_at) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${issuances.length} issuances`);

    // Migrate Bunker Standards
    console.log('📤 Migrating Bunker Standards...');
    const standards = db.prepare('SELECT * FROM bunker_standards').all() as any[];
    for (const std of standards) {
      await models.BunkerStandard.updateOne(
        { _id: std.id },
        {
          _id: std.id,
          bunker_id: std.bunker_id,
          ammo_type_id: std.ammo_type_id,
          required_qty: std.required_qty,
          created_at: std.created_at ? new Date(std.created_at) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${standards.length} bunker standards`);

    // Close connections
    db.close();
    await mongoose.disconnect();

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
