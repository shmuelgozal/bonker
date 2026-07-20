import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getBunkers, createBunker, updateBunker, deleteBunker } from '../api/client';
import type { Bunker } from '../types';
import { Plus, Pencil, Trash2, MapPin, ChevronLeft, Network } from 'lucide-react';

interface BunkerForm {
  name: string;
  location: string;
  description: string;
}

const emptyForm: BunkerForm = { name: '', location: '', description: '' };

export default function BunkersList() {
  const [bunkers, setBunkers] = useState<Bunker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<BunkerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setBunkers(await getBunkers());
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
        await updateBunker(editId, form);
        toast.success('בונקר עודכן בהצלחה');
      } else {
        await createBunker(form);
        toast.success('בונקר נוצר בהצלחה');
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch {
      toast.error('שגיאה בשמירת הבונקר');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (b: Bunker) => {
    setEditId(b.id);
    setForm({ name: b.name, location: b.location ?? '', description: b.description ?? '' });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('האם למחוק את הבונקר? פעולה זו לא ניתנת לביטול.')) return;
    try {
      await deleteBunker(id);
      toast.success('בונקר נמחק');
      await load();
    } catch {
      toast.error('שגיאה במחיקת הבונקר');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">בונקרים</h1>
          <p className="text-sm text-gray-500 mt-0.5">ניהול רשימת הבונקרים</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          בונקר חדש
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editId !== null ? 'עריכת בונקר' : 'הוספת בונקר חדש'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">שם הבונקר *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="לדוגמה: בונקר א'"
                required
              />
            </div>
            <div>
              <label className="label">מיקום</label>
              <input
                className="input"
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="לדוגמה: עמדה 3"
              />
            </div>
            <div>
              <label className="label">תיאור</label>
              <input
                className="input"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="תיאור קצר"
              />
            </div>
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'שומר...' : editId !== null ? 'עדכן' : 'צור בונקר'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowForm(false); setEditId(null); }}
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center h-40 items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : bunkers.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">
          <p className="text-lg">אין בונקרים עדיין</p>
          <p className="text-sm mt-1">לחץ "בונקר חדש" להוספה</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">שם הבונקר</th>
                <th className="table-th">מסגרת</th>
                <th className="table-th">מיקום</th>
                <th className="table-th">תיאור</th>
                <th className="table-th">נוצר</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bunkers.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium">
                    <Link to={`/bunkers/${b.id}`} className="text-blue-600 hover:underline flex items-center gap-1">
                      {b.name}
                      <ChevronLeft size={14} className="text-gray-400" />
                    </Link>
                  </td>
                  <td className="table-td">
                    {b.unit_name ? (
                      <span className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                        <Network size={12} />{b.unit_name}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="table-td text-gray-500">
                    {b.location ? (
                      <span className="flex items-center gap-1"><MapPin size={13} />{b.location}</span>
                    ) : '—'}
                  </td>
                  <td className="table-td text-gray-500">{b.description || '—'}</td>
                  <td className="table-td text-gray-400 text-xs">
                    {new Date(b.created_at).toLocaleDateString('he-IL')}
                  </td>
                  <td className="table-td">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(b)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                        title="עריכה"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                        title="מחיקה"
                      >
                        <Trash2 size={14} />
                      </button>
                      <Link
                        to={`/bunkers/${b.id}`}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        פתח
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
