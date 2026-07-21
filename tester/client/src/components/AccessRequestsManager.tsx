import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getPendingAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getUnits,
  type AccessRequest,
  type Unit,
} from '../api/client';
import { Check, X, Clock, Inbox } from 'lucide-react';

export default function AccessRequestsManager() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Flatten units for dropdown - only battalion and company
  const flattenUnits = (units: any[], acc: any[] = []): any[] => {
    for (const unit of units) {
      // Only include battalion or company types (not storage_location)
      if (unit.type === 'battalion' || unit.type === 'company') {
        acc.push(unit);
      }
      if (unit.children?.length > 0) {
        flattenUnits(unit.children, acc);
      }
    }
    return acc;
  };

  useEffect(() => {
    Promise.all([getPendingAccessRequests(), getUnits()])
      .then(([reqs, unitTree]) => {
        console.log('📦 Raw Units from API:', JSON.stringify(unitTree, null, 2));
        console.log('📦 First unit structure:', unitTree[0]);
        const flat = flattenUnits(unitTree);
        console.log('📦 First flattened unit:', flat[0]);
        setRequests(reqs);
        setUnits(flat);
      })
      .catch(err => toast.error('Failed to load access requests'))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async () => {
    if (!selectedRequest || !selectedUnit) {
      toast.error('בחר מסגרת להקצאה');
      return;
    }

    try {
      await approveAccessRequest(selectedRequest.id, selectedUnit);
      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      setSelectedRequest(null);
      setSelectedUnit('');
      toast.success(`משתמש ${selectedRequest.username} אושר בהצלחה`);
    } catch (err: any) {
      console.error('Approve error:', err);
      const errorMsg = err?.response?.data?.error || err?.message || 'שגיאה באישור הבקשה';
      toast.error(errorMsg);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    try {
      await rejectAccessRequest(selectedRequest.id, rejectionReason);
      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      setSelectedRequest(null);
      setRejectionReason('');
      setShowRejectForm(false);
      toast.success(`בקשת ${selectedRequest.username} נדחתה`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'שגיאה בדחיית הבקשה');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center h-64 items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-amber-600" />
        <h3 className="text-lg font-semibold text-gray-800">בקשות גישה ממתינות</h3>
        <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
          {requests.length}
        </span>
      </div>

      {requests.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Inbox size={40} className="mx-auto mb-2 text-gray-300" />
          <p>אין בקשות גישה ממתינות</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Requests List */}
          <div className="lg:col-span-1">
            <div className="card p-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {requests.map(request => (
                  <button
                    key={request.id}
                    onClick={() => {
                      setSelectedRequest(request);
                      setSelectedUnit('');
                      setShowRejectForm(false);
                    }}
                    className={`w-full text-right p-3 rounded-lg transition-colors text-sm ${
                      selectedRequest?.id === request.id
                        ? 'bg-amber-100 border border-amber-300'
                        : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <div className="font-medium text-gray-800">{request.username}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(request.requested_at).toLocaleString('he-IL')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Request Details & Actions */}
          <div className="lg:col-span-2">
            {selectedRequest ? (
              <div className="card p-5">
                <div className="mb-5">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {selectedRequest.username}
                  </h3>
                  <p className="text-sm text-gray-600">
                    בקשה התקבלה ב-{' '}
                    {new Date(selectedRequest.requested_at).toLocaleString('he-IL')}
                  </p>
                </div>

                {!showRejectForm ? (
                  <>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        בחר מסגרת להקצאה
                      </label>
                      <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="input w-full text-sm"
                      >
                        <option value="">-- בחר מסגרת --</option>
                        {units.map(unit => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        משתמש יוכל לנהל את המסגרת זו וכל המסגרות הכלולות בה
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={!selectedUnit}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Check size={16} /> אשר
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <X size={16} /> דחה
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        סיבת דחיה (אופציונלי)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="הסבר מדוע הבקשה נדחתה"
                        className="input w-full text-sm"
                        rows={3}
                        dir="rtl"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleReject}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        דחה בוודאות
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectionReason('');
                        }}
                        className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                      >
                        ביטול
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center text-gray-400">
                <p>בחר בקשה להצגת פרטים</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
