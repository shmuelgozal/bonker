import { Link, useLocation } from 'react-router-dom';
import { Package, Boxes, Settings, LayoutDashboard, Network, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', label: 'לוח בקרה', icon: LayoutDashboard },
  { path: '/units', label: 'מסגרות', icon: Network },
  { path: '/bunkers', label: 'בונקרים', icon: Boxes },
  { path: '/ammo-types', label: 'סוגי תחמושת', icon: Package },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

export default function TopNav() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
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
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-blue-800 rounded-md transition-colors"
            aria-label="תפריט ניווט"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
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
          </nav>
        )}
      </div>
    </header>
  );
}
