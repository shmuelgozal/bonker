# 📋 Three-Tier Ammunition Tracking System

## Overview

The system now supports **three types of inventory management** for different ammunition and equipment items:

### 1️⃣ **Quantity Only** (`qty`)
- Track only total count
- Simplest tracking method
- Examples: תחמיש 5.56, חולית, שלישיות גומי
- UI: Simple number input for quantity

### 2️⃣ **Quantity + Batch/Lot** (`batch`)
- Track quantity per batch/lot number
- Each batch has its own serial number (production batch, date code, etc.)
- Useful for items with manufacturing lots
- Examples: **רימון הלם**, **רימון רסס מ'ס 26**, פצצות מטול
- UI: Table with batch_number + quantity per batch
- Deduction during issuance selects specific batches

### 3️⃣ **Serial Number Tracking** (`serial`)
- Track every individual item by serial/asset number
- Each item has unique SN (tracked across entire lifecycle)
- Highest traceability; marks items as "in_stock" or "issued"
- Examples: **לאו** (LAW), ציוד (רחפנים, רובים, ארגזים)
- UI: Checkbox picker for individual SNs
- Deduction marks selected SNs as "issued"

---

## Database Schema

### Core Tables

**`ammo_types`**
```sql
id, name, unit, category, tracking_type ('qty'|'batch'|'serial'), created_at
```

**`inventory`**
- Main count table (quantity summary)
- Updated automatically when batches/serials change

**`inventory_batches`**
- Batch number + quantity per (bunker, ammo_type, batch_number)
- Deleted when quantity reaches 0

**`inventory_serials`**
- Individual SN tracking: (bunker, ammo_type, serial_number)
- Status: 'in_stock' | 'issued'
- Links to issuance_id when issued

**`issuance_item_batches`**
- Records which batches were issued in each issuance
- Links to specific batch deduction

---

## Client Features

### **AmmoTypes Page** (לדוגמה: שפט הסוגים)
- Shows tracking type badge for each item
- Color-coded: gray (qty), blue (batch), purple (serial)
- Create/edit tracking_type when adding new types

### **Inventory Entry** (`/bunkers/:id/add-inventory`)
- **Smart form that adapts to tracking type:**
  - **qty**: Single quantity input (+ "הוספה"/"תיקון" toggle)
  - **batch**: Multi-row table (batch_number + quantity each, dynamically add rows)
  - **serial**: Text area for SN list (paste from Excel, newline or comma separated)

### **BunkerDetail Inventory Tab**
- Main table: ammo_name, quantity, tracking_type badge, last updated
- **Expandable rows** (click "סדרות" / "מ"ס"):
  - **batch**: Shows all batches with quantities (color-coded pill buttons)
  - **serial**: Shows all SNs with status (green=in_stock, gray=issued)
  - Searchable for serials (filter textbox)

### **Issuance Creation** (`/bunkers/:id/new-issuance`)
- Per-item smart form:
  - **qty**: Number input
  - **batch**: Dropdown selector showing "batch_number (available: X)", multi-select (checkboxes)
  - **serial**: Searchable multi-select checklist, shows availability
- **Stock validation**: Prevents issuance if quantity > available
- Deduction fully traced (batch/SN association recorded)

---

## Server API

### Inventory Endpoints

**POST `/bunkers/:id/inventory`** — Add inventory entry
```json
{
  "ammo_type_id": 14,
  "quantity_delta": 10,              // for qty type
  "entry_type": "add",               // add | adjust
  "notes": "Resupply",
  
  "batches": [                       // for batch type
    { "batch_number": "LOT-2024-001", "quantity": 5 },
    { "batch_number": "LOT-2024-002", "quantity": 3 }
  ],
  
  "serial_numbers": [                // for serial type
    "LAW-00234", "LAW-00235", "LAW-00236"
  ]
}
```

**GET `/bunkers/:id/inventory/:ammoTypeId/batches`**
- Returns available batches (quantity > 0)

**GET `/bunkers/:id/inventory/:ammoTypeId/serials?status=in_stock`**
- Returns SNs by status (in_stock | issued)

### Issuance Endpoints

**POST `/bunkers/:id/issuances`** — Create issuance
```json
{
  "recipient_name": "...",
  "items": [
    {
      "ammo_type_id": 14,
      "quantity": 8,
      "batch_details": [              // for batch type
        { "batch_number": "LOT-001", "quantity": 5 },
        { "batch_number": "LOT-002", "quantity": 3 }
      ],
      "serial_numbers": [             // for serial type
        "LAW-00234", "LAW-00235"
      ]
    }
  ]
}
```

**GET `/bunkers/:id/issuances/:issuanceId`**
- Returns issuance with batch_details and serial_numbers attached to items

---

## Known Tracking Types (Pre-Configured)

These items have tracking_type set automatically on first DB init:

| Name | Type | Reason |
|------|------|--------|
| **רימון הלם** | batch | Manufacturing batches important |
| **רימון רסס מ'ס 26** | batch | Per-lot tracking needed |
| **לאו** | serial | Each LAW tracked individually |
| All **ציוד** (equipment) | serial | High-value asset tracking |
| Everything else | qty | Consumable/bulk items |

---

## Data Integrity & Transactions

- **Atomic operations**: Inventory, entries, and batch/serial records updated in single transaction
- **Automatic count sync**: When serials added/issued, inventory qty recalculated from serial count
- **Referential integrity**: Foreign keys enforce consistency
- **Cascade delete**: Deleting bunker deletes all related records

---

## Usage Examples

### Example 1: Adding שלישיות גומי (qty type)
1. Go to "הזנת מלאי"
2. Select "שלישיות גומי" → qty form appears
3. Type "20" (quantity)
4. Click "שמור"
5. ✓ Inventory updated to +20

### Example 2: Adding רימון הלם (batch type)
1. Select "רימון הלם" → batch form appears
2. Enter batch details:
   - LOT-2024-A: 5 units
   - LOT-2024-B: 8 units
   - LOT-2024-C: 7 units
3. Click "שמור"
4. ✓ Each batch tracked separately; total = 20

### Example 3: Adding לאו (serial type)
1. Select "לאו" → serial form appears
2. Paste from Excel:
   ```
   LAW-00234
   LAW-00235
   LAW-00236
   ```
3. Click "שמור"
4. ✓ 3 individual items tracked with SNs

### Example 4: Issue 2 לאו units
1. "הנפקה חדשה" → select "לאו"
2. Checkbox picker shows all in_stock SNs
3. Check: LAW-00234, LAW-00235
4. Click "שמור הנפקה"
5. ✓ Those 2 SNs marked as "issued"
6. ✓ Inventory count drops to 1
7. ✓ In BunkerDetail, expand "לאו" → see LAW-00234, LAW-00235 crossed out

---

## Client Pages Affected

✅ **AmmoTypes.tsx** — Show tracking_type badge, allow edit
✅ **BunkerInventoryAdd.tsx** — Smart form per tracking type
✅ **BunkerIssuanceNew.tsx** — Batch/serial selector per item
✅ **BunkerDetail.tsx** — Expandable inventory rows
✅ **API client** — New endpoints (getBatches, getSerials)
✅ **Types** — TrackingType, InventoryBatch, InventorySerial types

---

## Next Steps (Optional Enhancements)

- [ ] Barcode/QR scanner for serial input
- [ ] Batch expiration date tracking
- [ ] Stock-level alerts per tracking type
- [ ] Audit log for serial movement
- [ ] Export issuance details with batch/SN breakdown
