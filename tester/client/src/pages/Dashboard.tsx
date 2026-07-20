import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBunkers, getGaps, getUnits, getUnitInventorySummary, getUnitGaps } from '../api/client';
import type { Bunker, GapsResponse, UnitWithChildren } from '../types';
import { AlertTriangle, CheckCircle, Boxes, ClipboardList, Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface BunkerCard {
  bunker: Bunker;
  gaps: GapsResponse | null;
}

interface UnitInventorySummary {
  unit_id: number;
  unit_name: string;
  bunker_count: number;
  inventory: Array<{
    ammo_type_id: number;
    ammo_name: string;
    unit: string;
    category: string;
    total_qty: number;
  }>;
}

export default function Dashboard() {
  const [cards, setCards] = useState<BunkerCard[]>([]);
  const [units, setUnits] = useState<UnitWithChildren[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [unitInventory, setUnitInventory] = useState<UnitInventorySummary | null>(null);
  const [unitGaps, setUnitGaps] = useState<GapsResponse | null>(null);
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
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
  const findUnit = (units: UnitWithChildren[], id: number): UnitWithChildren | undefined => {
    for (const unit of units) {
      if (unit.id === id) return unit;
      const found = findUnit(unit.children, id);
      if (found) return found;
    }
    return undefined;
  };

  // Get all unit IDs in a unit's subtree (recursively)
  const getAllUnitIds = (unit: UnitWithChildren): number[] => {
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

  // Flatten units hierarchy for display in dropdown (only battalion and company levels)
  const flattenedUnits = (unitsList: UnitWithChildren[], level = 0): Array<{ id: number; name: string; type: string; level: number }> => {
    const result: Array<{ id: number; name: string; type: string; level: number }> = [];
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
            
            {/* Unit selector dropdown */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">בחר מסגרת:</label>
              <select
                value={selectedUnitId || ''}
                onChange={(e) => setSelectedUnitId(e.target.value ? Number(e.target.value) : null)}
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
                    <p className="text-xs text-gray-500">פריטים במלאי</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{bunker.issuance_count ?? 0}</p>
                    <p className="text-xs text-gray-500">הנפקות</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    className="flex-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1"
                    onClick={e => { e.preventDefault(); window.location.href = `/bunkers/${bunker.id}/inventory/add`; }}
                  >
                    + הזנת מלאי
                  </button>
                  <button
                    className="flex-1 text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center justify-center gap-1"
                    onClick={e => { e.preventDefault(); window.location.href = `/bunkers/${bunker.id}/issuance/new`; }}
                  >
                    <ClipboardList size={12} />
                    הנפקה
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
