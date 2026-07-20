import axios from 'axios';
import type {
  Bunker, AmmoType, InventoryItem, InventoryEntry,
  InventoryCount, CountItem, Issuance, IssuanceItem,
  BunkerStandard, GapsResponse, InventoryBatch, InventorySerial,
  Unit, UnitWithChildren, UnitDetail, StorageLocation
} from '../types';

// Use environment variable for API base URL, fallback to relative path for local development
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({ baseURL: apiBaseURL });

// Units (Hierarchical Framework)
export const getUnits = () => api.get<UnitWithChildren[]>('/units').then(r => r.data);
export const getUnit = (id: number) => api.get<UnitDetail>(`/units/${id}`).then(r => r.data);
export const createUnit = (data: { name: string; type?: string; parent_unit_id?: number | null; description?: string }) =>
  api.post<Unit>('/units', data).then(r => r.data);
export const updateUnit = (id: number, data: { name?: string; type?: string; description?: string | null; parent_unit_id?: number | null }) =>
  api.put<Unit>(`/units/${id}`, data).then(r => r.data);
export const deleteUnit = (id: number) => api.delete(`/units/${id}`).then(r => r.data);
export const addStorageLocation = (unitId: number, data: { location_type: string; location_details?: string }) =>
  api.post<StorageLocation>(`/units/${unitId}/storage`, data).then(r => r.data);
export const getStorageLocation = (unitId: number) =>
  api.get<StorageLocation>(`/units/${unitId}/storage`).then(r => r.data).catch(() => null);
export const getUnitBunkers = (unitId: number) =>
  api.get<Bunker[]>(`/units/${unitId}/bunkers`).then(r => r.data);
export const linkBunkerToUnit = (bunkerId: number, unitId: number | null) =>
  api.put<Bunker>(`/bunkers/${bunkerId}/link-unit`, { unit_id: unitId }).then(r => r.data);
export const ensureUnitBunker = (unitId: number) =>
  api.post<Bunker>(`/units/${unitId}/ensure-bunker`).then(r => r.data);

// Unit inventory & gaps aggregation
interface UnitInventorySummary {
  unit_id: number;
  unit_name: string;
  bunker_count: number;
  inventory: Array<{
    ammo_type_id: number;
    ammo_name: string;
    unit: string;
    category: string;
    total_qty: number;
  }>;
}

export const getUnitInventorySummary = (unitId: number) =>
  api.get<UnitInventorySummary>(`/units/${unitId}/inventory-summary`).then(r => r.data);

export const getUnitGaps = (unitId: number) =>
  api.get<GapsResponse>(`/units/${unitId}/gaps`).then(r => r.data);

// Bunkers
export const getBunkers = () => api.get<Bunker[]>('/bunkers').then(r => r.data);
export const getBunker = (id: number) => api.get<Bunker>(`/bunkers/${id}`).then(r => r.data);
export const createBunker = (data: Partial<Bunker>) => api.post<Bunker>('/bunkers', data).then(r => r.data);
export const updateBunker = (id: number, data: Partial<Bunker>) => api.put<Bunker>(`/bunkers/${id}`, data).then(r => r.data);
export const deleteBunker = (id: number) => api.delete(`/bunkers/${id}`).then(r => r.data);

// Ammo Types
export const getAmmoTypes = () => api.get<AmmoType[]>('/ammo-types').then(r => r.data);
export const createAmmoType = (data: Partial<AmmoType>) => api.post<AmmoType>('/ammo-types', data).then(r => r.data);
export const updateAmmoType = (id: number, data: Partial<AmmoType>) => api.put<AmmoType>(`/ammo-types/${id}`, data).then(r => r.data);
export const deleteAmmoType = (id: number) => api.delete(`/ammo-types/${id}`).then(r => r.data);

// Inventory
export const getInventory = (bunkerId: number) =>
  api.get<InventoryItem[]>(`/bunkers/${bunkerId}/inventory`).then(r => r.data);
export const getInventoryHistory = (bunkerId: number) =>
  api.get<InventoryEntry[]>(`/bunkers/${bunkerId}/inventory/history`).then(r => r.data);
export const addInventoryEntry = (bunkerId: number, data: {
  ammo_type_id: number;
  quantity_delta?: number;
  entry_type?: string;
  notes?: string;
  batches?: Array<{ batch_number: string; quantity: number }>;
  serial_numbers?: string[];
}) => api.post<InventoryItem>(`/bunkers/${bunkerId}/inventory`, data).then(r => r.data);

// Batch & Serial detail endpoints
export const getBatches = (bunkerId: number, ammoTypeId: number) =>
  api.get<InventoryBatch[]>(`/bunkers/${bunkerId}/inventory/${ammoTypeId}/batches`).then(r => r.data);
export const getSerials = (bunkerId: number, ammoTypeId: number, status?: string) =>
  api.get<InventorySerial[]>(`/bunkers/${bunkerId}/inventory/${ammoTypeId}/serials`, { params: status ? { status } : {} }).then(r => r.data);

// Counts
export const getCounts = (bunkerId: number) =>
  api.get<InventoryCount[]>(`/bunkers/${bunkerId}/counts`).then(r => r.data);
export const getCount = (bunkerId: number, countId: number) =>
  api.get<InventoryCount & { items: CountItem[] }>(`/bunkers/${bunkerId}/counts/${countId}`).then(r => r.data);
export const createCount = (bunkerId: number, data: {
  count_date?: string;
  notes?: string;
  items: Array<{ ammo_type_id: number; counted_qty: number }>;
}) => api.post<InventoryCount>(`/bunkers/${bunkerId}/counts`, data).then(r => r.data);
export const updateCount = (bunkerId: number, countId: number, data: {
  status?: string;
  notes?: string;
  items?: Array<{ ammo_type_id: number; counted_qty: number }>;
  sync_inventory?: boolean;
}) => api.put<InventoryCount>(`/bunkers/${bunkerId}/counts/${countId}`, data).then(r => r.data);

// Issuances
export const getIssuances = (bunkerId: number) =>
  api.get<Issuance[]>(`/bunkers/${bunkerId}/issuances`).then(r => r.data);
export const getIssuance = (bunkerId: number, issuanceId: number) =>
  api.get<Issuance & { items: IssuanceItem[] }>(`/bunkers/${bunkerId}/issuances/${issuanceId}`).then(r => r.data);
export const createIssuance = (bunkerId: number, formData: FormData) =>
  api.post<Issuance>(`/bunkers/${bunkerId}/issuances`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
export const updateIssuance = (bunkerId: number, issuanceId: number, formData: FormData) =>
  api.put<Issuance>(`/bunkers/${bunkerId}/issuances/${issuanceId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

// Standards
export const getStandard = (bunkerId: number) =>
  api.get<BunkerStandard[]>(`/bunkers/${bunkerId}/standard`).then(r => r.data);
export const updateStandard = (bunkerId: number, items: Array<{ ammo_type_id: number; required_qty: number }>) =>
  api.put<BunkerStandard[]>(`/bunkers/${bunkerId}/standard`, { items }).then(r => r.data);
export const getGaps = (bunkerId: number) =>
  api.get<GapsResponse>(`/bunkers/${bunkerId}/standard/gaps`).then(r => r.data);

export default api;
