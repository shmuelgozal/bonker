import { useState } from 'react';
import { UnitWithChildren } from '../types';

interface UnitFormProps {
  units: UnitWithChildren[];
  initialUnit?: UnitWithChildren | null;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function UnitForm({ units, initialUnit, onSubmit, onCancel }: UnitFormProps) {
  const [name, setName] = useState(initialUnit?.name || '');
  const [type, setType] = useState<'battalion' | 'company' | 'storage_location'>(
    (initialUnit?.type as any) || 'battalion'
  );
  const [parentUnitId, setParentUnitId] = useState(initialUnit?.parent_unit_id || null);
  const [description, setDescription] = useState(initialUnit?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('שם המסגרת הוא חובה');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit({
        name: name.trim(),
        type,
        parent_unit_id: parentUnitId || null,
        description: description.trim() || null,
      });
    } catch (err) {
      setError('שגיאה בשמירת המסגרת');
    } finally {
      setLoading(false);
    }
  };

  // Get valid parent units based on current type
  const getValidParents = () => {
    if (type === 'battalion') return []; // No parent for battalion
    if (type === 'company') {
      // Company can have battalion as parent
      return units.filter(u => u.type === 'battalion');
    }
    if (type === 'storage_location') {
      // Storage location can have company as parent
      return units.filter(u => u.type === 'company');
    }
    return [];
  };

  const validParents = getValidParents();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">
        {initialUnit ? 'עריכת מסגרת' : 'יצירת מסגרת חדשה'}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          שם המסגרת *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="לדוגמה: גדוד א"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          סוג המסגרת *
        </label>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as any);
            setParentUnitId(null); // Reset parent when type changes
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="battalion">גדוד</option>
          <option value="company">פלוגה</option>
          <option value="storage_location">מיקום אחסון</option>
        </select>
      </div>

      {validParents.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            מסגרת הורה
          </label>
          <select
            value={parentUnitId || ''}
            onChange={(e) => setParentUnitId(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- בחר מסגרת הורה --</option>
            {validParents.map(parent => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          תיאור
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="תיאור אופציוני"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </form>
  );
}
