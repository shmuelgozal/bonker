import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getAllUsers,
  getUserWithFrameworks,
  createUser,
  deleteUser,
  updateUserPassword,
  assignUserToFramework,
  removeUserFromFramework,
  getUnits,
  type UserDto,
  type UserWithFrameworksDto,
  type Unit,
} from '../api/client';
import { Plus, Trash2, Shield, Users, Lock, X, Check, Key } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithFrameworksDto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{ username: string; password: string; role: 'admin' | 'user' }>({
    username: '',
    password: '',
    role: 'user',
  });
  const [selectedUnitForAssign, setSelectedUnitForAssign] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showChangeFrameworkForm, setShowChangeFrameworkForm] = useState(false);

  // Flatten units to a single-level array for easier selection
  const flattenUnits = (units: any[], acc: any[] = []): any[] => {
    for (const unit of units) {
      acc.push(unit);
      if (unit.children?.length > 0) {
        flattenUnits(unit.children, acc);
      }
    }
    return acc;
  };

  useEffect(() => {
    Promise.all([getAllUsers(), getUnits()])
      .then(([users, unitTree]) => {
        setUsers(users);
        setUnits(flattenUnits(unitTree));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      toast.error('נדרשים שם משתמש וסיסמה');
      return;
    }

    try {
      const newUser = await createUser({
        username: formData.username,
        password: formData.password,
        role: formData.role,
      });
      setUsers(prev => [...prev, newUser]);
      setFormData({ username: '', password: '', role: 'user' });
      setShowForm(false);
      toast.success(`משתמש ${formData.username} נוצר בהצלחה`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'שגיאה ביצירת משתמש');
    }
  };

  const handleSelectUser = async (user: UserDto) => {
    try {
      const userWithFrameworks = await getUserWithFrameworks(user.id);
      setSelectedUser(userWithFrameworks);
    } catch (err) {
      toast.error('שגיאה בטעינת פרטי המשתמש');
    }
  };

  const handleAssignFramework = async () => {
    if (!selectedUser || !selectedUnitForAssign) {
      toast.error('בחר מסגרת להקצאה');
      return;
    }

    try {
      await assignUserToFramework(selectedUser.user.id, selectedUnitForAssign);
      const updated = await getUserWithFrameworks(selectedUser.user.id);
      setSelectedUser(updated);
      setSelectedUnitForAssign('');
      toast.success('המסגרת הוקצתה בהצלחה');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'שגיאה בהקצאת מסגרת');
    }
  };

  const handleRemoveFramework = async (unitId: string) => {
    if (!selectedUser) return;
    if (!confirm('להסיר את ההרשאה?')) return;

    try {
      await removeUserFromFramework(selectedUser.user.id, unitId);
      const updated = await getUserWithFrameworks(selectedUser.user.id);
      setSelectedUser(updated);
      toast.success('ההרשאה הוסרה בהצלחה');
    } catch (err) {
      toast.error('שגיאה בהסרת ההרשאה');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`למחוק את המשתמש "${username}"?`)) return;

    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (selectedUser?.user.id === userId) {
        setSelectedUser(null);
      }
      toast.success('המשתמש נמחק בהצלחה');
    } catch (err) {
      toast.error('שגיאה במחיקת המשתמש');
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error('הזן סיסמה חדשה');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('הסיסמה חייבת להיות בעלת 6 תווים לפחות');
      return;
    }

    try {
      await updateUserPassword(selectedUser.user.id, newPassword);
      setNewPassword('');
      setShowPasswordForm(false);
      toast.success('הסיסמה עודכנה בהצלחה');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'שגיאה בעדכון הסיסמה');
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Users List */}
      <div className="lg:col-span-1">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-800">משתמשים</h2>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {users.length}
            </span>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary w-full mb-3 text-sm flex items-center justify-center gap-2"
          >
            <Plus size={14} /> משתמש חדש
          </button>

          {/* Create Form */}
          {showForm && (
            <form onSubmit={handleCreateUser} className="bg-blue-50 p-3 rounded-lg mb-3 space-y-2">
              <input
                type="text"
                placeholder="שם משתמש"
                value={formData.username}
                onChange={e => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="input w-full text-sm"
                dir="rtl"
              />
              <input
                type="password"
                placeholder="סיסמה"
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="input w-full text-sm"
                dir="rtl"
              />
              <select
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'user' }))}
                className="input w-full text-sm"
              >
                <option value="user">משתמש</option>
                <option value="admin">מנהל</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn-primary text-sm flex-1"
                >
                  <Check size={14} className="inline mr-1" /> שמור
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary text-sm flex-1"
                >
                  <X size={14} className="inline mr-1" /> ביטול
                </button>
              </div>
            </form>
          )}

          {/* Users List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={`w-full text-right p-3 rounded-lg transition-colors text-sm ${
                  selectedUser?.user.id === user.id
                    ? 'bg-blue-100 border border-blue-300'
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{user.username}</p>
                  </div>
                  {user.role === 'admin' && (
                    <Shield size={14} className="text-amber-600" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Details & Permissions */}
      <div className="lg:col-span-2">
        {selectedUser ? (
          <div className="card p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{selectedUser.user.username}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      selectedUser.user.role === 'admin'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <Shield size={12} />
                    {selectedUser.user.role === 'admin' ? 'מנהל' : 'משתמש'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                  title="שינוי סיסמה"
                >
                  <Key size={18} />
                </button>
                <button
                  onClick={() => handleDeleteUser(selectedUser.user.id, selectedUser.user.username)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Password Change Form */}
            {showPasswordForm && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Lock size={16} />
                  שינוי סיסמה
                </h3>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="סיסמה חדשה"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="input w-full"
                    dir="rtl"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdatePassword}
                      className="btn-primary flex-1 text-sm"
                    >
                      <Check size={14} className="inline mr-1" /> עדכן
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordForm(false);
                        setNewPassword('');
                      }}
                      className="btn-secondary flex-1 text-sm"
                    >
                      <X size={14} className="inline mr-1" /> ביטול
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Framework Permissions */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-3">מסגרות מוקצות</h3>

              {selectedUser.frameworks.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {selectedUser.frameworks.map(framework => (
                    <div
                      key={framework._id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{framework.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{framework.type}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFramework(framework._id)}
                        className="p-1.5 hover:bg-red-100 text-red-600 rounded transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-4">אין מסגרות מוקצות</p>
              )}

              {/* Assign Framework */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">הוסף מסגרת חדשה</label>
                <div className="flex gap-2">
                  <select
                    value={selectedUnitForAssign}
                    onChange={e => setSelectedUnitForAssign(e.target.value)}
                    className="input flex-1 text-sm"
                  >
                    <option value="">בחר מסגרת...</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignFramework}
                    className="btn-primary text-sm px-4"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
              <p>
                משתמש זה יכול לגשת לכל המסגרות המוקצות וגם לילדיהן. משתמשים שאינם מנהלים לא יכולים ליצור מסגרות חדשות או לנהל משתמשים.
              </p>
            </div>
          </div>
        ) : (
          <div className="card p-8 flex items-center justify-center min-h-80">
            <div className="text-center">
              <Lock size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm">בחר משתמש כדי להציג פרטים ולנהל הרשאות</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
