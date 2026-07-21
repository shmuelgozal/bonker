import mongoose, { Schema, Document } from 'mongoose';

// Unit Document
export interface IUnit extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: string;
  parent_unit_id?: mongoose.Types.ObjectId;
  description?: string;
  created_at: Date;
}

const UnitSchema = new Schema<IUnit>({
  name: { type: String, required: true },
  type: { type: String, required: true, default: 'battalion' },
  parent_unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', default: null },
  description: String,
  created_at: { type: Date, default: () => new Date() },
});

export const Unit = mongoose.model<IUnit>('Unit', UnitSchema);

// Storage Location
export interface IStorageLocation extends Document {
  _id: mongoose.Types.ObjectId;
  unit_id: mongoose.Types.ObjectId;
  location_type: string;
  location_details?: string;
}

const StorageLocationSchema = new Schema<IStorageLocation>({
  unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
  location_type: { type: String, required: true },
  location_details: String,
});

export const StorageLocation = mongoose.model<IStorageLocation>('StorageLocation', StorageLocationSchema);

// Bunker Document
export interface IBunker extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  bunker_type: 'bunker' | 'vehicle_pillbox' | 'soldiers';
  unit_id?: mongoose.Types.ObjectId;
  location?: string;
  description?: string;
  created_at: Date;
}

const BunkerSchema = new Schema<IBunker>({
  name: { type: String, required: true },
  bunker_type: { type: String, enum: ['bunker', 'vehicle_pillbox', 'soldiers'], default: 'bunker' },
  unit_id: { type: Schema.Types.ObjectId, ref: 'Unit' },
  location: String,
  description: String,
  created_at: { type: Date, default: () => new Date() },
});

export const Bunker = mongoose.model<IBunker>('Bunker', BunkerSchema);

// Ammo Type
export interface IAmmoType extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  unit: string;
  category: string;
  tracking_type: string;
  created_at: Date;
}

const AmmoTypeSchema = new Schema<IAmmoType>({
  name: { type: String, required: true },
  unit: { type: String, default: 'יח' },
  category: { type: String, default: 'תחמושת' },
  tracking_type: { type: String, default: 'qty' },
  created_at: { type: Date, default: () => new Date() },
});

export const AmmoType = mongoose.model<IAmmoType>('AmmoType', AmmoTypeSchema);

// Bunker Standard
export interface IBunkerStandard extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  required_qty: number;
}

const BunkerStandardSchema = new Schema<IBunkerStandard>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  required_qty: { type: Number, default: 0 },
});

BunkerStandardSchema.index({ bunker_id: 1, ammo_type_id: 1 }, { unique: true });

export const BunkerStandard = mongoose.model<IBunkerStandard>('BunkerStandard', BunkerStandardSchema);

// Inventory
export interface IInventory extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  quantity: number;
  updated_at: Date;
}

const InventorySchema = new Schema<IInventory>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  quantity: { type: Number, default: 0 },
  updated_at: { type: Date, default: () => new Date() },
});

InventorySchema.index({ bunker_id: 1, ammo_type_id: 1 }, { unique: true });

export const Inventory = mongoose.model<IInventory>('Inventory', InventorySchema);

// Inventory Entry
export interface IInventoryEntry extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  quantity_delta: number;
  entry_type: string;
  notes?: string;
  event_date?: Date;
  created_by_user_id?: mongoose.Types.ObjectId;
  created_by_username?: string;
  created_at: Date;
}

const InventoryEntrySchema = new Schema<IInventoryEntry>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  quantity_delta: { type: Number, required: true },
  entry_type: { type: String, default: 'add' },
  notes: String,
  event_date: { type: Date },
  created_by_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
  created_by_username: String,
  created_at: { type: Date, default: () => new Date() },
});

export const InventoryEntry = mongoose.model<IInventoryEntry>('InventoryEntry', InventoryEntrySchema);

// Issuance
export interface IIssuance extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  linked_bunker_id?: mongoose.Types.ObjectId;
  recipient_name?: string;
  recipient_id?: string;
  unit_name?: string;
  issue_date: string;
  form_image_path?: string;
  notes?: string;
  created_at: Date;
}

const IssuanceSchema = new Schema<IIssuance>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  linked_bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker' },
  recipient_name: String,
  recipient_id: String,
  unit_name: String,
  issue_date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  form_image_path: String,
  notes: String,
  created_at: { type: Date, default: () => new Date() },
});

export const Issuance = mongoose.model<IIssuance>('Issuance', IssuanceSchema);

// Issuance Item
export interface IIssuanceItem extends Document {
  _id: mongoose.Types.ObjectId;
  issuance_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  quantity: number;
}

const IssuanceItemSchema = new Schema<IIssuanceItem>({
  issuance_id: { type: Schema.Types.ObjectId, ref: 'Issuance', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  quantity: { type: Number, default: 0 },
});

export const IssuanceItem = mongoose.model<IIssuanceItem>('IssuanceItem', IssuanceItemSchema);

// Soldier Bunker Record
export interface ISoldierBunkerRecord extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  issuance_id?: mongoose.Types.ObjectId;
  issuance_item_id?: mongoose.Types.ObjectId;
  movement_type: 'issuance' | 'manual_add' | 'manual_remove';
  soldier_name: string;
  soldier_id?: string;
  unit_name?: string;
  ammo_type_id: mongoose.Types.ObjectId;
  quantity: number;
  issue_date: string;
  notes?: string;
  created_at: Date;
}

const SoldierBunkerRecordSchema = new Schema<ISoldierBunkerRecord>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  issuance_id: { type: Schema.Types.ObjectId, ref: 'Issuance' },
  issuance_item_id: { type: Schema.Types.ObjectId, ref: 'IssuanceItem' },
  movement_type: { type: String, enum: ['issuance', 'manual_add', 'manual_remove'], default: 'issuance' },
  soldier_name: { type: String, required: true },
  soldier_id: String,
  unit_name: String,
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  quantity: { type: Number, required: true },
  issue_date: { type: String, required: true },
  notes: String,
  created_at: { type: Date, default: () => new Date() },
});

SoldierBunkerRecordSchema.index({ bunker_id: 1, created_at: -1 });

export const SoldierBunkerRecord = mongoose.model<ISoldierBunkerRecord>('SoldierBunkerRecord', SoldierBunkerRecordSchema);

// Inventory Batch
export interface IInventoryBatch extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  batch_number: string;
  quantity: number;
  created_at: Date;
}

const InventoryBatchSchema = new Schema<IInventoryBatch>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  batch_number: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  created_at: { type: Date, default: () => new Date() },
});

InventoryBatchSchema.index({ bunker_id: 1, ammo_type_id: 1, batch_number: 1 }, { unique: true });

export const InventoryBatch = mongoose.model<IInventoryBatch>('InventoryBatch', InventoryBatchSchema);

// Inventory Serial
export interface IInventorySerial extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  serial_number: string;
  status: string;
  issuance_id?: mongoose.Types.ObjectId;
  created_at: Date;
}

const InventorySerialSchema = new Schema<IInventorySerial>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  serial_number: { type: String, required: true },
  status: { type: String, default: 'in_stock' },
  issuance_id: { type: Schema.Types.ObjectId, ref: 'Issuance' },
  created_at: { type: Date, default: () => new Date() },
});

InventorySerialSchema.index({ bunker_id: 1, ammo_type_id: 1, serial_number: 1 }, { unique: true });

export const InventorySerial = mongoose.model<IInventorySerial>('InventorySerial', InventorySerialSchema);

// Inventory Count
export interface IInventoryCount extends Document {
  _id: mongoose.Types.ObjectId;
  bunker_id: mongoose.Types.ObjectId;
  count_date: string;
  status: string;
  notes?: string;
  created_at: Date;
}

const InventoryCountSchema = new Schema<IInventoryCount>({
  bunker_id: { type: Schema.Types.ObjectId, ref: 'Bunker', required: true },
  count_date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  status: { type: String, default: 'draft' },
  notes: String,
  created_at: { type: Date, default: () => new Date() },
});

export const InventoryCount = mongoose.model<IInventoryCount>('InventoryCount', InventoryCountSchema);

// Inventory Count Item
export interface IInventoryCountItem extends Document {
  _id: mongoose.Types.ObjectId;
  count_id: mongoose.Types.ObjectId;
  ammo_type_id: mongoose.Types.ObjectId;
  counted_qty: number;
}

const InventoryCountItemSchema = new Schema<IInventoryCountItem>({
  count_id: { type: Schema.Types.ObjectId, ref: 'InventoryCount', required: true },
  ammo_type_id: { type: Schema.Types.ObjectId, ref: 'AmmoType', required: true },
  counted_qty: { type: Number, default: 0 },
});

InventoryCountItemSchema.index({ count_id: 1, ammo_type_id: 1 }, { unique: true });

export const InventoryCountItem = mongoose.model<IInventoryCountItem>('InventoryCountItem', InventoryCountItemSchema);

// Standard Template (for בונקר תו תקן defaults)
export interface IStandardTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  items: Record<string, number>; // { ammoName: qty, ... }
  created_at: Date;
  updated_at: Date;
}

const StandardTemplateSchema = new Schema<IStandardTemplate>({
  name: { type: String, required: true, unique: true },
  items: { type: Map, of: Number, default: new Map() },
  created_at: { type: Date, default: () => new Date() },
  updated_at: { type: Date, default: () => new Date() },
});

export const StandardTemplate = mongoose.model<IStandardTemplate>('StandardTemplate', StandardTemplateSchema);

// User
export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  password_hash: string;
  email?: string;
  role: 'admin' | 'user';
  created_at: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  email: { type: String },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  created_at: { type: Date, default: () => new Date() },
});

export const User = mongoose.model<IUser>('User', UserSchema);

// User Framework Permission
export interface IUserFrameworkPermission extends Document {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  unit_id: mongoose.Types.ObjectId;
  created_at: Date;
}

const UserFrameworkPermissionSchema = new Schema<IUserFrameworkPermission>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  unit_id: { type: Schema.Types.ObjectId, ref: 'Unit', required: true },
  created_at: { type: Date, default: () => new Date() },
});

UserFrameworkPermissionSchema.index({ user_id: 1, unit_id: 1 }, { unique: true });

export const UserFrameworkPermission = mongoose.model<IUserFrameworkPermission>(
  'UserFrameworkPermission',
  UserFrameworkPermissionSchema
);

// Access Request
export interface IAccessRequest extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  password_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: Date;
  reviewed_by?: mongoose.Types.ObjectId;
  reviewed_at?: Date;
  assigned_unit_id?: mongoose.Types.ObjectId;
  rejection_reason?: string;
}

const AccessRequestSchema = new Schema<IAccessRequest>({
  username: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requested_at: { type: Date, default: () => new Date() },
  reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewed_at: { type: Date },
  assigned_unit_id: { type: Schema.Types.ObjectId, ref: 'Unit' },
  rejection_reason: { type: String },
});

export const AccessRequest = mongoose.model<IAccessRequest>('AccessRequest', AccessRequestSchema);

// Connect to MongoDB
export async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bonker';
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
}
