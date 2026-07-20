import { useState } from 'react';
import { UnitWithChildren } from '../types';
import { createUnit, addStorageLocation } from '../api/client';

interface AddStorageFormProps {
  parentCompany: UnitWithChildren;
  onSubmit: () => Promise<void>;
  onCancel: () => void;
}

export default function AddStorageForm({ parentCompany, onSubmit, onCancel }: AddStorageFormProps) {
  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState<'bunker' | 'vehicle' | 'pillbox'>('bunker');
  const [locationDetails, setLocationDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('שם מיקום האחסון הוא חובה');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create the storage_location unit
      const storageUnit = await createUnit({
        name: name.trim(),
        type: 'storage_location',
        parent_unit_id: parentCompany.id,
        description: undefined,
      });

      // Add storage location details
      if (locationDetails.trim()) {
        await addStorageLocation(storageUnit.id, {
          location_type: locationType,
          location_details: locationDetails.trim(),
        });
      } else {
        await addStorageLocation(storageUnit.id, {
          location_type: locationType,
          location_details: name.trim(), // Use name as default details
        });
      }

      await onSubmit();
    } catch (err) {
      setError('שגיאה ביצירת מיקום אחסון');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
    switch (locationType) {
      case 'bunker':
        return 'בונקר תת-קרקעי מזויין';
      case 'vehicle':
        return 'GMC ממ״ס 152';
      case 'pillbox':
        return 'מנמ״כ מצפון לנקודה A';
      default:
        return '';
    }
  };

  const getTypeLabel = () => {
    switch (locationType) {
      case 'bunker':
        return 'בונקר';
      case 'vehicle':
        return 'רכב';
      case 'pillbox':
        return 'מנמ״כ';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">
        הוסף מיקום אחסון ל{parentCompany.name}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם המיקום *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

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
            <option value="pillbox">מנמ״כ</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          פרטים נוספים (אופציוני)
        </label>
        <input
          type="text"
          value={locationDetails}
          onChange={(e) => setLocationDetails(e.target.value)}
          placeholder={`לדוגמה: מיקום מסוים של ${getTypeLabel()}`}
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
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'יוצר...' : 'הוסף'}
        </button>
      </div>
    </form>
  );
}
