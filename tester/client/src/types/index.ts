export interface Bunker {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  unit_id: string | null;
  unit_name?: string | null;
  unit_type?: string | null;
  created_at: string;
  stocked_types?: number;
  issuance_count?: number;
  total_qty?: number;
}

export type TrackingType = 'qty' | 'batch' | 'serial';

export interface AmmoType {
  id: string;
  name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
  created_at: string;
}

export interface InventoryBatch {
  id: string;
  bunker_id: string;
  ammo_type_id: string;
  batch_number: string;
  quantity: number;
  created_at: string;
}

export interface InventorySerial {
  id: string;
  bunker_id: string;
  ammo_type_id: string;
  serial_number: string;
  status: 'in_stock' | 'issued';
  issuance_id: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  bunker_id: string;
  ammo_type_id: string;
  quantity: number;
  updated_at: string;
  ammo_name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
}

export interface InventoryEntry {
  id: string;
  bunker_id: string;
  ammo_type_id: string;
  quantity_delta: number;
  entry_type: 'add' | 'adjust' | 'issuance' | 'count';
  notes: string | null;
  created_at: string;
  ammo_name: string;
  unit: string;
  category: string;
}

export interface InventoryCount {
  id: string;
  bunker_id: string;
  count_date: string;
  status: 'draft' | 'complete';
  notes: string | null;
  created_at: string;
  item_count?: number;
}

export interface CountItem {
  id: string;
  count_id: string;
  ammo_type_id: string;
  counted_qty: number;
  ammo_name: string;
  unit: string;
  category: string;
}

export interface Issuance {
  id: string;
  bunker_id: string;
  linked_bunker_id: string | null;
  recipient_name: string | null;
  recipient_id: string | null;
  unit_name: string | null;
  issue_date: string;
  form_image_path: string | null;
  notes: string | null;
  created_at: string;
  item_count?: number;
  total_qty?: number;
}

export interface IssuanceItem {
  id: string;
  issuance_id: string;
  ammo_type_id: string;
  quantity: number;
  ammo_name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
  batch_details?: Array<{ batch_number: string; quantity: number }>;
  serial_numbers?: string[];
}

export interface BunkerStandard {
  id: string;
  bunker_id: string;
  ammo_type_id: string;
  required_qty: number;
  ammo_name: string;
  unit: string;
  category: string;
}

export interface GapItem {
  ammo_type_id: string;
  ammo_name: string;
  unit: string;
  category: string;
  required_qty: number;
  current_qty: number;
  gap: number;
}

export interface GapsResponse {
  gaps: GapItem[];
  summary: { total: number; deficit: number; ok: number };
}

export type UnitType = 'battalion' | 'company' | 'storage_location';
export type LocationType = 'bunker' | 'vehicle' | 'pillbox';

export interface StorageLocation {
  id: string;
  unit_id: string;
  location_type: LocationType;
  location_details: string | null;
}

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  parent_unit_id: string | null;
  description: string | null;
  created_at: string;
}

export interface UnitWithChildren extends Unit {
  children: UnitWithChildren[];
  storage_location?: StorageLocation;
}

export interface UnitDetail extends Unit {
  parent?: Unit | null;
  children: Unit[];
  storage_location?: StorageLocation;
}

