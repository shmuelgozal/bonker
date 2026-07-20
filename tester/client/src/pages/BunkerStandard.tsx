import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAmmoTypes, getStandard, updateStandard, getGaps, getBunker } from '../api/client';
import type { AmmoType, GapItem, Bunker } from '../types';
import { ArrowRight, Save, AlertTriangle, CheckCircle, ShieldCheck, Download } from 'lucide-react';

export default function BunkerStandard() {
  const { id } = useParams<{ id: string }>();
  const bunkerId = id;

  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [ammoTypes, setAmmoTypes] = useState<AmmoType[]>([]);
  const [standardValues, setStandardValues] = useState<Record<string, string>>({});
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [gapSummary, setGapSummary] = useState({ total: 0, deficit: 0, ok: 0 });
  const [activeTab, setActiveTab] = useState<'edit' | 'gaps'>('gaps');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const [b, types, std, gapData] = await Promise.all([
        getBunker(bunkerId!),
        getAmmoTypes(),
        getStandard(bunkerId!),
        getGaps(bunkerId!),
      ]);
      setBunker(b);
      setAmmoTypes(types);
      setGaps(gapData.gaps);
      setGapSummary(gapData.summary);

      const stdMap: Record<number, string> = {};
      std.forEach(s => { stdMap[s.ammo_type_id] = String(s.required_qty); });
      setStandardValues(stdMap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [bunkerId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const items = Object.entries(standardValues)
        .filter(([, v]) => v !== '' && Number(v) > 0)
        .map(([ammo_type_id, required_qty]) => ({
          ammo_type_id: Number(ammo_type_id),
          required_qty: Number(required_qty),
        }));

      await updateStandard(bunkerId, items);
      toast.success('תו תקן עודכן');
      await loadAll();
      setActiveTab('gaps');
    } catch {
      toast.error('שגיאה בשמירת תו תקן');
    } finally {
      setSaving(false);
    }
  };

  const grouped = ammoTypes.reduce<Record<string, AmmoType[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  const gapGrouped = gaps.reduce<Record<string, GapItem[]>>((acc, g) => {
    (acc[g.category] = acc[g.category] || []).push(g);
    return acc;
  }, {});

  const exportToCSV = () => {
    if (gaps.length === 0) { toast.error('אין פערים לייצוא'); return; }
    const headers = ['קטגוריה', 'שם הפריט', 'יח"ש', 'תו תקן', 'מלאי קיים', 'פער', 'סטטוס'];
    const rows = gaps.map(g => {
      const isOk = g.gap >= 0;
      const isPartial = g.gap < 0 && (g.current_qty / g.required_qty) >= 0.5;
      const status = isOk ? 'תקין' : isPartial ? 'חלקי' : 'חסר';
      return [
        g.category,
        g.ammo_name,
        g.unit,
        g.required_qty,
        g.current_qty,
        g.gap,
        status,
      ];
    });
    
    // Create CSV with proper escaping and UTF-8 BOM
    const escapeCsv = (field: any) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
    ].join('\n');
    
    // Add UTF-8 BOM for proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gaps-${bunker?.name?.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    toast.success('הפערים יוצאו לקובץ CSV');
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to={`/bunkers/${bunkerId}`} className="text-gray-400 hover:text-gray-600"><ArrowRight size={18} /></Link>
        <span className="text-gray-400 text-sm">{bunker?.name}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 text-sm font-medium">תו תקן</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck size={22} className="text-blue-600" />
          תו תקן — {bunker?.name}
        </h1>
        {gapSummary.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="badge-ok flex items-center gap-1">
              <CheckCircle size={13} /> {gapSummary.ok} תקין
            </span>
            {gapSummary.deficit > 0 && (
              <span className="badge-danger flex items-center gap-1">
                <AlertTriangle size={13} /> {gapSummary.deficit} חסר
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-5">
        <nav className="flex gap-1">
          {(['gaps', 'edit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'gaps' ? 'פערים' : 'עריכת תו תקן'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'gaps' && (
        <>
          {gaps.length === 0 ? (
            <div className="card p-12 text-center text-gray-400">
              <ShieldCheck size={40} className="mx-auto mb-2 text-gray-300" />
              <p>לא הוגדר תו תקן לבונקר זה</p>
              <button onClick={() => setActiveTab('edit')} className="btn-primary mt-3 text-sm">
                הגדר תו תקן
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors">
                  <Download size={16} />
                  ייצוא לـ CSV
                </button>
              </div>
              {Object.entries(gapGrouped).map(([category, items]) => (
              <div key={category} className="card overflow-hidden mb-4">
                <div className="bg-gray-50 px-4 py-2.5 border-b">
                  <span className="font-semibold text-gray-700 text-sm">{category}</span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-th">פריט</th>
                      <th className="table-th">יח"ש</th>
                      <th className="table-th text-center">תו תקן</th>
                      <th className="table-th text-center">מלאי קיים</th>
                      <th className="table-th text-center">פער</th>
                      <th className="table-th text-center">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(g => {
                      const pct = g.required_qty > 0 ? Math.min(100, (g.current_qty / g.required_qty) * 100) : 100;
                      const isOk = g.gap >= 0;
                      const isPartial = g.gap < 0 && pct >= 50;
                      return (
                        <tr key={g.ammo_type_id} className="hover:bg-gray-50">
                          <td className="table-td font-medium">{g.ammo_name}</td>
                          <td className="table-td text-gray-500">{g.unit}</td>
                          <td className="table-td text-center font-medium">{g.required_qty}</td>
                          <td className="table-td text-center font-bold">{g.current_qty}</td>
                          <td className={`table-td text-center font-bold ${isOk ? 'text-green-600' : 'text-red-600'}`}>
                            {g.gap > 0 ? '+' : ''}{g.gap}
                          </td>
                          <td className="table-td text-center">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isOk ? 'bg-green-500' : isPartial ? 'bg-yellow-400' : 'bg-red-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${isOk ? 'text-green-600' : isPartial ? 'text-yellow-600' : 'text-red-600'}`}>
                                {isOk ? 'תקין' : isPartial ? 'חלקי' : 'חסר'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              ))}
            </>
          )}
        </>
      )}

      {activeTab === 'edit' && (
        <>
          <div className="text-sm text-gray-500 mb-4">
            הגדר את הכמות הנדרשת לכל פריט. פריטים עם ערך 0 לא ייכללו בתו תקן.
          </div>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card overflow-hidden mb-4">
              <div className="bg-gray-50 px-4 py-2.5 border-b">
                <span className="font-semibold text-gray-700 text-sm">{category}</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">פריט</th>
                    <th className="table-th">יח"ש</th>
                    <th className="table-th text-center">כמות נדרשת בתו תקן</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="table-td font-medium">{t.name}</td>
                      <td className="table-td text-gray-500">{t.unit}</td>
                      <td className="table-td text-center">
                        <input
                          type="number"
                          min="0"
                          className="input w-24 text-center mx-auto"
                          value={standardValues[t.id] ?? ''}
                          onChange={e => setStandardValues(prev => ({ ...prev, [t.id]: e.target.value }))}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="flex gap-3 mt-2">
            <button onClick={handleSave} className="btn-primary flex items-center gap-2" disabled={saving}>
              <Save size={15} />
              {saving ? 'שומר...' : 'שמור תו תקן'}
            </button>
            <button onClick={() => setActiveTab('gaps')} className="btn-secondary">ביטול</button>
          </div>
        </>
      )}
    </div>
  );
}
