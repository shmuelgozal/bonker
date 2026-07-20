import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Unlink } from 'lucide-react';
import { Bunker, UnitWithChildren } from '../types';
import { getBunkers, linkBunkerToUnit } from '../api/client';

interface LinkBunkerFormProps {
  unit: UnitWithChildren;
  linkedBunkers: Bunker[];
  onDone: () => void;
}

export default function LinkBunkerForm({ unit, linkedBunkers, onDone }: LinkBunkerFormProps) {
  const [allBunkers, setAllBunkers] = useState<Bunker[]>([]);
  const [selectedBunkerId, setSelectedBunkerId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getBunkers().then(setAllBunkers).catch(console.error);
  }, []);

  const linkedIds = new Set(linkedBunkers.map(b => b.id));
  const availableBunkers = allBunkers.filter(b => !linkedIds.has(b.id) && b.unit_id === null);

  const handleLink = async () => {
    if (!selectedBunkerId) return;
    setLoading(true);
    setError('');
    try {
      await linkBunkerToUnit(Number(selectedBunkerId), unit.id);
      setSelectedBunkerId('');
      onDone();
    } catch {
      setError('שגיאה בקישור הבונקר');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async (bunkerId: number) => {
    setLoading(true);
    try {
      await linkBunkerToUnit(bunkerId, null);
      onDone();
    } catch {
      setError('שגיאה בניתוק הבונקר');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm text-gray-700">בונקרים מקושרים ל{unit.name}</h3>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      {/* Linked bunkers list */}
      {linkedBunkers.length > 0 ? (
        <div className="space-y-1">
          {linkedBunkers.map(b => (
            <div key={b.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
              <div className="flex-1 min-w-0">
                <Link
                  to={`/bunkers/${b.id}`}
                  className="text-sm font-medium text-blue-700 hover:underline flex items-center gap-1"
                >
                  {b.name}
                  <ExternalLink size={12} />
                </Link>
                {b.location && <p className="text-xs text-gray-500">{b.location}</p>}
              </div>
              <button
                onClick={() => handleUnlink(b.id)}
                disabled={loading}
                className="p-1 hover:bg-red-100 text-red-500 rounded"
                title="נתק בונקר"
              >
                <Unlink size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500">אין בונקרים מקושרים</p>
      )}

      {/* Link new bunker */}
      {availableBunkers.length > 0 && (
        <div className="flex gap-2 items-center">
          <select
            value={selectedBunkerId}
            onChange={e => setSelectedBunkerId(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- בחר בונקר לקישור --</option>
            {availableBunkers.map(b => (
              <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={!selectedBunkerId || loading}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 whitespace-nowrap"
          >
            קשר
          </button>
        </div>
      )}

      {availableBunkers.length === 0 && allBunkers.filter(b => !linkedIds.has(b.id)).length === 0 && (
        <p className="text-xs text-gray-400">כל הבונקרים כבר מקושרים למסגרות</p>
      )}
      {availableBunkers.length === 0 && allBunkers.filter(b => !linkedIds.has(b.id)).length > 0 && (
        <p className="text-xs text-gray-400">לא נמצאו בונקרים פנויים (ללא שיוך למסגרת)</p>
      )}
    </div>
  );
}
