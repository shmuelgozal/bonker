import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestAccess } from '../api/client';
import toast from 'react-hot-toast';
import { ArrowRight } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'request'>('login');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await requestAccess(username, password);
      toast.success('בקשת גישה נשלחה בהצלחה! האדמין יבדוק את הבקשה שלך.');
      setUsername('');
      setPassword('');
      setMode('login');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit access request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🛡️ Bunker</h1>
          <p className="text-gray-600">Ammunition Management System</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            התחברות
          </button>
          <button
            onClick={() => { setMode('request'); setError(''); }}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mode === 'request'
                ? 'bg-white text-indigo-600 shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            בקשת גישה
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRequestAccess} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם משתמש
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'login' ? 'הכנס שם משתמש' : 'בחר שם משתמש'}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
              required
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'הכנס סיסמה' : 'בחר סיסמה חזקה'}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
              required
              dir="rtl"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 text-right" dir="rtl">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (mode === 'login' ? 'מתחבר...' : 'שולח בקשה...') : (
              <>
                {mode === 'login' ? 'התחברות' : 'שלח בקשה'}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-right" dir="rtl">
          {mode === 'login' ? (
            <p className="text-xs text-gray-600">
              <strong>ממשתמש חדש?</strong> בחר בטאב "בקשת גישה" להגשת בקשה
            </p>
          ) : (
            <p className="text-xs text-gray-600">
              <strong>הערה:</strong> הבקשה שלך תישמר בהמתנה לאישור האדמין
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
