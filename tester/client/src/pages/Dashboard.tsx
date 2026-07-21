import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBunkers, getGaps, getUnits, getUnitInventorySummary, getUnitGaps, getShatzalUsageReport } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Bunker, GapsResponse, UnitWithChildren, ShatzalUsageReportItem } from '../types';
import { AlertTriangle, CheckCircle, Boxes, ClipboardList, Plus, ChevronDown, ChevronRight, Activity } from 'lucide-react';

interface BunkerCard {
  bunker: Bunker;
  gaps: GapsResponse | null;
}

interface UnitInventorySummary {
  unit_id: string;
  unit_name: string;
  bunker_count: number;
  inventory: Array<{
    ammo_type_id: string;
    ammo_name: string;
    unit: string;
    category: string;
    total_qty: number;
  }>;
}

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDayKey = (value: string | Date) => new Date(value).toISOString().slice(0, 10);

export default function Dashboard() {
  const { user } = useAuth();
  const [cards, setCards] = useState<BunkerCard[]>([]);
  const [units, setUnits] = useState<UnitWithChildren[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unitInventory, setUnitInventory] = useState<UnitInventorySummary | null>(null);
  const [unitGaps, setUnitGaps] = useState<GapsResponse | null>(null);
  const [shatzalUsage, setShatzalUsage] = useState<ShatzalUsageReportItem[]>([]);
  const [shatzalAmmoTypeId, setShatzalAmmoTypeId] = useState('all');
  const [shatzalFromDate, setShatzalFromDate] = useState(() => toDateInputValue(addDays(new Date(), -29)));
  const [shatzalToDate, setShatzalToDate] = useState(() => toDateInputValue(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [bunkersList, unitsList] = await Promise.all([
          getBunkers(),
          getUnits(),
        ]);
        
        const withGaps = await Promise.all(
          bunkersList.map(async (b) => {
            try {
              const gaps = await getGaps(b.id);
              return { bunker: b, gaps };
            } catch {
              return { bunker: b, gaps: null };
            }
          })
        );
        setCards(withGaps);
        setUnits(unitsList);
        getShatzalUsageReport().then(setShatzalUsage).catch(() => setShatzalUsage([]));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Load unit inventory when unit is selected
  useEffect(() => {
    if (!selectedUnitId) {
      setUnitInventory(null);
      setUnitGaps(null);
      return;
    }

    (async () => {
      try {
        const [inv, gaps] = await Promise.all([
          getUnitInventorySummary(selectedUnitId),
          getUnitGaps(selectedUnitId),
        ]);
        setUnitInventory(inv);
        setUnitGaps(gaps);
      } catch (error) {
        console.error('Error loading unit data:', error);
        setUnitInventory(null);
        setUnitGaps(null);
      }
    })();
  }, [selectedUnitId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalDeficit = cards.reduce((acc, c) => acc + (c.gaps?.summary.deficit ?? 0), 0);

  // Find selected unit for display
  const findUnit = (units: UnitWithChildren[], id: string): UnitWithChildren | undefined => {
    for (const unit of units) {
      if (unit.id === id) return unit;
      const found = findUnit(unit.children, id);
      if (found) return found;
    }
    return undefined;
  };

  // Get all unit IDs in a unit's subtree (recursively)
  const getAllUnitIds = (unit: UnitWithChildren): string[] => {
    const ids = [unit.id];
    for (const child of unit.children) {
      ids.push(...getAllUnitIds(child));
    }
    return ids;
  };

  // Filter bunker cards based on selected unit
  const selectedUnit = selectedUnitId ? findUnit(units, selectedUnitId) : null;
  const unitIds = selectedUnit ? getAllUnitIds(selectedUnit) : [];
  const filteredCards = selectedUnitId 
    ? cards.filter(c => c.bunker.unit_id && unitIds.includes(c.bunker.unit_id))
    : cards;

  // Reuse selected framework scope for shatzal analytics by bunker membership.
  const filteredBunkerIds = new Set(filteredCards.map((c) => c.bunker.id));
  const shatzalUsageInScope = selectedUnitId
    ? shatzalUsage.filter((item) => filteredBunkerIds.has(item.bunker_id))
    : shatzalUsage;

  // Flatten units hierarchy for display in dropdown (only battalion and company levels)
  const flattenedUnits = (unitsList: UnitWithChildren[], level = 0): Array<{ id: string; name: string; type: string; level: number }> => {
    const result: Array<{ id: string; name: string; type: string; level: number }> = [];
    for (const unit of unitsList) {
      // Only include battalion and company types, skip storage_location
      if (unit.type !== 'storage_location') {
        result.push({ id: unit.id, name: unit.name, type: unit.type, level });
      }
      if (unit.children && unit.children.length > 0) {
        result.push(...flattenedUnits(unit.children, level + (unit.type !== 'storage_location' ? 1 : 0)));
      }
    }
    return result;
  };

  const allUnits = flattenedUnits(units);
  const shatzalAmmoOptions = Array.from(
    shatzalUsageInScope.reduce((map, item) => {
      if (!map.has(item.ammo_type_id)) {
        map.set(item.ammo_type_id, {
          id: item.ammo_type_id,
          name: item.ammo_name || 'תחמושת',
          unit: item.ammo_unit || '',
        });
      }
      return map;
    }, new Map<string, { id: string; name: string; unit: string }>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const fromDate = new Date(`${shatzalFromDate}T00:00:00`);
  const toDate = new Date(`${shatzalToDate}T23:59:59`);
  const normalizedFromDate = Number.isNaN(fromDate.getTime()) ? null : fromDate;
  const normalizedToDate = Number.isNaN(toDate.getTime()) ? null : toDate;
  const rangeStart = normalizedFromDate && normalizedToDate && normalizedFromDate > normalizedToDate ? normalizedToDate : normalizedFromDate;
  const rangeEnd = normalizedFromDate && normalizedToDate && normalizedFromDate > normalizedToDate ? normalizedFromDate : normalizedToDate;

  const filteredShatzalUsage = shatzalUsageInScope.filter((item) => {
    const usedAt = new Date(item.used_at);
    const matchesAmmo = shatzalAmmoTypeId === 'all' || item.ammo_type_id === shatzalAmmoTypeId;
    const matchesFrom = !rangeStart || usedAt >= rangeStart;
    const matchesTo = !rangeEnd || usedAt <= rangeEnd;
    return matchesAmmo && matchesFrom && matchesTo;
  });

  const chartAmmoTypes = (shatzalAmmoTypeId === 'all'
    ? shatzalAmmoOptions.filter((ammo) => filteredShatzalUsage.some((item) => item.ammo_type_id === ammo.id))
    : shatzalAmmoOptions.filter((ammo) => ammo.id === shatzalAmmoTypeId)
  ).map((ammo) => ({
    id: ammo.id,
    name: ammo.name,
    unit: ammo.unit,
  }));

  const buildDateSeries = () => {
    if (!rangeStart || !rangeEnd) return [] as Array<{ dateKey: string; label: string; total_qty: number; event_count: number; by_type: Record<string, number> }>;
    const points: Array<{ dateKey: string; label: string; total_qty: number; event_count: number; by_type: Record<string, number> }> = [];
    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);

    while (cursor <= end) {
      const dateKey = toDayKey(cursor);
      const dayItems = filteredShatzalUsage.filter(item => toDayKey(item.used_at) === dateKey);
      const byType = chartAmmoTypes.reduce((acc, ammo) => {
        acc[ammo.id] = dayItems
          .filter((item) => item.ammo_type_id === ammo.id)
          .reduce((sum, item) => sum + item.quantity_used, 0);
        return acc;
      }, {} as Record<string, number>);
      points.push({
        dateKey,
        label: cursor.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
        total_qty: Object.values(byType).reduce((sum, qty) => sum + qty, 0),
        event_count: dayItems.length,
        by_type: byType,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return points;
  };

  const shatzalTimeline = buildDateSeries();
  const maxTimelineQty = Math.max(...shatzalTimeline.map(point => point.total_qty), 1);
  const totalUsageQty = filteredShatzalUsage.reduce((sum, item) => sum + item.quantity_used, 0);
  const totalUsageEvents = filteredShatzalUsage.length;
  const peakDay = shatzalTimeline.reduce<{ label: string; total_qty: number } | null>((best, point) => {
    if (!best || point.total_qty > best.total_qty) return { label: point.label, total_qty: point.total_qty };
    return best;
  }, null);
  const chartWidth = 860;
  const chartHeight = 260;
  const chartPaddingX = 36;
  const chartPaddingTop = 20;
  const chartPaddingBottom = 48;
  const plotWidth = chartWidth - chartPaddingX * 2;
  const plotHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
  const segmentWidth = shatzalTimeline.length > 1 ? plotWidth / (shatzalTimeline.length - 1) : plotWidth;
  const groupWidth = Math.max(18, Math.min(56, segmentWidth * 0.75));
  const barsPerGroup = Math.max(chartAmmoTypes.length, 1);
  const barGap = barsPerGroup > 1 ? 3 : 0;
  const totalGap = barGap * (barsPerGroup - 1);
  const barWidth = Math.max(5, Math.min(16, (groupWidth - totalGap) / barsPerGroup));
  const ammoColors = ['#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6366f1', '#14b8a6'];
  const chartPoints = shatzalTimeline.map((point, index) => {
    const x = shatzalTimeline.length > 1
      ? chartPaddingX + (index * plotWidth) / (shatzalTimeline.length - 1)
      : chartPaddingX + plotWidth / 2;
    const y = chartPaddingTop + plotHeight - ((point.total_qty / maxTimelineQty) * plotHeight);
    return { ...point, x, y };
  });
  const trendPoints = chartPoints.map((point) => ({ ...point, trend_qty: point.total_qty, trendY: point.y }));
  const trendPath = trendPoints.length
    ? trendPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.trendY}`).join(' ')
    : '';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
          <p className="text-sm text-gray-500 mt-0.5">סיכום מצב בונקרים ומלאי</p>
        </div>
        <Link to="/bunkers" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          הוספת בונקר
        </Link>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Boxes size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{cards.length}</p>
              <p className="text-sm text-gray-500">בונקרים פעילים</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalDeficit}</p>
              <p className="text-sm text-gray-500">פערים פתוחים</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {cards.filter(c => (c.gaps?.summary.deficit ?? 0) === 0).length}
              </p>
              <p className="text-sm text-gray-500">בונקרים תקינים</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unit Status Section */}
      {allUnits.length > 0 && (
        <div className="mb-6">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">מצב כולל של מסגרת</h2>
            
            {/* Unit selector dropdown - for all users */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">בחר מסגרת:</label>
              <select
                value={selectedUnitId || ''}
                onChange={(e) => setSelectedUnitId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- בחר מסגרת --</option>
                {allUnits.map((unit) => (
                  <option key={unit.id} value={unit.id} style={{ paddingLeft: `${unit.level * 20}px` }}>
                    {'  '.repeat(unit.level)}{unit.name} ({unit.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Summary */}
            {selectedUnit && unitInventory && unitGaps && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <p className="text-xs text-gray-600">בונקרים מקושרים</p>
                    <p className="text-2xl font-bold text-blue-600">{unitInventory.bunker_count}</p>
                  </div>
                  <div className={`${unitGaps.summary.deficit === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} p-3 rounded border`}>
                    <p className="text-xs text-gray-600">פערים</p>
                    <p className={`text-2xl font-bold ${unitGaps.summary.deficit === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {unitGaps.summary.deficit}/{unitGaps.summary.total}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded border border-purple-200">
                    <p className="text-xs text-gray-600">סוגי תחמושת במלאי</p>
                    <p className="text-2xl font-bold text-purple-600">{unitInventory.inventory.length}</p>
                  </div>
                </div>

                {/* Inventory Table */}
                {unitInventory.inventory.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-2">מלאי בפירוט</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-right p-2 text-gray-700">שם התחמושת</th>
                            <th className="text-right p-2 text-gray-700">קטגוריה</th>
                            <th className="text-right p-2 text-gray-700">כמות</th>
                            <th className="text-right p-2 text-gray-700">יחידה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unitInventory.inventory.map((item) => (
                            <tr key={item.ammo_type_id} className="border-b border-gray-100">
                              <td className="p-2 text-gray-900">{item.ammo_name}</td>
                              <td className="p-2 text-gray-600">{item.category}</td>
                              <td className="p-2 text-gray-900 font-medium">{item.total_qty}</td>
                              <td className="p-2 text-gray-600">{item.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Gaps Table */}
                {unitGaps.gaps.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-2">פערים בתו תקן</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-right p-2 text-gray-700">שם התחמושת</th>
                            <th className="text-right p-2 text-gray-700">דרישה</th>
                            <th className="text-right p-2 text-gray-700">במלאי</th>
                            <th className="text-right p-2 text-gray-700">פער</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unitGaps.gaps.map((gap) => (
                            <tr
                              key={gap.ammo_type_id}
                              className={`border-b border-gray-100 ${gap.gap < 0 ? 'bg-red-50' : 'bg-green-50'}`}
                            >
                              <td className="p-2 text-gray-900">{gap.ammo_name}</td>
                              <td className="p-2 text-gray-600">{gap.required_qty}</td>
                              <td className="p-2 text-gray-900 font-medium">{gap.current_qty}</td>
                              <td className={`p-2 font-bold ${gap.gap < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {gap.gap < 0 ? gap.gap : `+${gap.gap}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {unitGaps.gaps.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <p>אין דרישות (תו תקן) מוגדרות עבור מסגרת זו</p>
                  </div>
                )}
              </div>
            )}

            {!selectedUnitId && (
              <p className="text-center text-gray-500 py-4">בחר מסגרת כדי לראות מצב כולל של המלאי וגפים</p>
            )}
          </div>
        </div>
      )}

      {/* Bunker cards */}
      {filteredCards.length === 0 ? (
        <div className="card p-12 text-center">
          <Boxes size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">{selectedUnitId ? 'אין בונקרים במסגרת זו' : 'אין בונקרים במערכת'}</p>
          <p className="text-gray-400 text-sm mt-1">{selectedUnitId ? 'בחר מסגרת אחרת או הוסף בונקר' : 'הוסף בונקר ראשון כדי להתחיל'}</p>
          {!selectedUnitId && (
            <Link to="/bunkers" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Plus size={16} />
              הוסף בונקר
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map(({ bunker, gaps }) => {
            const hasDeficit = (gaps?.summary.deficit ?? 0) > 0;
            const hasStandard = (gaps?.summary.total ?? 0) > 0;
            return (
              <Link key={bunker.id} to={`/bunkers/${bunker.id}`} className="card p-5 hover:shadow-md transition-shadow block">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{bunker.name}</h3>
                    {bunker.location && (
                      <p className="text-sm text-gray-500">{bunker.location}</p>
                    )}
                  </div>
                  {hasStandard ? (
                    hasDeficit ? (
                      <span className="badge-danger flex items-center gap-1">
                        <AlertTriangle size={12} />
                        {gaps!.summary.deficit} פערים
                      </span>
                    ) : (
                      <span className="badge-ok flex items-center gap-1">
                        <CheckCircle size={12} />
                        תקין
                      </span>
                    )
                  ) : (
                    <span className="badge-warning">ללא תו תקן</span>
                  )}
                </div>

                {/* Gap bar */}
                {hasStandard && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>עמידה בתו תקן</span>
                      <span>{gaps!.summary.ok}/{gaps!.summary.total}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${hasDeficit ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${(gaps!.summary.ok / gaps!.summary.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3 border-t pt-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{bunker.stocked_types ?? 0}</p>
                    <p className="text-xs text-gray-500">{(bunker.bunker_type || 'bunker') === 'soldiers' ? 'סוגי פריטים אצל חיילים' : 'פריטים במלאי'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{bunker.issuance_count ?? 0}</p>
                    <p className="text-xs text-gray-500">{(bunker.bunker_type || 'bunker') === 'soldiers' ? 'הנפקות נכנסות' : 'הנפקות'}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1"
                    onClick={e => { e.preventDefault(); window.location.href = `/bunkers/${bunker.id}/inventory/add`; }}
                  >
                    + הזנת מלאי
                  </button>
                  {(bunker.bunker_type || 'bunker') === 'bunker' && (
                    <button
                      className="flex-1 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center justify-center gap-1"
                      onClick={e => { e.preventDefault(); window.location.href = `/bunkers/${bunker.id}/issuance/new`; }}
                    >
                      <ClipboardList size={12} />
                      הנפקה
                    </button>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Shatzal tracking */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">גרף ציר זמן לשצ"ל</h2>
            <p className="text-sm text-gray-500">שימוש לפי תאריך, סוג תחמושת ונציג</p>
          </div>
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Activity size={20} className="text-amber-700" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <div className="card p-2.5 sm:p-3 bg-slate-50">
            <p className="text-[11px] sm:text-xs text-gray-500 mb-1">שימוש כולל</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalUsageQty}</p>
          </div>
          <div className="card p-2.5 sm:p-3 bg-slate-50">
            <p className="text-[11px] sm:text-xs text-gray-500 mb-1">אירועים</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalUsageEvents}</p>
          </div>
          <div className="card p-2.5 sm:p-3 bg-slate-50">
            <p className="text-[11px] sm:text-xs text-gray-500 mb-1">שיא יומי</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{peakDay?.total_qty ?? 0}</p>
          </div>
          <div className="card p-2.5 sm:p-3 bg-slate-50">
            <p className="text-[11px] sm:text-xs text-gray-500 mb-1">יום שיא</p>
            <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-1">{peakDay?.label || 'אין נתון'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4 items-end">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">סוג תחמושת</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={shatzalAmmoTypeId}
              onChange={(e) => setShatzalAmmoTypeId(e.target.value)}
            >
              <option value="all">כל הסוגים</option>
              {shatzalAmmoOptions.map((ammo) => (
                <option key={ammo.id} value={ammo.id}>{ammo.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">מתאריך</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={shatzalFromDate}
              onChange={(e) => setShatzalFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">עד תאריך</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={shatzalToDate}
              onChange={(e) => setShatzalToDate(e.target.value)}
            />
          </div>
          <div className="text-sm text-gray-500 lg:text-left">
            <p className="font-medium text-gray-700">{shatzalAmmoTypeId === 'all' ? 'כל התחמושת' : (shatzalAmmoOptions.find(a => a.id === shatzalAmmoTypeId)?.name || 'תחמושת')}</p>
            <p>{rangeStart && rangeEnd ? `${rangeStart.toLocaleDateString('he-IL')} - ${rangeEnd.toLocaleDateString('he-IL')}` : 'טווח לא תקין'}</p>
          </div>
        </div>

        {filteredShatzalUsage.length === 0 ? (
          <div className="text-center py-6 text-gray-500 rounded-xl border border-dashed border-gray-300 bg-white">
            אין נתונים בטווח ובסוג שנבחרו
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
              <div className="mb-3 flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-6 rounded-full bg-sky-500" />
                  קו סכום יומי
                </span>
                {chartAmmoTypes.map((ammo, index) => {
                  const color = ammoColors[index % ammoColors.length];
                  return (
                    <span key={`legend-html-${ammo.id}`} className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: color }} />
                      {ammo.name}
                    </span>
                  );
                })}
              </div>

              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full min-w-[860px] h-auto">
                {Array.from({ length: 5 }, (_, index) => {
                  const y = chartPaddingTop + (plotHeight / 4) * index;
                  const value = Math.round(maxTimelineQty - (maxTimelineQty / 4) * index);
                  return (
                    <g key={index}>
                      <line x1={chartPaddingX} y1={y} x2={chartPaddingX + plotWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                      <text x="10" y={y + 4} className="fill-gray-500" fontSize="11">{value}</text>
                    </g>
                  );
                })}

                {chartPoints.map((point) => (
                  <g key={`group-${point.dateKey}`}>
                    {chartAmmoTypes.map((ammo, ammoIndex) => {
                      const value = point.by_type[ammo.id] ?? 0;
                      const color = ammoColors[ammoIndex % ammoColors.length];
                      const groupLeft = point.x - groupWidth / 2;
                      const barX = groupLeft + ammoIndex * (barWidth + barGap);
                      const barHeight = value === 0 ? 2 : Math.max(8, (value / maxTimelineQty) * plotHeight);
                      return (
                        <g key={`bar-${point.dateKey}-${ammo.id}`}>
                          <rect
                            x={barX}
                            y={chartPaddingTop + plotHeight - barHeight}
                            width={barWidth}
                            height={barHeight}
                            rx="3"
                            fill={color}
                            opacity={value === 0 ? 0.18 : 0.78}
                          >
                            <title>{`${point.label}: ${ammo.name} ${value}`}</title>
                          </rect>
                          <text
                            x={barX + barWidth / 2}
                            y={chartPaddingTop + plotHeight - barHeight - 8}
                            textAnchor="middle"
                            fontSize="11"
                            className="fill-gray-700"
                          >
                            {value > 0 ? value : ''}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                ))}

                <path d={trendPath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                {trendPoints.map((point) => (
                  <g key={`trend-${point.dateKey}`}>
                    <circle cx={point.x} cy={point.trendY} r="3.5" fill="#0ea5e9" stroke="white" strokeWidth="1.5">
                      <title>{`${point.label}: מגמה ${point.trend_qty.toFixed(1)}`}</title>
                    </circle>
                  </g>
                ))}

                {chartPoints.map((point, index) => {
                  const interval = Math.max(1, Math.ceil(chartPoints.length / 8));
                  if (index % interval !== 0 && index !== chartPoints.length - 1) return null;
                  return (
                    <g key={`label-${point.dateKey}`}>
                      <text
                        x={point.x}
                        y={chartPaddingTop + plotHeight + 26}
                        textAnchor="end"
                        transform={`rotate(-35 ${point.x} ${chartPaddingTop + plotHeight + 26})`}
                        fontSize="11"
                        className="fill-gray-500"
                      >
                        {point.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
