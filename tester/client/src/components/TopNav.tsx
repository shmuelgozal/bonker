import { Link, useLocation } from 'react-router-dom';
import { Package, Boxes, Settings, LayoutDashboard, Network } from 'lucide-react';

const navItems = [
  { path: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/units', label: 'מסגרות', icon: Network },
  { path: '/bunkers', label: 'בונקרים', icon: Boxes },
  { path: '/ammo-types', label: 'סוגי תחמושת', icon: Package },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

export default function TopNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Boxes size={18} />
            </div>
            <span className="font-bold text-lg tracking-tight">ניהול בונקרים</span>
          </div>

          {/* Navigation tabs */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${isActive(path)
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800'
                  }
                `}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
