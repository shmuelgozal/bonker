import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getAmmoTypes, getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api/client';
import type { AmmoType } from '../types';
import { Settings as SettingsIcon, Plus, Pencil, Trash2, Save, X, RefreshCw, ClipboardList } from 'lucide-react';

// ─── Template editor (inline) ────────────────────────────────────────────────
interface EditorProps {
  name: string;
  items: Record<string, number>;
  ammoTypes: AmmoType[];
  onSave: (name: string, items: Record<string, number>) => void;
  onCancel: () => void;
  isNew?: boolean;
}

function TemplateEditor({ name: initName, items: initItems, ammoTypes, onSave, onCancel, isNew }: EditorProps) {
  const [name, setName] = useState(initName);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    ammoTypes.forEach(t => {
      const key = Object.keys(initItems).find(k => k.toLowerCase() === t.name.toLowerCase());
      m[t.id] = key !== undefined ? String(initItems[key]) : '';
    });
    return m;
  });

  const grouped = ammoTypes.reduce<Record<string, AmmoType[]>>((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  const handleSave = () => {
    if (!name.trim()) { toast.error('נדרש שם לטמפלייט'); return; }
    const byName: Record<string, number> = {};
    ammoTypes.forEach(t => {
      const v = Number(values[t.id]);
      if (v > 0) byName[t.name] = v;
    });
    onSave(name.trim(), byName);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <ClipboardList size={18} className="text-blue-600" />
        <h3 className="font-semibold text-gray-800">{isNew ? 'טמפלייט חדש' : `עריכת: ${initName}`}</h3>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">שם הטמפלייט</label>
        <input
          className="input w-full max-w-xs"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='לדוגמה: רכב סי'
          dir="rtl"
        />
      </div>

      {Object.entries(grouped).map(([category, types]) => (
        <div key={category} className="card overflow-hidden mb-4">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <span className="text-sm font-semibold text-gray-700">{category}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">פריט</th>
                <th className="table-th">יח&quot;ש</th>
                <th className="table-th text-center">כמות בטמפלייט</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {types.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{t.name}</td>
                  <td className="table-td text-gray-500">{t.unit}</td>
                  <td className="table-td text-center">
                    <input
                      type="number"
                      min="0"
                      className="input w-24 text-center mx-auto"
                      value={values[t.id] ?? ''}
                      onChange={e => setValues(prev => ({ ...prev, [t.id]: e.target.value }))}
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
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save size={15} /> שמור
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
          <X size={15} /> ביטול
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────
export default function Settings() {
  const [ammoTypes, setAmmoTypes] = useState<AmmoType[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; items: Record<string, number> }>>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // null = not editing; '' = new
  const [activeTab, setActiveTab] = useState<'templates'>('templates');

  useEffect(() => {
    Promise.all([getAmmoTypes(), getTemplates()])
      .then(([types, tmpls]) => {
        setAmmoTypes(types);
        setTemplates(tmpls.map(t => ({ id: t.id, name: t.name, items: t.items })));
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = async (updated: Array<{ id: string; name: string; items: Record<string, number> }>) => {
    setTemplates(updated);
  };

  const handleSave = async (oldId: string | '', oldName: string, newName: string, items: Record<string, number>) => {
    try {
      if (oldId === '') {
        // Creating new template
        const created = await createTemplate({ name: newName, items });
        setTemplates(prev => [...prev, { id: created.id, name: created.name, items: created.items }]);
        toast.success('הטמפלייט נוצר בהצלחה');
      } else {
        // Updating existing template
        const updated = await updateTemplate(oldId, { name: newName, items });
        setTemplates(prev => prev.map(t => t.id === oldId ? { id: updated.id, name: updated.name, items: updated.items } : t));
        toast.success('הטמפלייט עודכן בהצלחה');
      }
      setEditingId(null);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'שגיאה בשמירת הטמפלייט';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`למחוק את הטמפלייט "${name}"?`)) return;
    try {
      await deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('הטמפלייט נמחק');
    } catch {
      toast.error('שגיאה במחיקת הטמפלייט');
    }
  };

  const handleReset = async () => {
    if (!confirm('לאפס את כל הטמפלייטים לברירת המחדל?')) return;
    try {
      // מחיקה של כל הטמפלייטים הקיימים
      for (const t of templates) {
        await deleteTemplate(t.id);
      }
      // הוספה של ברירות המחדל
      const defaultTemplates: Array<{ name: string; items: Record<string, number> }> = [
        {
          name: 'רכב סי',
          items: {
            'גומי': 40,
            'תחמיש': 58,
            'מטול לתאורה': 4,
            'מטול גז': 28,
            'ספוג': 28,
            'רימון הלם': 18,
            'רימון גז': 8,
            'רימון עשן': 1,
            'תופי': 1,
            'רומה גומי': 1,
            'רימון רסס': 8,
            'לאו': 1,
          },
        },
        {
          name: 'רכב חפ"ק',
          items: {
            'גומי': 40,
            'תחמיש': 58,
            'מטול לתאורה': 4,
            'מטול גז': 28,
            'ספוג': 28,
            'רימון הלם': 18,
            'רימון גז': 8,
            'רימון עשן': 0,
            'תופי': 0,
            'רומה גומי': 1,
            'רימון רסס': 8,
            'לאו': 2,
          },
        },
        {
          name: 'רכב כיתת כוננות',
          items: {
            'גומי': 24,
            'תחמיש': 58,
            'מטול לתאורה': 10,
            'מטול גז': 28,
            'ספוג': 28,
            'רימון הלם': 18,
            'רימון גז': 8,
            'רימון עשן': 3,
            'תופי': 1,
            'רומה גומי': 2,
            'רימון רסס': 16,
            'לאו': 2,
          },
        },
        {
          name: 'פילבוקס',
          items: {
            'גומי': 48,
            'תחמיש': 116,
            'מטול לתאורה': 20,
            'מטול גז': 56,
            'ספוג': 56,
            'רימון הלם': 36,
            'רימון גז': 16,
            'רימון עשן': 3,
            'תופי': 2,
            'רומה גומי': 2,
            'רימון רסס': 0,
            'לאו': 0,
          },
        },
      ];
      const created = await Promise.all(defaultTemplates.map(t => createTemplate(t)));
      setTemplates(created.map(t => ({ id: t.id, name: t.name, items: t.items })));
      toast.success('הטמפלייטים אופסו לברירת מחדל');
    } catch {
      toast.error('שגיאה באפסון הטמפלייטים');
    }
  };

  if (loading) return (
    <div className="flex justify-center h-64 items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <SettingsIcon size={22} className="text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900">הגדרות</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="flex items-center gap-2"><ClipboardList size={15} />טמפלייטים לתו תקן</span>
          </button>
        </nav>
      </div>

      {activeTab === 'templates' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              טמפלייטים מאפשרים מילוי מהיר של תו תקן לפי סוג הנכס. ניתן לערוך ולשנות לאחר ההחלה.
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={14} /> ברירת מחדל
              </button>
              <button
                onClick={() => setEditingId('')}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <Plus size={15} /> טמפלייט חדש
              </button>
            </div>
          </div>

          {/* New template editor */}
          {editingId === '' && (
            <div className="mb-4">
              <TemplateEditor
                name=""
                items={{}}
                ammoTypes={ammoTypes}
                isNew
                onSave={(name, items) => handleSave('', '', name, items)}
                onCancel={() => setEditingId(null)}
              />
            </div>
          )}

          {/* Template list */}
          {templates.length === 0 && editingId === null && (
            <div className="card p-12 text-center text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-2 text-gray-300" />
              <p>אין טמפלייטים מוגדרים</p>
            </div>
          )}

          {templates.map(tpl => (
            <div key={tpl.id} className="mb-4">
              {editingId === tpl.id ? (
                <TemplateEditor
                  name={tpl.name}
                  items={tpl.items}
                  ammoTypes={ammoTypes}
                  onSave={(newName, newItems) => handleSave(tpl.id, tpl.name, newName, newItems)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="card p-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                      <ClipboardList size={16} className="text-blue-500" />
                      {tpl.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Object.keys(tpl.items).length} פריטים ·{' '}
                      {Object.entries(tpl.items).slice(0, 4).map(([n, q]) => `${n} ×${q}`).join(', ')}
                      {Object.keys(tpl.items).length > 4 ? '...' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(tpl.id)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="ערוך"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id, tpl.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="מחק"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
