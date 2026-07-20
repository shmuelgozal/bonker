import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getIssuance, getBunker, updateIssuance } from '../api/client';
import type { Issuance, IssuanceItem, Bunker } from '../types';
import { ArrowRight, Pencil, X, Save, Camera } from 'lucide-react';

type IssuanceWithItems = Issuance & { items: IssuanceItem[] };

export default function IssuanceDetail() {
  const { id, issuanceId } = useParams<{ id: string; issuanceId: string }>();
  const bunkerId = id;

  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [issuance, setIssuance] = useState<IssuanceWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [itemQtys, setItemQtys] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [b, iss] = await Promise.all([getBunker(bunkerId!), getIssuance(bunkerId!, issuanceId!)]);
    setBunker(b);
    setIssuance(iss);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [bunkerId, issuanceId]);

  const startEdit = () => {
    if (!issuance) return;
    setRecipientName(issuance.recipient_name || '');
    setRecipientId(issuance.recipient_id || '');
    setUnitName(issuance.unit_name || '');
    setIssueDate(issuance.issue_date || '');
    setNotes(issuance.notes || '');
    setNewImage(null);
    const qtys: Record<number, number> = {};
    issuance.items.forEach(item => { qtys[item.id] = item.quantity; });
    setItemQtys(qtys);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!issuance) return;
    setSaving(true);
    try {
      const fd = new FormData();
      if (recipientName) fd.append('recipient_name', recipientName);
      if (recipientId) fd.append('recipient_id', recipientId);
      if (unitName) fd.append('unit_name', unitName);
      if (issueDate) fd.append('issue_date', issueDate);
      fd.append('notes', notes);
      if (newImage) fd.append('form_image', newImage);

      // Item quantity updates
      const itemUpdates = issuance.items
        .filter(item => itemQtys[item.id] !== item.quantity)
        .map(item => ({ issuance_item_id: item.id, new_quantity: itemQtys[item.id] ?? item.quantity }));
      if (itemUpdates.length) fd.append('items', JSON.stringify(itemUpdates));

      await updateIssuance(bunkerId, issuance.id, fd);
      await load();
      setEditing(false);
      toast.success('הנפקה עודכנה בהצלחה');
    } catch {
      toast.error('שגיאה בעדכון ההנפקה');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!issuance) return <div className="card p-8 text-center text-gray-500">הנפקה לא נמצאה</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to={`/bunkers/${bunkerId}`} className="text-gray-400 hover:text-gray-600"><ArrowRight size={18} /></Link>
        <span className="text-gray-400 text-sm">{bunker?.name}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 text-sm font-medium">הנפקה #{issuance.id}</span>
      </div>

      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">פרטי הנפקה</h1>
        {!editing ? (
          <button onClick={startEdit} className="btn-secondary flex items-center gap-2">
            <Pencil size={15} /> ערוך הנפקה
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2">
              <X size={15} /> ביטול
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={15} /> {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">פרטי מקבל</h2>
          {!editing ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">שם:</dt><dd className="font-medium">{issuance.recipient_name || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">מ.א.:</dt><dd className="font-medium">{issuance.recipient_id || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">יחידה:</dt><dd className="font-medium">{issuance.unit_name || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">תאריך:</dt><dd className="font-medium">{issuance.issue_date}</dd></div>
            </dl>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="label text-xs">שם</label>
                <input className="input text-sm" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="שם מקבל" />
              </div>
              <div>
                <label className="label text-xs">מ.א.</label>
                <input className="input text-sm" value={recipientId} onChange={e => setRecipientId(e.target.value)} placeholder="מספר אישי" />
              </div>
              <div>
                <label className="label text-xs">יחידה</label>
                <input className="input text-sm" value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="שם יחידה" />
              </div>
              <div>
                <label className="label text-xs">תאריך</label>
                <input type="date" className="input text-sm" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">טופס הנפקה</h2>
          {!editing ? (
            issuance.form_image_path ? (
              <a href={issuance.form_image_path} target="_blank" rel="noreferrer">
                <img src={issuance.form_image_path} alt="טופס הנפקה" className="rounded-lg max-h-48 object-contain border hover:opacity-80 transition-opacity cursor-pointer" />
              </a>
            ) : <p className="text-sm text-gray-400">אין תמונה</p>
          ) : (
            <div className="space-y-2">
              {(newImage ? URL.createObjectURL(newImage) : issuance.form_image_path) && (
                <img
                  src={newImage ? URL.createObjectURL(newImage) : issuance.form_image_path!}
                  alt="טופס" className="rounded max-h-36 object-contain border mb-2"
                />
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setNewImage(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs flex items-center gap-1">
                <Camera size={14} /> {newImage ? 'החלף תמונה' : 'העלה תמונה'}
              </button>
              {newImage && <p className="text-xs text-green-600">נבחר: {newImage.name}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h2 className="text-sm font-semibold text-gray-700">פריטים שהונפקו</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">קטגוריה</th>
              <th className="table-th">פריט</th>
              <th className="table-th">יח"ש</th>
              <th className="table-th text-center">כמות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issuance.items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="table-td text-gray-500">{item.category}</td>
                <td className="table-td font-medium">{item.ammo_name}</td>
                <td className="table-td text-gray-500">{item.unit}</td>
                <td className="table-td text-center">
                  {!editing ? (
                    <span className="font-bold text-lg">{item.quantity}</span>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      className="input w-20 text-center text-sm font-bold"
                      value={itemQtys[item.id] ?? item.quantity}
                      onChange={e => setItemQtys(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-600 text-left">סה"כ פריטים:</td>
              <td className="px-4 py-2 text-center font-bold text-gray-900">
                {editing
                  ? issuance.items.reduce((s, i) => s + (itemQtys[i.id] ?? i.quantity), 0)
                  : issuance.items.reduce((s, i) => s + i.quantity, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Notes */}
      {!editing ? (
        issuance.notes && (
          <div className="card p-4">
            <span className="text-xs font-semibold text-gray-500 uppercase">הערות: </span>
            <span className="text-sm text-gray-700">{issuance.notes}</span>
          </div>
        )
      ) : (
        <div className="card p-4">
          <label className="label text-xs">הערות</label>
          <textarea
            className="input text-sm"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="הערה אופציונלית"
          />
        </div>
      )}

      {editing && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          שינוי כמויות פריטים יעדכן את מלאי הבונקר בהתאם (הפרש בין הכמות החדשה לישנה).
        </div>
      )}
    </div>
  );
}
