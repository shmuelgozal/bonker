import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAmmoTypes, addInventoryEntry, getBunker } from '../api/client';
import type { AmmoType, Bunker, TrackingType } from '../types';
import { ArrowRight, Save, Plus, Trash2 } from 'lucide-react';
import { TrackingBadge } from './AmmoTypes';

interface BatchRow { batch_number: string; quantity: number }

export default function BunkerInventoryAdd() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bunkerId = id;

  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [ammoTypes, setAmmoTypes] = useState<AmmoType[]>([]);
  const [ammoTypeId, setAmmoTypeId] = useState('');
  const [trackingType, setTrackingType] = useState<TrackingType>('qty');

  // qty
  const [quantityDelta, setQuantityDelta] = useState('');
  const [entryType, setEntryType] = useState<'add' | 'adjust'>('add');

  // batch
  const [batchRows, setBatchRows] = useState<BatchRow[]>([{ batch_number: '', quantity: 0 }]);

  // serial
  const [serialsText, setSerialsText] = useState('');

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getBunker(bunkerId!), getAmmoTypes()]).then(([b, types]) => {
      setBunker(b); setAmmoTypes(types);
    });
  }, [bunkerId]);

  const handleTypeChange = (val: string) => {
    setAmmoTypeId(val);
    const t = ammoTypes.find(a => a.id === val);
    setTrackingType(t?.tracking_type ?? 'qty');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ammoTypeId) return;
    setSaving(true);
    try {
      if (trackingType === 'qty') {
        if (!quantityDelta) { toast.error('הזן כמות'); return; }
        await addInventoryEntry(bunkerId!, {
          ammo_type_id: ammoTypeId!,
          quantity_delta: Number(quantityDelta),
          entry_type: entryType, notes,
        });
      } else if (trackingType === 'batch') {
        const valid = batchRows.filter(b => b.batch_number.trim() && b.quantity > 0);
        if (!valid.length) { toast.error('הזן לפחות סדרה אחת עם כמות'); return; }
        await addInventoryEntry(bunkerId!, { ammo_type_id: ammoTypeId, batches: valid, notes });
      } else {
        const serials = serialsText.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
        if (!serials.length) { toast.error('הזן לפחות מספר סידורי אחד'); return; }
        await addInventoryEntry(bunkerId!, { ammo_type_id: ammoTypeId, serial_numbers: serials, notes });
      }
      toast.success('מלאי עודכן בהצלחה');
      navigate(`/bunkers/${bunkerId!}`);
    } catch {
      toast.error('שגיאה בעדכון המלאי');
    } finally { setSaving(false); }
  };

  const grouped = ammoTypes.reduce<Record<string, AmmoType[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t); return acc;
  }, {});

  const selectedType = ammoTypes.find(a => a.id === ammoTypeId);
  const batchTotal = batchRows.reduce((s, b) => s + (b.quantity || 0), 0);
  const serialCount = serialsText.split(/[\n,]/).map(s => s.trim()).filter(Boolean).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to={`/bunkers/${bunkerId}`} className="text-gray-400 hover:text-gray-600"><ArrowRight size={18} /></Link>
        <span className="text-gray-400 text-sm">{bunker?.name || 'בונקר'}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 text-sm font-medium">הזנת מלאי</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-5">הזנת מלאי</h1>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Item selector */}
          <div>
            <label className="label">סוג תחמושת / ציוד *</label>
            <select className="input" value={ammoTypeId} onChange={e => handleTypeChange(e.target.value)} required>
              <option value="">-- בחר פריט --</option>
              {Object.entries(grouped).map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </optgroup>
              ))}
            </select>
            {selectedType && (
              <div className="mt-1.5 flex items-center gap-2">
                <TrackingBadge type={selectedType.tracking_type} />
                <span className="text-xs text-gray-400">
                  {selectedType.tracking_type === 'batch' ? 'יש להגיד כמות מכל סדרה' :
                   selectedType.tracking_type === 'serial' ? 'יש להזין מספרים סידוריים לכל פריט' :
                   'הזן כמות כוללת'}
                </span>
              </div>
            )}
          </div>

          {/* qty form */}
          {trackingType === 'qty' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">סוג פעולה</label>
                <div className="flex gap-3 mt-1">
                  {(['add', 'adjust'] as const).map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" value={v} checked={entryType === v} onChange={() => setEntryType(v)} />
                      <span className="text-sm">{v === 'add' ? 'הוספה' : 'תיקון (שלילי/חיובי)'}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">כמות *</label>
                <input type="number" className="input" value={quantityDelta}
                  onChange={e => setQuantityDelta(e.target.value)}
                  placeholder={entryType === 'adjust' ? 'לדוגמה: -5 או +10' : 'לדוגמה: 20'} required />
              </div>
            </div>
          )}

          {/* batch form */}
          {trackingType === 'batch' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">סדרות (לוטים)</label>
                <span className="text-xs text-gray-500">סה"כ: <strong>{batchTotal}</strong></span>
              </div>
              <div className="space-y-2">
                {batchRows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className="input flex-1" value={row.batch_number}
                      onChange={e => setBatchRows(prev => prev.map((r, idx) => idx === i ? { ...r, batch_number: e.target.value } : r))}
                      placeholder="מספר סדרה / לוט" />
                    <input type="number" min="1" className="input w-28 text-center"
                      value={row.quantity || ''}
                      onChange={e => setBatchRows(prev => prev.map((r, idx) => idx === i ? { ...r, quantity: Number(e.target.value) } : r))}
                      placeholder="כמות" />
                    <button type="button" onClick={() => setBatchRows(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1.5 text-gray-400 hover:text-red-600" disabled={batchRows.length === 1}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setBatchRows(prev => [...prev, { batch_number: '', quantity: 0 }])}
                className="mt-2 btn-secondary text-xs flex items-center gap-1">
                <Plus size={13} /> הוסף סדרה
              </button>
            </div>
          )}

          {/* serial form */}
          {trackingType === 'serial' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">מספרים סידוריים</label>
                <span className="text-xs text-gray-500">{serialCount} פריטים</span>
              </div>
              <textarea className="input min-h-[120px] resize-y font-mono text-sm" value={serialsText}
                onChange={e => setSerialsText(e.target.value)}
                placeholder={"הזן מספר סידורי בכל שורה, או הפרד בפסיקים:\nSN-001\nSN-002\nSN-003"} />
              <p className="text-xs text-gray-400 mt-1">ניתן להדביק מגיליון Excel — כל שורה = פריט אחד</p>
            </div>
          )}

          {/* notes */}
          <div>
            <label className="label">הערות</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערה אופציונלית" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
              <Save size={15} />
              {saving ? 'שומר...' : 'שמור מלאי'}
            </button>
            <Link to={`/bunkers/${bunkerId}`} className="btn-secondary">ביטול</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
