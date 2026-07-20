import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getAmmoTypes, createAmmoType, updateAmmoType, deleteAmmoType } from '../api/client';
import type { AmmoType, TrackingType } from '../types';
import { Plus, Pencil, Trash2, Save, X, Hash, Layers, Calculator } from 'lucide-react';

const CATEGORIES = ['תחמושת', 'ציוד', 'אחר'];

const TRACKING_TYPES: Array<{ value: TrackingType; label: string; desc: string; color: string }> = [
  { value: 'qty',    label: 'כמות בלבד',    desc: 'מנוהל רק לפי כמות כוללת',          color: 'bg-gray-100 text-gray-700' },
  { value: 'batch',  label: 'כמות + סדרה',  desc: 'ניהול כמות מכל סדרה (לוט/אצווה)',  color: 'bg-blue-100 text-blue-700' },
  { value: 'serial', label: 'מספר סידורי',  desc: 'מעקב אחרי כל פריט בנפרד',         color: 'bg-purple-100 text-purple-700' },
];

export function TrackingBadge({ type }: { type: TrackingType }) {
  const t = TRACKING_TYPES.find(t => t.value === type)!;
  const Icon = type === 'serial' ? Hash : type === 'batch' ? Layers : Calculator;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>
      <Icon size={11} />{t.label}
    </span>
  );
}

interface AmmoForm {
  name: string;
  unit: string;
  category: string;
  tracking_type: TrackingType;
}
const emptyForm: AmmoForm = { name: '', unit: "יח'", category: 'תחמושת', tracking_type: 'qty' };

export default function AmmoTypes() {
  const [types, setTypes] = useState<AmmoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AmmoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');

  const load = async () => {
    try {
      setTypes(await getAmmoTypes());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId !== null) {
        await updateAmmoType(editId, form);
        toast.success('פריט עודכן');
      } else {
        await createAmmoType(form);
        toast.success('פריט נוסף');
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (t: AmmoType) => {
    setEditId(t.id);
    setForm({ name: t.name, unit: t.unit, category: t.category, tracking_type: t.tracking_type });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('למחוק פריט זה?')) return;
    try {
      await deleteAmmoType(id);
      toast.success('פריט נמחק');
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'שגיאה במחיקה');
    }
  };

  const filtered = filterCat ? types.filter(t => t.category === filterCat) : types;
  const grouped = filtered.reduce<Record<string, AmmoType[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">סוגי תחמושת וציוד</h1>
          <p className="text-sm text-gray-500 mt-0.5">ניהול הרשימה הדינמית של פריטים</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          פריט חדש
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{editId !== null ? 'עריכת פריט' : 'הוספת פריט חדש'}</h2>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4">
            <div>
              <label className="label">שם הפריט *</label>
              <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder='לדוגמה: רימון הלם' required />
            </div>
            <div>
              <label className="label">יחידת מידה</label>
              <input className="input" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="יח' / כד' / ק&quot;ג" />
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">אופן ניהול</label>
              <select className="input" value={form.tracking_type} onChange={e => setForm(p => ({ ...p, tracking_type: e.target.value as TrackingType }))}>
                {TRACKING_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                ))}
              </select>
            </div>
            <div className="col-span-4 flex gap-2">
              <button type="submit" className="btn-primary flex items-center gap-1.5" disabled={saving}>
                <Save size={14} />
                {saving ? 'שומר...' : editId !== null ? 'עדכן' : 'הוסף'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="btn-secondary">ביטול</button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!filterCat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          הכל ({types.length})
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCat === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c} ({types.filter(t => t.category === c).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="card overflow-hidden mb-4">
            <div className="bg-gray-50 px-4 py-2.5 border-b flex items-center justify-between">
              <span className="font-semibold text-gray-700">{category}</span>
              <span className="text-xs text-gray-400">{items.length} פריטים</span>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">שם הפריט</th>
                  <th className="table-th">יח"ש</th>
                    <th className="table-th">אופן ניהול</th>
                    <th className="table-th">נוצר</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="table-td font-medium">{t.name}</td>
                      <td className="table-td text-gray-500">{t.unit}</td>
                      <td className="table-td"><TrackingBadge type={t.tracking_type} /></td>
                    <td className="table-td text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString('he-IL')}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="עריכה">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="מחיקה">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
