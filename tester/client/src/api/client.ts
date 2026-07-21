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
export const getUnit = (id: string) => api.get<UnitDetail>(`/units/${id}`).then(r => r.data);
export const createUnit = (data: { name: string; type?: string; parent_unit_id?: string | null; description?: string }) =>
  api.post<Unit>('/units', data).then(r => r.data);
export const updateUnit = (id: string, data: { name?: string; type?: string; description?: string | null; parent_unit_id?: string | null }) =>
  api.put<Unit>(`/units/${id}`, data).then(r => r.data);
export const deleteUnit = (id: string) => api.delete(`/units/${id}`).then(r => r.data);
export const addStorageLocation = (unitId: string, data: { location_type: string; location_details?: string }) =>
  api.post<StorageLocation>(`/units/${unitId}/storage`, data).then(r => r.data);
export const getStorageLocation = (unitId: string) =>
  api.get<StorageLocation>(`/units/${unitId}/storage`).then(r => r.data).catch(() => null);
export const getUnitBunkers = (unitId: string) =>
  api.get<Bunker[]>(`/units/${unitId}/bunkers`).then(r => r.data);
export const linkBunkerToUnit = (bunkerId: string, unitId: string | null) =>
  api.put<Bunker>(`/bunkers/${bunkerId}/link-unit`, { unit_id: unitId }).then(r => r.data);
export const ensureUnitBunker = (unitId: string) =>
  api.post<Bunker>(`/units/${unitId}/ensure-bunker`).then(r => r.data);

// Unit inventory & gaps aggregation
interface UnitInventorySummary {
  unit_id: string;
  unit_name: string;
  bunker_count: number;
  inventory: Array<{
    ammo_type_id: string;
    ammo_name: string;
    unit: string;
    category: string;
    total_qty: number;
  }>;
}

export const getUnitInventorySummary = (unitId: string) =>
  api.get<UnitInventorySummary>(`/units/${unitId}/inventory-summary`).then(r => r.data);

export const getUnitGaps = (unitId: string) =>
  api.get<GapsResponse>(`/units/${unitId}/gaps`).then(r => r.data);

// Bunkers
export const getBunkers = () => api.get<Bunker[]>('/bunkers').then(r => r.data);
export const getBunker = (id: string) => api.get<Bunker>(`/bunkers/${id}`).then(r => r.data);
export const createBunker = (data: Partial<Bunker>) => api.post<Bunker>('/bunkers', data).then(r => r.data);
export const updateBunker = (id: string, data: Partial<Bunker>) => api.put<Bunker>(`/bunkers/${id}`, data).then(r => r.data);
export const deleteBunker = (id: string) => api.delete(`/bunkers/${id}`).then(r => r.data);

// Ammo Types
export const getAmmoTypes = () => api.get<AmmoType[]>('/ammo-types').then(r => r.data);
export const createAmmoType = (data: Partial<AmmoType>) => api.post<AmmoType>('/ammo-types', data).then(r => r.data);
export const updateAmmoType = (id: string, data: Partial<AmmoType>) => api.put<AmmoType>(`/ammo-types/${id}`, data).then(r => r.data);
export const deleteAmmoType = (id: string) => api.delete(`/ammo-types/${id}`).then(r => r.data);

// Inventory
export const getInventory = (bunkerId: string) =>
  api.get<InventoryItem[]>(`/bunkers/${bunkerId}/inventory`).then(r => r.data);
export const getInventoryHistory = (bunkerId: string) =>
  api.get<InventoryEntry[]>(`/bunkers/${bunkerId}/inventory/history`).then(r => r.data);
export const addInventoryEntry = (bunkerId: string, data: {
  ammo_type_id: string;
  quantity_delta?: number;
  entry_type?: string;
  notes?: string;
  batches?: Array<{ batch_number: string; quantity: number }>;
  serial_numbers?: string[];
}) => api.post<InventoryItem>(`/bunkers/${bunkerId}/inventory`, data).then(r => r.data);

// Batch & Serial detail endpoints
export const getBatches = (bunkerId: string, ammoTypeId: string) =>
  api.get<InventoryBatch[]>(`/bunkers/${bunkerId}/inventory/${ammoTypeId}/batches`).then(r => r.data);
export const getSerials = (bunkerId: string, ammoTypeId: string, status?: string) =>
  api.get<InventorySerial[]>(`/bunkers/${bunkerId}/inventory/${ammoTypeId}/serials`, { params: status ? { status } : {} }).then(r => r.data);

// Counts
export const getCounts = (bunkerId: string) =>
  api.get<InventoryCount[]>(`/bunkers/${bunkerId}/counts`).then(r => r.data);
export const getCount = (bunkerId: string, countId: string) =>
  api.get<InventoryCount & { items: CountItem[] }>(`/bunkers/${bunkerId}/counts/${countId}`).then(r => r.data);
export const createCount = (bunkerId: string, data: {
  count_date?: string;
  notes?: string;
  items: Array<{ ammo_type_id: string; counted_qty: number }>;
}) => api.post<InventoryCount>(`/bunkers/${bunkerId}/counts`, data).then(r => r.data);
export const updateCount = (bunkerId: string, countId: string, data: {
  status?: string;
  notes?: string;
  items?: Array<{ ammo_type_id: string; counted_qty: number }>;
  sync_inventory?: boolean;
}) => api.put<InventoryCount>(`/bunkers/${bunkerId}/counts/${countId}`, data).then(r => r.data);

// Issuances
export const getIssuances = (bunkerId: string) =>
  api.get<Issuance[]>(`/bunkers/${bunkerId}/issuances`).then(r => r.data);
export const getIssuance = (bunkerId: string, issuanceId: string) =>
  api.get<Issuance & { items: IssuanceItem[] }>(`/bunkers/${bunkerId}/issuances/${issuanceId}`).then(r => r.data);
export const createIssuance = (bunkerId: string, formData: FormData) =>
  api.post<Issuance>(`/bunkers/${bunkerId}/issuances`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
export const updateIssuance = (bunkerId: string, issuanceId: string, formData: FormData) =>
  api.put<Issuance>(`/bunkers/${bunkerId}/issuances/${issuanceId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

// Standards
export const getStandard = (bunkerId: string) =>
  api.get<BunkerStandard[]>(`/bunkers/${bunkerId}/standard`).then(r => r.data);
export const updateStandard = (bunkerId: string, items: Array<{ ammo_type_id: string; required_qty: number }>) =>
  api.put<BunkerStandard[]>(`/bunkers/${bunkerId}/standard`, { items }).then(r => r.data);
export const getGaps = (bunkerId: string) =>
  api.get<GapsResponse>(`/bunkers/${bunkerId}/standard/gaps`).then(r => r.data);

// Templates
export interface StandardTemplateDto {
  id: string;
  name: string;
  items: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export const getTemplates = () =>
  api.get<StandardTemplateDto[]>('/templates').then(r => r.data);
export const createTemplate = (data: { name: string; items: Record<string, number> }) =>
  api.post<StandardTemplateDto>('/templates', data).then(r => r.data);
export const updateTemplate = (id: string, data: { name?: string; items?: Record<string, number> }) =>
  api.put<StandardTemplateDto>(`/templates/${id}`, data).then(r => r.data);
export const deleteTemplate = (id: string) =>
  api.delete<{ success: boolean }>(`/templates/${id}`).then(r => r.data);

export default api;
