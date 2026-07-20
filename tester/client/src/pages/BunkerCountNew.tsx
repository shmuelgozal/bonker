import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAmmoTypes, getInventory, createCount, updateCount, getBunker } from '../api/client';
import type { AmmoType, InventoryItem, Bunker } from '../types';
import { ArrowRight, Save, CheckCircle } from 'lucide-react';

export default function BunkerCountNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bunkerId = Number(id);

  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [ammoTypes, setAmmoTypes] = useState<AmmoType[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Record<number, number>>({});
  const [countValues, setCountValues] = useState<Record<number, string>>({});
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getBunker(bunkerId), getAmmoTypes(), getInventory(bunkerId)]).then(([b, types, inv]) => {
      setBunker(b);
      setAmmoTypes(types);
      const invMap: Record<number, number> = {};
      inv.forEach((i: InventoryItem) => { invMap[i.ammo_type_id] = i.quantity; });
      setCurrentInventory(invMap);
      // Pre-fill with current values
      const defaults: Record<number, string> = {};
      types.forEach(t => { defaults[t.id] = String(invMap[t.id] ?? ''); });
      setCountValues(defaults);
    });
  }, [bunkerId]);

  const handleSaveAndComplete = async (syncInventory: boolean) => {
    setSaving(true);
    try {
      const items = ammoTypes
        .filter(t => countValues[t.id] !== '' && countValues[t.id] !== undefined)
        .map(t => ({ ammo_type_id: t.id, counted_qty: Number(countValues[t.id]) || 0 }));

      if (items.length === 0) {
        toast.error('יש להזין לפחות ערך אחד');
        return;
      }

      const count = await createCount(bunkerId, { count_date: countDate, notes, items });
      if (syncInventory) {
        await updateCount(bunkerId, count.id, { status: 'complete', sync_inventory: true });
        toast.success('ספירה הושלמה ומלאי עודכן');
      } else {
        await updateCount(bunkerId, count.id, { status: 'complete' });
        toast.success('ספירה נשמרה');
      }
      navigate(`/bunkers/${bunkerId}`);
    } catch {
      toast.error('שגיאה בשמירת הספירה');
    } finally {
      setSaving(false);
    }
  };

  const grouped = ammoTypes.reduce<Record<string, AmmoType[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to={`/bunkers/${bunkerId}`} className="text-gray-400 hover:text-gray-600"><ArrowRight size={18} /></Link>
        <span className="text-gray-400 text-sm">{bunker?.name || 'בונקר'}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 text-sm font-medium">ספירת מלאי</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-5">ספירת מלאי חדשה</h1>

      <div className="card p-6 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">תאריך ספירה</label>
            <input
              type="date"
              className="input"
              value={countDate}
              onChange={e => setCountDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">הערות</label>
            <input
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="הערה אופציונלית"
            />
          </div>
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="card overflow-hidden mb-4">
          <div className="bg-gray-50 px-4 py-2.5 border-b">
            <span className="text-sm font-semibold text-gray-600">{category}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">פריט</th>
                <th className="table-th">יח"ש</th>
                <th className="table-th">מלאי קיים</th>
                <th className="table-th">כמות נספרה</th>
                <th className="table-th">הפרש</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(t => {
                const current = currentInventory[t.id] ?? 0;
                const counted = Number(countValues[t.id] ?? '');
                const diff = isNaN(counted) ? null : counted - current;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="table-td font-medium">{t.name}</td>
                    <td className="table-td text-gray-500">{t.unit}</td>
                    <td className="table-td text-gray-500">{current}</td>
                    <td className="table-td">
                      <input
                        type="number"
                        min="0"
                        className="input w-24 text-center"
                        value={countValues[t.id] ?? ''}
                        onChange={e => setCountValues(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="—"
                      />
                    </td>
                    <td className="table-td">
                      {diff !== null ? (
                        <span className={`font-bold ${diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {diff > 0 ? '+' : ''}{diff}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => handleSaveAndComplete(true)}
          className="btn-primary flex items-center gap-2"
          disabled={saving}
        >
          <CheckCircle size={15} />
          {saving ? 'שומר...' : 'שמור וסנכרן מלאי'}
        </button>
        <button
          onClick={() => handleSaveAndComplete(false)}
          className="btn-secondary flex items-center gap-2"
          disabled={saving}
        >
          <Save size={15} />
          שמור ללא סנכרון
        </button>
        <Link to={`/bunkers/${bunkerId}`} className="btn-secondary">ביטול</Link>
      </div>
    </div>
  );
}
