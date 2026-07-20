export interface Bunker {
  id: number;
  name: string;
  location: string | null;
  description: string | null;
  unit_id: number | null;
  unit_name?: string | null;
  unit_type?: string | null;
  created_at: string;
  stocked_types?: number;
  issuance_count?: number;
  total_qty?: number;
}

export type TrackingType = 'qty' | 'batch' | 'serial';

export interface AmmoType {
  id: number;
  name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
  created_at: string;
}

export interface InventoryBatch {
  id: number;
  bunker_id: number;
  ammo_type_id: number;
  batch_number: string;
  quantity: number;
  created_at: string;
}

export interface InventorySerial {
  id: number;
  bunker_id: number;
  ammo_type_id: number;
  serial_number: string;
  status: 'in_stock' | 'issued';
  issuance_id: number | null;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  bunker_id: number;
  ammo_type_id: number;
  quantity: number;
  updated_at: string;
  ammo_name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
}

export interface InventoryEntry {
  id: number;
  bunker_id: number;
  ammo_type_id: number;
  quantity_delta: number;
  entry_type: 'add' | 'adjust' | 'issuance' | 'count';
  notes: string | null;
  created_at: string;
  ammo_name: string;
  unit: string;
  category: string;
}

export interface InventoryCount {
  id: number;
  bunker_id: number;
  count_date: string;
  status: 'draft' | 'complete';
  notes: string | null;
  created_at: string;
  item_count?: number;
}

export interface CountItem {
  id: number;
  count_id: number;
  ammo_type_id: number;
  counted_qty: number;
  ammo_name: string;
  unit: string;
  category: string;
}

export interface Issuance {
  id: number;
  bunker_id: number;
  linked_bunker_id: number | null;
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
  id: number;
  issuance_id: number;
  ammo_type_id: number;
  quantity: number;
  ammo_name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
  batch_details?: Array<{ batch_number: string; quantity: number }>;
  serial_numbers?: string[];
}

export interface BunkerStandard {
  id: number;
  bunker_id: number;
  ammo_type_id: number;
  required_qty: number;
  ammo_name: string;
  unit: string;
  category: string;
}

export interface GapItem {
  ammo_type_id: number;
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
  id: number;
  unit_id: number;
  location_type: LocationType;
  location_details: string | null;
}

export interface Unit {
  id: number;
  name: string;
  type: UnitType;
  parent_unit_id: number | null;
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

