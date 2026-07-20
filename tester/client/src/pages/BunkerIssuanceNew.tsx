import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAmmoTypes, getInventory, createIssuance, getBunker, getBatches, getSerials, getBunkers } from '../api/client';
import type { AmmoType, InventoryItem, Bunker, TrackingType, InventoryBatch, InventorySerial } from '../types';
import { ArrowRight, Upload, X, Plus, Trash2 } from 'lucide-react';
import { TrackingBadge } from './AmmoTypes';

interface BatchDetail { batch_number: string; available: number; quantity: number }

interface IssuanceRow {
  ammo_type_id: string;
  tracking_type: TrackingType;
  quantity: number;                 // qty type
  batch_details: BatchDetail[];     // batch type
  serial_numbers: string[];         // serial type (selected)
  available_serials: InventorySerial[];
  available_batches: InventoryBatch[];
  serial_filter: string;
}

const emptyRow = (): IssuanceRow => ({
  ammo_type_id: '', tracking_type: 'qty', quantity: 1,
  batch_details: [], serial_numbers: [],
  available_serials: [], available_batches: [], serial_filter: '',
});

export default function BunkerIssuanceNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bunkerId = id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [allBunkers, setAllBunkers] = useState<Bunker[]>([]);
  const [ammoTypes, setAmmoTypes] = useState<AmmoType[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [linkedBunkerId, setLinkedBunkerId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rows, setRows] = useState<IssuanceRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bunkerId) {
      Promise.all([getBunker(bunkerId), getAmmoTypes(), getInventory(bunkerId), getBunkers()]).then(([b, types, inv, bunkers]) => {
      setBunker(b); setAmmoTypes(types); setInventory(inv); setAllBunkers(bunkers);
    });
  }, [bunkerId]);

  const stockOf = (ammoTypeId: string) =>
    inventory.find(i => i.ammo_type_id === ammoTypeId)?.quantity ?? 0;

  const handleTypeSelect = async (rowIdx: number, ammoTypeIdStr: string) => {
    const ammoTypeId = ammoTypeIdStr;
    const t = ammoTypes.find(a => a.id === ammoTypeId);
    const trackingType: TrackingType = t?.tracking_type ?? 'qty';

    let available_batches: InventoryBatch[] = [];
    let available_serials: InventorySerial[] = [];
    let batch_details: BatchDetail[] = [];

    if (trackingType === 'batch') {
      available_batches = await getBatches(bunkerId, ammoTypeId);
      batch_details = available_batches.map(b => ({ batch_number: b.batch_number, available: b.quantity, quantity: 0 }));
    } else if (trackingType === 'serial') {
      available_serials = await getSerials(bunkerId, ammoTypeId, 'in_stock');
    }

    setRows(prev => prev.map((r, i) => i === rowIdx ? {
      ...r, ammo_type_id: ammoTypeId, tracking_type: trackingType,
      quantity: 1, batch_details, available_batches, available_serials, serial_numbers: [],
    } : r));
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const toggleSerial = (rowIdx: number, sn: string) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const already = r.serial_numbers.includes(sn);
      return { ...r, serial_numbers: already ? r.serial_numbers.filter(s => s !== sn) : [...r.serial_numbers, sn] };
    }));
  };

  const setBatchQty = (rowIdx: number, batchIdx: number, qty: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== rowIdx) return r;
      const batch_details = r.batch_details.map((b, bi) => bi === batchIdx ? { ...b, quantity: qty } : b);
      return { ...r, batch_details };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.ammo_type_id);
    if (!validRows.length) { toast.error('הוסף לפחות פריט אחד'); return; }

    // Build items payload
    const items = validRows.map(r => {
      if (r.tracking_type === 'serial') {
        return { ammo_type_id: r.ammo_type_id, quantity: r.serial_numbers.length, serial_numbers: r.serial_numbers };
      }
      if (r.tracking_type === 'batch') {
        const bd = r.batch_details.filter(b => b.quantity > 0);
        const qty = bd.reduce((s, b) => s + b.quantity, 0);
        return { ammo_type_id: r.ammo_type_id, quantity: qty, batch_details: bd.map(b => ({ batch_number: b.batch_number, quantity: b.quantity })) };
      }
      return { ammo_type_id: r.ammo_type_id, quantity: r.quantity };
    }).filter(r => r.quantity > 0);

    if (!items.length) { toast.error('יש לבחור כמות'); return; }

    // Validate stock
    for (const item of items) {
      const stock = stockOf(item.ammo_type_id);
      if (item.quantity > stock) {
        const name = ammoTypes.find(t => t.id === item.ammo_type_id)?.name || '';
        toast.error(`אין מספיק מלאי עבור "${name}" (יש ${stock}, מבוקש ${item.quantity})`);
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('recipient_name', recipientName);
      formData.append('recipient_id', recipientId);
      formData.append('unit_name', unitName);
      formData.append('issue_date', issueDate);
      formData.append('notes', notes);
      formData.append('items', JSON.stringify(items));
      if (linkedBunkerId) formData.append('linked_bunker_id', linkedBunkerId.toString());
      if (imageFile) formData.append('form_image', imageFile);
      await createIssuance(bunkerId, formData);
      toast.success('הנפקה נשמרה ומלאי עודכן');
      navigate(`/bunkers/${bunkerId}`);
    } catch { toast.error('שגיאה בשמירת ההנפקה'); }
    finally { setSaving(false); }
  };

  const grouped = ammoTypes.reduce<Record<string, AmmoType[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t); return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to={`/bunkers/${bunkerId}`} className="text-gray-400 hover:text-gray-600"><ArrowRight size={18} /></Link>
        <span className="text-gray-400 text-sm">{bunker?.name || 'בונקר'}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 text-sm font-medium">הנפקה חדשה</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-5">הנפקת תחמושת / ציוד</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recipient */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">פרטי מקבל</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">שם המקבל</label><input className="input" value={recipientName} onChange={e => setRecipientName(e.target.value)} /></div>
            <div><label className="label">מספר אישי</label><input className="input" value={recipientId} onChange={e => setRecipientId(e.target.value)} /></div>
            <div><label className="label">יחידה</label><input className="input" value={unitName} onChange={e => setUnitName(e.target.value)} /></div>
            <div><label className="label">תאריך הנפקה</label><input type="date" className="input" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
            <div className="col-span-2"><label className="label">הערות</label><input className="input" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <div className="col-span-2">
              <label className="label">קישור להנפקה לבונקר אחר (אופציונלי)</label>
              <select className="input" value={linkedBunkerId || ''} onChange={e => setLinkedBunkerId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">-- ללא קישור (הנפקה רגילה) --</option>
                {allBunkers.filter(b => b.id !== bunkerId).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {linkedBunkerId && (
                <p className="text-xs text-blue-600 mt-2">
                  הנפקה לבונקר יעד: יורידה מ"{bunker?.name}" ותוסיף ל"{allBunkers.find(b => b.id === linkedBunkerId)?.name}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">פריטים שהונפקו</h2>
            <button type="button" onClick={addRow} className="btn-secondary flex items-center gap-1 text-sm"><Plus size={14} />הוסף פריט</button>
          </div>
          <div className="space-y-4">
            {rows.map((row, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <div className="flex gap-3 items-start mb-3">
                  <div className="flex-1">
                    <select className="input" value={row.ammo_type_id || ''} onChange={e => handleTypeSelect(i, e.target.value)}>
                      <option value="">-- בחר פריט --</option>
                      {Object.entries(grouped).map(([cat, items]) => (
                        <optgroup key={cat} label={cat}>
                          {items.map(t => <option key={t.id} value={t.id}>{t.name} (מלאי: {stockOf(t.id)})</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {row.ammo_type_id > 0 && <div className="mt-1"><TrackingBadge type={row.tracking_type} /></div>}
                  </div>
                  {row.tracking_type === 'qty' && row.ammo_type_id > 0 && (
                    <input type="number" min="1" className="input w-28 text-center"
                      value={row.quantity} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, quantity: Number(e.target.value) } : r))} />
                  )}
                  <button type="button" onClick={() => removeRow(i)} className="p-2 text-gray-400 hover:text-red-600" disabled={rows.length === 1}><Trash2 size={16} /></button>
                </div>

                {/* Batch breakdown */}
                {row.tracking_type === 'batch' && row.batch_details.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-500 mb-2">כמות מכל סדרה:</p>
                    <div className="space-y-1.5">
                      {row.batch_details.map((b, bi) => (
                        <div key={b.batch_number} className="flex items-center gap-3">
                          <span className="text-sm font-mono font-medium text-gray-700 w-32">{b.batch_number}</span>
                          <span className="text-xs text-gray-400">זמין: {b.available}</span>
                          <input type="number" min="0" max={b.available} className="input w-24 text-center"
                            value={b.quantity || ''} onChange={e => setBatchQty(i, bi, Math.min(Number(e.target.value), b.available))} placeholder="0" />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      סה"כ: <strong>{row.batch_details.reduce((s, b) => s + b.quantity, 0)}</strong>
                    </p>
                  </div>
                )}
                {row.tracking_type === 'batch' && row.batch_details.length === 0 && row.ammo_type_id > 0 && (
                  <p className="text-xs text-orange-500 mt-1">אין סדרות במלאי לפריט זה</p>
                )}

                {/* Serial picker */}
                {row.tracking_type === 'serial' && row.ammo_type_id > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-500">בחר מספרים סידוריים להנפקה:</p>
                      <span className="text-xs text-blue-600 font-medium">{row.serial_numbers.length} נבחרו</span>
                    </div>
                    <input className="input mb-2 text-sm" placeholder="חפש מספר סידורי..."
                      value={row.serial_filter} onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, serial_filter: e.target.value } : r))} />
                    <div className="max-h-40 overflow-y-auto border rounded-lg bg-white divide-y">
                      {row.available_serials
                        .filter(s => !row.serial_filter || s.serial_number.includes(row.serial_filter))
                        .map(s => (
                          <label key={s.serial_number} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={row.serial_numbers.includes(s.serial_number)}
                              onChange={() => toggleSerial(i, s.serial_number)} className="text-blue-600" />
                            <span className="text-sm font-mono">{s.serial_number}</span>
                          </label>
                        ))}
                      {row.available_serials.length === 0 && (
                        <p className="px-3 py-3 text-xs text-gray-400">אין פריטים זמינים</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Image upload */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm uppercase tracking-wide">תמונת טופס הנפקה</h2>
          <input type="file" ref={fileRef} accept="image/*,application/pdf" className="hidden" onChange={handleImage} />
          {!imagePreview ? (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 text-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
              <Upload size={28} className="mx-auto mb-2" />
              <p className="text-sm">לחץ להעלאת תמונת הטופס</p>
              <p className="text-xs mt-1">JPG, PNG, PDF עד 10MB</p>
            </button>
          ) : (
            <div className="relative">
              <img src={imagePreview} alt="טופס הנפקה" className="rounded-lg max-h-64 object-contain border" />
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute top-2 left-2 bg-white rounded-full p-1 shadow hover:bg-red-50"><X size={16} className="text-red-500" /></button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving ? 'שומר...' : 'שמור הנפקה'}
          </button>
          <Link to={`/bunkers/${bunkerId}`} className="btn-secondary">ביטול</Link>
        </div>
      </form>
    </div>
  );
}
