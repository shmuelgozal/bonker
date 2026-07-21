import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getBunker, getInventory, getInventoryHistory, getCounts, getIssuances, getGaps, getBatches, getSerials } from '../api/client';
import type { Bunker, InventoryItem, InventoryEntry, InventoryCount, Issuance, GapsResponse, InventoryBatch, InventorySerial } from '../types';
import { Plus, ClipboardList, BookOpen, History, AlertTriangle, CheckCircle, ArrowRight, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { TrackingBadge } from './AmmoTypes';

type TabId = 'inventory' | 'history' | 'counts' | 'issuances';

export default function BunkerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bunkerId = id;

  const [bunker, setBunker] = useState<Bunker | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('inventory');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<InventoryEntry[]>([]);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [gaps, setGaps] = useState<GapsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<InventoryBatch[]>([]);
  const [expandedSerials, setExpandedSerials] = useState<InventorySerial[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [b, inv, gapData] = await Promise.all([
          getBunker(bunkerId!),
          getInventory(bunkerId!),
          getGaps(bunkerId!).catch(() => null),
        ]);
        setBunker(b);
        setInventory(inv);
        setGaps(gapData);
      } finally {
        setLoading(false);
      }
    })();
  }, [bunkerId]);

  useEffect(() => {
    if (activeTab === 'history' && history.length === 0) {
      getInventoryHistory(bunkerId!).then(setHistory);
    }
    if (activeTab === 'counts' && counts.length === 0) {
      getCounts(bunkerId!).then(setCounts);
    }
    if (activeTab === 'issuances' && issuances.length === 0) {
      getIssuances(bunkerId!).then(setIssuances);
    }
  }, [activeTab, bunkerId]);

  if (loading) {
    return <div className="flex justify-center h-64 items-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>;
  }

  if (!bunker) {
    return <div className="card p-8 text-center text-gray-500">בונקר לא נמצא</div>;
  }

  const hasDeficit = (gaps?.summary.deficit ?? 0) > 0;
  const grouped = inventory.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  const toggleExpand = async (item: InventoryItem) => {
    if (expandedItem === item.ammo_type_id) {
      setExpandedItem(null);
      return;
    }
    setExpandedItem(item.ammo_type_id);
    if (item.tracking_type === 'batch') {
      setExpandedBatches(await getBatches(bunkerId!, item.ammo_type_id));
      setExpandedSerials([]);
    } else if (item.tracking_type === 'serial') {
      setExpandedSerials(await getSerials(bunkerId!, item.ammo_type_id));
      setExpandedBatches([]);
    }
  };

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'inventory', label: 'מלאי נוכחי', icon: <BookOpen size={15} /> },
    { id: 'history', label: 'היסטוריה', icon: <History size={15} /> },
    { id: 'counts', label: 'ספירות מלאי', icon: <ClipboardList size={15} /> },
    { id: 'issuances', label: 'הנפקות', icon: <ClipboardList size={15} /> },
  ];

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/bunkers')} className="text-gray-400 hover:text-gray-600">
          <ArrowRight size={18} />
        </button>
        <span className="text-gray-400 text-sm">בונקרים</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-700 text-sm font-medium">{bunker.name}</span>
      </div>

      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{bunker.name}</h1>
          {bunker.location && <p className="text-sm text-gray-500">{bunker.location}</p>}
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 flex-shrink-0">
          {gaps && gaps.summary.total > 0 && (
            hasDeficit ? (
              <span className="badge-danger flex items-center gap-1 text-xs px-2 py-1">
                <AlertTriangle size={12} /> {gaps.summary.deficit} פערים
              </span>
            ) : (
              <span className="badge-ok flex items-center gap-1 text-xs px-2 py-1">
                <CheckCircle size={12} /> תקין
              </span>
            )
          )}
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <Link to={`/bunkers/${bunkerId}/standard`} className="btn-secondary flex items-center gap-1 text-xs px-2 py-1.5">
              <ShieldCheck size={13} />
              <span className="hidden sm:inline">תו תקן</span>
              <span className="sm:hidden">תקן</span>
            </Link>
            <Link to={`/bunkers/${bunkerId}/count/new`} className="btn-secondary flex items-center gap-1 text-xs px-2 py-1.5">
              <ClipboardList size={13} />
              <span className="hidden sm:inline">ספירת מלאי</span>
              <span className="sm:hidden">ספירה</span>
            </Link>
            <Link to={`/bunkers/${bunkerId}/issuance/new`} className="btn-secondary flex items-center gap-1 text-xs px-2 py-1.5">
              <ClipboardList size={13} />
              <span className="hidden sm:inline">הנפקה חדשה</span>
              <span className="sm:hidden">הנפקה</span>
            </Link>
            <Link to={`/bunkers/${bunkerId}/inventory/add`} className="btn-primary flex items-center gap-1 text-xs px-2 py-1.5">
              <Plus size={13} />
              <span className="hidden sm:inline">הזנת מלאי</span>
              <span className="sm:hidden">הזנה</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'inventory' && (
        <div className="card overflow-hidden">
          {inventory.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p>אין מלאי רשום</p>
              <Link to={`/bunkers/${bunkerId}/inventory/add`} className="btn-primary inline-flex mt-3 gap-1.5 items-center text-sm">
                <Plus size={14} /> הזן מלאי ראשון
              </Link>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-th">שם הפריט</th>
                        <th className="table-th hidden sm:table-cell">יח"ש</th>
                        <th className="table-th hidden sm:table-cell">אופן ניהול</th>
                        <th className="table-th text-left">כמות</th>
                        <th className="table-th hidden md:table-cell">עדכון אחרון</th>
                        <th className="table-th"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(item => (
                        <>
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="table-td font-medium">{item.ammo_name}</td>
                            <td className="table-td text-gray-500 hidden sm:table-cell">{item.unit}</td>
                            <td className="table-td hidden sm:table-cell"><TrackingBadge type={item.tracking_type} /></td>
                            <td className="table-td font-bold text-lg text-gray-900">{item.quantity}</td>
                            <td className="table-td text-gray-400 text-xs hidden md:table-cell">
                              {new Date(item.updated_at).toLocaleString('he-IL')}
                            </td>
                            <td className="table-td">
                              {(item.tracking_type === 'batch' || item.tracking_type === 'serial') && (
                                <button onClick={() => toggleExpand(item)}
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                  {expandedItem === item.ammo_type_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  {expandedItem === item.ammo_type_id ? 'סגור' : item.tracking_type === 'batch' ? 'סדרות' : 'מ"ס'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedItem === item.ammo_type_id && item.tracking_type === 'batch' && (
                            <tr key={`exp-${item.id}`}>
                              <td colSpan={6} className="bg-blue-50 px-8 py-3">
                                <p className="text-xs font-semibold text-blue-700 mb-2">פירוט סדרות:</p>
                                {expandedBatches.length === 0 ? (
                                  <p className="text-xs text-gray-400">אין סדרות</p>
                                ) : (
                                  <div className="rounded-lg border border-blue-200 bg-white overflow-hidden max-w-xl">
                                    <table className="w-full text-sm">
                                      <thead className="bg-blue-100/60">
                                        <tr>
                                          <th className="px-3 py-1.5 text-right text-xs font-semibold text-blue-800">סדרה</th>
                                          <th className="px-3 py-1.5 text-right text-xs font-semibold text-blue-800">כמות</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {expandedBatches.map(b => (
                                          <tr key={b.batch_number} className="border-t border-blue-100">
                                            <td className="px-3 py-1.5 font-mono font-medium text-gray-800">{b.batch_number}</td>
                                            <td className="px-3 py-1.5 text-blue-700 font-bold">{b.quantity}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                          {expandedItem === item.ammo_type_id && item.tracking_type === 'serial' && (
                            <tr key={`exp-${item.id}`}>
                              <td colSpan={6} className="bg-purple-50 px-8 py-3">
                                <p className="text-xs font-semibold text-purple-700 mb-2">
                                  מספרים סידוריים ({expandedSerials.filter(s => s.status === 'in_stock').length} במלאי, {expandedSerials.filter(s => s.status === 'issued').length} הונפקו):
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                  {expandedSerials.map(s => (
                                    <span key={s.serial_number}
                                      className={`font-mono text-xs px-2 py-0.5 rounded border ${s.status === 'in_stock' ? 'bg-white border-purple-200 text-gray-800' : 'bg-gray-100 border-gray-200 text-gray-400 line-through'}`}>
                                      {s.serial_number}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card overflow-hidden">
          {history.length === 0 ? (
            <div className="p-10 text-center text-gray-400">אין היסטוריית הזנות</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">תאריך</th>
                  <th className="table-th">פריט</th>
                  <th className="table-th">סוג</th>
                  <th className="table-th">כמות</th>
                  <th className="table-th hidden sm:table-cell">הערות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="table-td text-xs text-gray-400 whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="table-td font-medium">{entry.ammo_name}</td>
                    <td className="table-td">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        entry.entry_type === 'issuance' ? 'bg-orange-100 text-orange-700' :
                        entry.entry_type === 'count' ? 'bg-purple-100 text-purple-700' :
                        entry.entry_type === 'adjust' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {entry.entry_type === 'add' ? 'הוספה' :
                         entry.entry_type === 'issuance' ? 'הנפקה' :
                         entry.entry_type === 'count' ? 'ספירה' : 'תיקון'}
                      </span>
                    </td>
                    <td className={`table-td font-bold ${entry.quantity_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.quantity_delta >= 0 ? '+' : ''}{entry.quantity_delta}
                    </td>
                    <td className="table-td text-gray-400 text-xs">{entry.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'counts' && (
        <div>
          <div className="flex justify-end mb-3">
            <Link to={`/bunkers/${bunkerId}/count/new`} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} />
              ספירה חדשה
            </Link>
          </div>
          <div className="card overflow-hidden">
            {counts.length === 0 ? (
              <div className="p-10 text-center text-gray-400">אין ספירות רשומות</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">תאריך ספירה</th>
                    <th className="table-th">סטטוס</th>
                    <th className="table-th">פריטים</th>
                    <th className="table-th hidden sm:table-cell">הערות</th>
                    <th className="table-th hidden sm:table-cell">נוצר</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {counts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="table-td font-medium">{c.count_date}</td>
                      <td className="table-td">
                        <span className={c.status === 'complete' ? 'badge-ok' : 'badge-warning'}>
                          {c.status === 'complete' ? 'הושלמה' : 'טיוטה'}
                        </span>
                      </td>
                      <td className="table-td">{c.item_count ?? 0}</td>
                      <td className="table-td text-gray-400 text-xs hidden sm:table-cell">{c.notes || '—'}</td>
                      <td className="table-td text-gray-400 text-xs hidden sm:table-cell">
                        {new Date(c.created_at).toLocaleString('he-IL')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'issuances' && (
        <div>
          <div className="flex justify-end mb-3">
            <Link to={`/bunkers/${bunkerId}/issuance/new`} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} />
              הנפקה חדשה
            </Link>
          </div>
          <div className="card overflow-hidden">
            {issuances.length === 0 ? (
              <div className="p-10 text-center text-gray-400">אין הנפקות רשומות</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">תאריך</th>
                    <th className="table-th">מקבל</th>
                    <th className="table-th hidden sm:table-cell">מ.א.</th>
                    <th className="table-th hidden sm:table-cell">יחידה</th>
                    <th className="table-th">פריטים</th>
                    <th className="table-th">סה"כ</th>
                    <th className="table-th hidden md:table-cell">טופס</th>
                    <th className="table-th"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {issuances.map(iss => (
                    <tr key={iss.id} className="hover:bg-gray-50">
                      <td className="table-td text-sm whitespace-nowrap">{iss.issue_date}</td>
                      <td className="table-td font-medium">{iss.recipient_name || '—'}</td>
                      <td className="table-td text-gray-500 hidden sm:table-cell">{iss.recipient_id || '—'}</td>
                      <td className="table-td text-gray-500 hidden sm:table-cell">{iss.unit_name || '—'}</td>
                      <td className="table-td">{iss.item_count ?? 0}</td>
                      <td className="table-td font-bold">{iss.total_qty ?? 0}</td>
                      <td className="table-td hidden md:table-cell">
                        {iss.form_image_path ? (
                          <a href={iss.form_image_path} target="_blank" rel="noreferrer" className="text-blue-600 text-xs hover:underline">
                            צפה
                          </a>
                        ) : '—'}
                      </td>
                      <td className="table-td">
                        <Link
                          to={`/bunkers/${bunkerId}/issuances/${iss.id}`}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          פרטים
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
