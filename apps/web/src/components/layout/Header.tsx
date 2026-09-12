import {
  Bars3Icon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 sm:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md hover:bg-gray-100"
      >
        <Bars3Icon className="h-6 w-6 text-gray-600" />
      </button>

      <div className="hidden lg:block">
        <h2 className="text-sm font-medium text-gray-500">
          Hostel Management
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* User menu - using simple dropdown instead of headlessui to avoid extra dep */}
        <div className="relative group">
          <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <UserCircleIcon className="h-8 w-8 text-gray-400" />
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-gray-700">
                {user?.name || user?.email || 'User'}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </button>

          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
            <div className="py-1">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <UserCircleIcon className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
