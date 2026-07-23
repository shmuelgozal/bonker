import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import {
  AmmoType,
  Bunker,
  InventoryBatch,
  InventorySerial,
  Issuance,
  IssuanceItem,
} from './db/mongo';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

type BatchPlanRow = { batch_number: string; quantity: number };

type BatchMap = Record<string, Record<string, number>>;
type SerialMap = Record<string, string[]>;

function parseArgs() {
  const args = process.argv.slice(2);
  const getValue = (name: string): string | undefined => {
    const idx = args.findIndex((a) => a === name);
    if (idx === -1) return undefined;
    return args[idx + 1];
  };

  const issuanceId = getValue('--issuance-id');
  const apply = args.includes('--apply');

  const batchMapRaw = getValue('--batch-map');
  const serialMapRaw = getValue('--serial-map');

  let batchMap: BatchMap = {};
  let serialMap: SerialMap = {};

  if (batchMapRaw) {
    try {
      batchMap = JSON.parse(batchMapRaw) as BatchMap;
    } catch {
      throw new Error('Invalid --batch-map JSON');
    }
  }

  if (serialMapRaw) {
    try {
      serialMap = JSON.parse(serialMapRaw) as SerialMap;
    } catch {
      throw new Error('Invalid --serial-map JSON');
    }
  }

  if (!issuanceId) {
    throw new Error('Missing --issuance-id');
  }

  return { issuanceId, apply, batchMap, serialMap };
}

function normalizeBatchPlan(
  row: Record<string, number> | undefined,
  qtyRequired: number
): BatchPlanRow[] {
  const entries = Object.entries(row || {})
    .map(([batchNumber, qty]) => ({ batch_number: batchNumber.trim(), quantity: Number(qty || 0) }))
    .filter((b) => b.batch_number && b.quantity > 0);

  const total = entries.reduce((sum, b) => sum + b.quantity, 0);
  if (entries.length && total !== qtyRequired) {
    throw new Error(`Batch map quantity mismatch: expected ${qtyRequired}, got ${total}`);
  }

  return entries;
}

function isObjectIdLike(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

async function run() {
  const { issuanceId, apply, batchMap, serialMap } = parseArgs();

  if (!isObjectIdLike(issuanceId)) {
    throw new Error('issuance-id must be a Mongo ObjectId');
  }

  await mongoose.connect(MONGODB_URI as string);

  const session = await mongoose.startSession();

  const dryRunOps: string[] = [];

  try {
    await session.withTransaction(async () => {
      const issuance = await Issuance.findById(issuanceId).session(session);
      if (!issuance) throw new Error(`Issuance not found: ${issuanceId}`);

      if (!issuance.linked_bunker_id) {
        throw new Error('Issuance is not linked to a destination bunker');
      }

      const sourceBunker = await Bunker.findById(issuance.bunker_id).session(session);
      const destBunker = await Bunker.findById(issuance.linked_bunker_id).session(session);
      if (!sourceBunker || !destBunker) {
        throw new Error('Source or destination bunker not found');
      }

      if (destBunker.bunker_type === 'soldiers') {
        throw new Error('This fixer is not for destination bunker type soldiers');
      }

      const items = await IssuanceItem.find({ issuance_id: issuance._id }).session(session);
      if (!items.length) throw new Error('Issuance has no items');

      console.log(`Issuance: ${issuance._id}`);
      console.log(`Source bunker: ${sourceBunker.name} (${sourceBunker._id})`);
      console.log(`Destination bunker: ${destBunker.name} (${destBunker._id})`);
      console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

      for (const item of items) {
        if (item.quantity <= 0) continue;

        const ammoType = await AmmoType.findById(item.ammo_type_id).session(session);
        if (!ammoType) {
          throw new Error(`Ammo type not found: ${item.ammo_type_id}`);
        }

        console.log(`\nItem ${ammoType.name} (${ammoType._id}) | tracking=${ammoType.tracking_type} | qty=${item.quantity}`);

        if (ammoType.tracking_type === 'qty') {
          console.log('  - qty tracking: no fix needed');
          continue;
        }

        if (ammoType.tracking_type === 'batch') {
          const fromMap = normalizeBatchPlan(batchMap[String(ammoType._id)], item.quantity);

          let plan: BatchPlanRow[] = fromMap;

          if (!plan.length) {
            const sourceBatches = await InventoryBatch.find({
              bunker_id: sourceBunker._id,
              ammo_type_id: item.ammo_type_id,
              quantity: { $gt: 0 },
            })
              .sort({ created_at: 1, batch_number: 1 })
              .session(session)
              .lean();

            let remaining = item.quantity;
            plan = [];
            for (const row of sourceBatches) {
              if (remaining <= 0) break;
              const take = Math.min(remaining, row.quantity);
              plan.push({ batch_number: row.batch_number, quantity: take });
              remaining -= take;
            }

            if (remaining > 0) {
              throw new Error(`Not enough source batches for ammo ${ammoType.name}`);
            }
          }

          const planTotal = plan.reduce((sum, p) => sum + p.quantity, 0);
          if (planTotal !== item.quantity) {
            throw new Error(`Batch plan mismatch for ammo ${ammoType.name}: ${planTotal} != ${item.quantity}`);
          }

          for (const row of plan) {
            const sourceBatch = await InventoryBatch.findOne({
              bunker_id: sourceBunker._id,
              ammo_type_id: item.ammo_type_id,
              batch_number: row.batch_number,
            }).session(session);

            if (!sourceBatch || sourceBatch.quantity < row.quantity) {
              throw new Error(`Source batch missing/insufficient: ${row.batch_number} for ammo ${ammoType.name}`);
            }

            dryRunOps.push(
              `BATCH ${ammoType.name}: ${row.quantity} from ${sourceBunker.name}/${row.batch_number} -> ${destBunker.name}/${row.batch_number}`
            );

            if (!apply) continue;

            sourceBatch.quantity -= row.quantity;
            if (sourceBatch.quantity <= 0) {
              await sourceBatch.deleteOne({ session });
            } else {
              await sourceBatch.save({ session });
            }

            const destBatch = await InventoryBatch.findOne({
              bunker_id: destBunker._id,
              ammo_type_id: item.ammo_type_id,
              batch_number: row.batch_number,
            }).session(session);

            if (destBatch) {
              destBatch.quantity += row.quantity;
              await destBatch.save({ session });
            } else {
              await InventoryBatch.create([
                {
                  bunker_id: destBunker._id,
                  ammo_type_id: item.ammo_type_id,
                  batch_number: row.batch_number,
                  quantity: row.quantity,
                  created_at: new Date(),
                },
              ], { session });
            }
          }

          continue;
        }

        if (ammoType.tracking_type === 'serial') {
          const providedSerials = Array.from(
            new Set((serialMap[String(ammoType._id)] || []).map((s) => (s || '').trim()).filter(Boolean))
          );

          let serialsToMove = providedSerials;

          if (!serialsToMove.length) {
            const candidates = await InventorySerial.find({
              bunker_id: sourceBunker._id,
              ammo_type_id: item.ammo_type_id,
              status: 'in_stock',
            })
              .sort({ created_at: 1, serial_number: 1 })
              .limit(item.quantity)
              .session(session)
              .lean();

            if (candidates.length < item.quantity) {
              throw new Error(`Not enough source serials for ammo ${ammoType.name}`);
            }

            serialsToMove = candidates.map((s) => s.serial_number);
          }

          if (serialsToMove.length !== item.quantity) {
            throw new Error(`Serial count mismatch for ammo ${ammoType.name}`);
          }

          const serialDocs = await InventorySerial.find({
            bunker_id: sourceBunker._id,
            ammo_type_id: item.ammo_type_id,
            serial_number: { $in: serialsToMove },
            status: 'in_stock',
          }).session(session);

          if (serialDocs.length !== serialsToMove.length) {
            throw new Error(`Some serials are missing in source for ammo ${ammoType.name}`);
          }

          dryRunOps.push(
            `SERIAL ${ammoType.name}: ${serialsToMove.length} serials from ${sourceBunker.name} -> ${destBunker.name}`
          );

          if (!apply) continue;

          await InventorySerial.updateMany(
            {
              bunker_id: sourceBunker._id,
              ammo_type_id: item.ammo_type_id,
              serial_number: { $in: serialsToMove },
              status: 'in_stock',
            },
            {
              bunker_id: destBunker._id,
              status: 'in_stock',
              issuance_id: issuance._id,
            },
            { session }
          );
        }
      }

      if (!apply) {
        await session.abortTransaction();
      }
    });

    console.log('\nPlanned operations:');
    if (!dryRunOps.length) {
      console.log('  (none)');
    } else {
      for (const op of dryRunOps) {
        console.log(`  - ${op}`);
      }
    }

    if (!apply) {
      console.log('\nDry-run only. No data was changed.');
      console.log('Run again with --apply to execute.');
    } else {
      console.log('\nFix applied successfully.');
    }
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('Fix failed:', error.message || error);
  process.exit(1);
});
