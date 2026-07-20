/**
 * Migration script: SQLite → MongoDB
 * Usage: npx ts-node src/migrate-to-mongodb.ts
 */

import Database from 'better-sqlite3';
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
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Open SQLite database
    console.log('📖 Opening SQLite database...');
    const db = new Database(DB_PATH);

    // Migrate Units
    console.log('📤 Migrating Units...');
    const units = db.prepare('SELECT * FROM units').all() as any[];
    for (const unit of units) {
      await models.Unit.updateOne(
        { _id: unit.id },
        {
          _id: unit.id,
          name: unit.name,
          parentId: unit.parentId,
          level: unit.level,
          createdAt: unit.createdAt ? new Date(unit.createdAt) : new Date(),
          updatedAt: unit.updatedAt ? new Date(unit.updatedAt) : new Date(),
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
          unitId: bunker.unitId,
          location: bunker.location,
          capacity: bunker.capacity,
          createdAt: bunker.createdAt ? new Date(bunker.createdAt) : new Date(),
          updatedAt: bunker.updatedAt ? new Date(bunker.updatedAt) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${bunkers.length} bunkers`);

    // Migrate Ammo Types
    console.log('📤 Migrating Ammo Types...');
    const ammoTypes = db.prepare('SELECT * FROM ammoTypes').all() as any[];
    for (const type of ammoTypes) {
      await models.AmmoType.updateOne(
        { _id: type.id },
        {
          _id: type.id,
          name: type.name,
          category: type.category,
          caliber: type.caliber,
          createdAt: type.createdAt ? new Date(type.createdAt) : new Date(),
          updatedAt: type.updatedAt ? new Date(type.updatedAt) : new Date(),
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
          bunkerId: inv.bunkerId,
          ammoTypeId: inv.ammoTypeId,
          quantity: inv.quantity,
          unit: inv.unit,
          lastUpdated: inv.lastUpdated ? new Date(inv.lastUpdated) : new Date(),
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
          createdAt: issue.createdAt ? new Date(issue.createdAt) : new Date(),
        },
        { upsert: true }
      );
    }
    console.log(`  ✅ Migrated ${issuances.length} issuances`);

    // Migrate Bunker Standards
    console.log('📤 Migrating Bunker Standards...');
    const standards = db.prepare('SELECT * FROM bunkerStandards').all() as any[];
    for (const std of standards) {
      await models.BunkerStandard.updateOne(
        { _id: std.id },
        {
          _id: std.id,
          bunkerId: std.bunkerId,
          ammoTypeId: std.ammoTypeId,
          standardQuantity: std.standardQuantity,
          unit: std.unit,
          createdAt: std.createdAt ? new Date(std.createdAt) : new Date(),
          updatedAt: std.updatedAt ? new Date(std.updatedAt) : new Date(),
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
