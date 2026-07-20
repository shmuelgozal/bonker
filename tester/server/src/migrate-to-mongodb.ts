/**
 * Migration script: SQLite → MongoDB
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

    // Migrate Units
    console.log('📤 Migrating Units...');
    const units = db.prepare('SELECT * FROM units').all() as any[];
    for (const unit of units) {
      await models.Unit.create({
        name: unit.name,
        type: unit.type || 'battalion',
        // parent_unit_id skipped - will need to be linked manually if needed
        description: unit.description,
        created_at: unit.created_at ? new Date(unit.created_at) : new Date(),
      });
    }
    console.log(`  ✅ Migrated ${units.length} units`);

    // Migrate Bunkers
    console.log('📤 Migrating Bunkers...');
    const bunkers = db.prepare('SELECT * FROM bunkers').all() as any[];
    for (const bunker of bunkers) {
      await models.Bunker.create({
        name: bunker.name,
        // unit_id skipped - will need to be linked manually if needed
        location: bunker.location,
        description: bunker.description,
        created_at: bunker.created_at ? new Date(bunker.created_at) : new Date(),
      });
    }
    console.log(`  ✅ Migrated ${bunkers.length} bunkers`);

    // Migrate Ammo Types
    console.log('📤 Migrating Ammo Types...');
    const ammoTypes = db.prepare('SELECT * FROM ammo_types').all() as any[];
    for (const type of ammoTypes) {
      await models.AmmoType.create({
        name: type.name,
        category: type.category || 'תחמושת',
        unit: type.unit || 'יח',
        tracking_type: type.tracking_type || 'qty',
        created_at: type.created_at ? new Date(type.created_at) : new Date(),
      });
    }
    console.log(`  ✅ Migrated ${ammoTypes.length} ammo types`);

    // Skip Inventory migration for now - references will need manual linking
    console.log('📤 Skipping Inventory (requires foreign key linking)...');
    const inventoryCount = db.prepare('SELECT COUNT(*) as count FROM inventory').get() as any;
    console.log(`  ⏭️  ${inventoryCount.count} inventory records skipped (can be recreated via API)`);

    // Skip Issuances migration for now - requires bunker references
    console.log('📤 Skipping Issuances (requires foreign key linking)...');
    const issuanceCount = db.prepare('SELECT COUNT(*) as count FROM issuances').get() as any;
    console.log(`  ⏭️  ${issuanceCount.count} issuances skipped (can be recreated via API)`);

    // Skip Bunker Standards migration for now - references will need manual linking
    console.log('📤 Skipping Bunker Standards (requires foreign key linking)...');
    const standardsCount = db.prepare('SELECT COUNT(*) as count FROM bunker_standards').get() as any;
    console.log(`  ⏭️  ${standardsCount.count} bunker standards skipped (can be recreated via API)`);

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
