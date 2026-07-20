import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronRight, Trash2, Edit2, MapPin, Warehouse, PackageSearch } from 'lucide-react';
import { getUnits, createUnit, updateUnit, deleteUnit, getUnitBunkers, ensureUnitBunker } from '../api/client';
import { Bunker, UnitWithChildren } from '../types';
import UnitForm from '../components/UnitForm';
import StorageLocationForm from '../components/StorageLocationForm';
import AddStorageForm from '../components/AddStorageForm';
import LinkBunkerForm from '../components/LinkBunkerForm';

export default function UnitsList() {
  const navigate = useNavigate();
  const [units, setUnits] = useState<UnitWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitWithChildren | null>(null);
  const [showStorageForm, setShowStorageForm] = useState(false);
  const [selectedUnitForStorage, setSelectedUnitForStorage] = useState<UnitWithChildren | null>(null);
  const [addStorageToParent, setAddStorageToParent] = useState<UnitWithChildren | null>(null);
  const [linkBunkerUnit, setLinkBunkerUnit] = useState<UnitWithChildren | null>(null);
  const [unitBunkers, setUnitBunkers] = useState<Record<number, Bunker[]>>({});

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await getUnits();
      setUnits(data);
    } catch (error) {
      console.error('Failed to load units:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleDeleteUnit = async (id: number) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    try {
      await deleteUnit(id);
      await loadUnits();
    } catch (error) {
      console.error('Failed to delete unit:', error);
      alert('Failed to delete unit');
    }
  };

  const handleSaveUnit = async (data: any) => {
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, data);
      } else {
        await createUnit(data);
      }
      setShowForm(false);
      setEditingUnit(null);
      await loadUnits();
    } catch (error) {
      console.error('Failed to save unit:', error);
      alert('Failed to save unit');
    }
  };

  const loadUnitBunkers = async (unitId: number) => {
    try {
      const bunkers = await getUnitBunkers(unitId);
      setUnitBunkers(prev => ({ ...prev, [unitId]: bunkers }));
    } catch {
      setUnitBunkers(prev => ({ ...prev, [unitId]: [] }));
    }
  };

  const handleToggleBunkerPanel = (unit: UnitWithChildren) => {
    if (linkBunkerUnit?.id === unit.id) {
      setLinkBunkerUnit(null);
    } else {
      setLinkBunkerUnit(unit);
      loadUnitBunkers(unit.id);
    }
  };

  const handleManageInventory = async (unit: UnitWithChildren) => {
    try {
      const bunker = await ensureUnitBunker(unit.id);
      navigate(`/bunkers/${bunker.id}`);
    } catch (error) {
      console.error('Failed to open inventory:', error);
      alert('שגיאה בפתיחת מלאי');
    }
  };

  const renderUnit = (unit: UnitWithChildren, level = 0) => {
    const hasChildren = unit.children && unit.children.length > 0;
    const isExpanded = expandedNodes.has(unit.id);
    const indent = level * 24;

    return (
      <div key={unit.id}>
        <div 
          className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded"
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleExpand(unit.id)}
              className="p-0 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown size={18} className="text-gray-600" />
              ) : (
                <ChevronRight size={18} className="text-gray-600" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-[18px]" />}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {unit.name}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {unit.type === 'battalion' && 'גדוד'}
                {unit.type === 'company' && 'פלוגה'}
                {unit.type === 'storage_location' && 'מיקום אחסון'}
              </span>
              {unit.storage_location && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded flex items-center gap-1">
                  <MapPin size={12} />
                  {unit.storage_location.location_type === 'bunker' && 'בונקר'}
                  {unit.storage_location.location_type === 'vehicle' && 'רכב'}
                  {unit.storage_location.location_type === 'pillbox' && 'מנמ״כ'}
                </span>
              )}
            </div>
            {unit.description && (
              <p className="text-xs text-gray-600 mt-1">{unit.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Link bunker button - for battalion and company */}
            {(unit.type === 'battalion' || unit.type === 'company') && (
              <button
                onClick={() => handleToggleBunkerPanel(unit)}
                className={`p-1 rounded ${linkBunkerUnit?.id === unit.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-indigo-100 text-indigo-500'}`}
                title="קשר בונקרים"
              >
                <Warehouse size={16} />
              </button>
            )}
            {unit.type === 'company' && (
              <button
                onClick={() => setAddStorageToParent(unit)}
                className="p-1 hover:bg-green-100 text-green-600 rounded"
                title="Add storage location"
              >
                <Plus size={16} />
              </button>
            )}
            {unit.type === 'storage_location' && (
              <button
                onClick={() => {
                  setSelectedUnitForStorage(unit);
                  setShowStorageForm(true);
                }}
                className="p-1 hover:bg-blue-100 text-blue-600 rounded"
                title="Assign storage location"
              >
                <MapPin size={16} />
              </button>
            )}
            {unit.type === 'storage_location' && (
              <button
                onClick={() => handleManageInventory(unit)}
                className="p-1 hover:bg-purple-100 text-purple-600 rounded"
                title="נהל מלאי תחמושת"
              >
                <PackageSearch size={16} />
              </button>
            )}
            <button
              onClick={() => {
                setEditingUnit(unit);
                setShowForm(true);
              }}
              className="p-1 hover:bg-yellow-100 text-yellow-600 rounded"
              title="Edit unit"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={() => handleDeleteUnit(unit.id)}
              className="p-1 hover:bg-red-100 text-red-600 rounded"
              title="Delete unit"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Bunker linking panel */}
        {linkBunkerUnit?.id === unit.id && (
          <div
            className="mx-2 mb-2 p-3 bg-indigo-50 border border-indigo-200 rounded"
            style={{ marginRight: `${indent + 8}px` }}
          >
            <LinkBunkerForm
              unit={unit}
              linkedBunkers={unitBunkers[unit.id] || []}
              onDone={() => loadUnitBunkers(unit.id)}
            />
          </div>
        )}

        {hasChildren && isExpanded && (
          <div>
            {unit.children.map(child => renderUnit(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">טוען יחידות...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">מסגרות ארגוניות</h1>
        <button
          onClick={() => {
            setEditingUnit(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          מסגרת חדשה
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200">
          <UnitForm
            units={units}
            initialUnit={editingUnit}
            onSubmit={handleSaveUnit}
            onCancel={() => {
              setShowForm(false);
              setEditingUnit(null);
            }}
          />
        </div>
      )}

      {showStorageForm && selectedUnitForStorage && (
        <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200">
          <StorageLocationForm
            unit={selectedUnitForStorage}
            onSubmit={async () => {
              setShowStorageForm(false);
              setSelectedUnitForStorage(null);
              await loadUnits();
            }}
            onCancel={() => {
              setShowStorageForm(false);
              setSelectedUnitForStorage(null);
            }}
          />
        </div>
      )}

      {addStorageToParent && (
        <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200">
          <AddStorageForm
            parentCompany={addStorageToParent}
            onSubmit={async () => {
              setAddStorageToParent(null);
              await loadUnits();
            }}
            onCancel={() => setAddStorageToParent(null)}
          />
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        {units.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            אין מסגרות ארגוניות. אתה יכול ליצור מסגרת חדשה.
          </div>
        ) : (
          <div>
            {units.map(unit => renderUnit(unit))}
          </div>
        )}
      </div>
    </div>
  );
}
