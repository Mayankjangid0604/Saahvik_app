import { NavLink } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  CurrencyRupeeIcon,
  DocumentChartBarIcon,
  BellIcon,
  Cog6ToothIcon,
  ClipboardDocumentListIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: ['owner', 'staff'] },
  { to: '/residents', label: 'Residents', icon: UserGroupIcon, roles: ['owner', 'staff'] },
  { to: '/property', label: 'Rooms / Beds', icon: BuildingOfficeIcon, roles: ['owner', 'staff'] },
  { to: '/billing', label: 'Billing', icon: CurrencyRupeeIcon, roles: ['owner', 'staff'] },
  { to: '/reports', label: 'Reports', icon: DocumentChartBarIcon, roles: ['owner', 'staff'] },
  { to: '/notifications', label: 'Notifications', icon: BellIcon, roles: ['owner', 'staff'], plan: 'beginner' as const },
  { to: '/audit-log', label: 'Audit Log', icon: ClipboardDocumentListIcon, roles: ['owner'] },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon, roles: ['owner', 'staff'] },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();

  const filteredItems = navItems.filter((item) => {
    if (!user) return false;
    if (!item.roles.includes(user.role)) return false;
    return true;
  });

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-100 text-primary-700'
        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <span className="text-xl font-bold text-primary-700">Saahvik</span>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClasses}
              onClick={onClose}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
              {item.plan === 'beginner' && (
                <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                  Pro
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
