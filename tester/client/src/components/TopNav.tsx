import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Boxes, Settings, LayoutDashboard, Network, Menu, X, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { path: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/bunkers', label: 'בונקרים', icon: Boxes },
];

const adminOnlyItems = [
  { path: '/units', label: 'מסגרות', icon: Network },
  { path: '/ammo-types', label: 'סוגי תחמושת', icon: Package },
];

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Boxes size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline whitespace-nowrap">ניהול בונקרים</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(path)
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Icon size={16} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
            {user?.role === 'admin' && adminOnlyItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(path)
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Icon size={16} />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link
                to="/settings"
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive('/settings')
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Settings size={16} />
                <span className="hidden lg:inline">הגדרות</span>
              </Link>
            )}
          </nav>

          {/* User Menu & Mobile Menu Button */}
          <div className="flex items-center gap-2">
            {/* User Info */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-200 hover:text-white hover:bg-blue-800 transition-colors"
                >
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:inline text-xs">{user.username}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg z-50">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="font-semibold">{user.username}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <p className="text-xs text-indigo-600 font-semibold mt-1 uppercase">
                        {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} />
                      <span>התנתקות</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-blue-800 rounded-md transition-colors"
              aria-label="תפריט ניווט"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-1 border-t border-blue-800">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(path)
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            {user?.role === 'admin' && adminOnlyItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(path)
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive('/settings')
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Settings size={18} />
                הגדרות
              </Link>
            )}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-900/30 rounded-md transition-colors"
            >
              <LogOut size={18} />
              <span>התנתקות</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
