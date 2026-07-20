import { useState } from 'react';
import { UnitWithChildren } from '../types';
import { addStorageLocation } from '../api/client';

interface StorageLocationFormProps {
  unit: UnitWithChildren;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export default function StorageLocationForm({ unit, onSubmit, onCancel }: StorageLocationFormProps) {
  const [locationType, setLocationType] = useState<'bunker' | 'vehicle' | 'pillbox'>(
    (unit.storage_location?.location_type as any) || 'bunker'
  );
  const [locationDetails, setLocationDetails] = useState(
    unit.storage_location?.location_details || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationDetails.trim()) {
      setError('פרטי המיקום הם חובה');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await addStorageLocation(unit.id, {
        location_type: locationType,
        location_details: locationDetails.trim(),
      });
      await onSubmit();
    } catch (err) {
      setError('שגיאה בשמירת פרטי המיקום');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">
        הקצאת מיקום אחסון: {unit.name}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          סוג המיקום *
        </label>
        <select
          value={locationType}
          onChange={(e) => setLocationType(e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="bunker">בונקר</option>
          <option value="vehicle">רכב</option>
          <option value="pillbox">מנמ״כ (pillbox)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          פרטי המיקום *
        </label>
        <textarea
          value={locationDetails}
          onChange={(e) => setLocationDetails(e.target.value)}
          placeholder={`לדוגמה: ${
            locationType === 'bunker' 
              ? 'בונקר תת-קרקעי מזויין'
              : locationType === 'vehicle'
              ? 'GMC ממ״ס 152'
              : 'מנמ״כ מצפון לנקודה A'
          }`}
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
