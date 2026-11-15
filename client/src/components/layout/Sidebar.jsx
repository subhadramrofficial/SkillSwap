import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  LayoutDashboard,
  Compass,
  Users,
  BookOpen,
  ArrowLeftRight,
  MessageSquare,
  Coffee,
  User,
  UserCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Layers,
  Flag,
  CreditCard,
  Bell,
  X
} from 'lucide-react';

const Sidebar = ({ isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen }) => {
  const { user, isAdmin, logout } = useAuth();
  const { exchangeUnreadCount, chatUnreadCount, matchUnreadCount, giftUnreadCount, totalUnread } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  const isActive = (path) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    }
    if (path === '/exchanges') {
      return location.pathname.startsWith('/exchanges');
    }
    if (path === '/notifications') {
      return location.pathname === '/notifications';
    }
    if (path === '/skills') {
      return location.pathname === '/skills' || (location.pathname.startsWith('/skills/') && !location.pathname.startsWith('/my-skills'));
    }
    if (path === '/profile') {
      return location.pathname === '/profile' && !location.pathname.startsWith('/profile/edit');
    }
    return location.pathname === path;
  };

  // Regular user nav items
  const regularNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Explore Skills', path: '/skills', icon: Compass },
    { name: 'Find Partners', path: '/find-partners', icon: Users },
    { name: 'Connected Partners', path: '/connected-partners', icon: UserCheck },
    { name: 'My Skills', path: '/my-skills', icon: BookOpen },
    { name: 'Exchanges', path: '/exchanges', icon: ArrowLeftRight },
    { name: 'Chat', path: '/messages', icon: MessageSquare },
    { name: 'Subscription', path: '/subscription', icon: CreditCard },
    { name: 'Send a Coffee', path: '/gift-money', icon: Coffee },
    { name: 'User Profile', path: '/profile', icon: User },
  ];

  // Admin nav items
  const adminNavItems = [
    { name: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'User Management', path: '/admin/users', icon: Users },
    { name: 'Skill Management', path: '/admin/skills', icon: BookOpen },
    { name: 'Skill Categories', path: '/admin/categories', icon: Layers },
    { name: 'Reports & Moderation', path: '/admin/reports', icon: Flag },
    { name: 'Admin Profile', path: '/profile', icon: User },
  ];

  const navItems = isAdmin ? adminNavItems : regularNavItems;
  const brandPath = isAdmin ? '/admin/dashboard' : '/dashboard';

  const getBadgeCount = (path) => {
    if (isAdmin) return 0;
    if (path === '/notifications') return totalUnread || 0;
    if (path === '/exchanges') return exchangeUnreadCount;
    if (path === '/messages') return chatUnreadCount;
    if (path === '/find-partners') return matchUnreadCount || 0;
    if (path === '/gift-money') return giftUnreadCount || 0;
    return 0;
  };

  const formatBadge = (count) => {
    if (!count || count <= 0) return null;
    return count > 99 ? '99+' : count.toString();
  };

  const handleNavClick = () => {
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out ${
          /* Desktop collapsed vs expanded */
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${
          /* Mobile Drawer slide-in */
          mobileOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header / Branding */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <Link
            to={brandPath}
            onClick={handleNavClick}
            className="flex items-center gap-3 overflow-hidden group"
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105 ${
                isAdmin
                  ? 'bg-gradient-to-tr from-rose-500 to-amber-500 shadow-rose-500/20'
                  : 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/20'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              ) : (
                <ArrowLeftRight className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              )}
            </div>

            {(!isCollapsed || mobileOpen) && (
              <div className="flex flex-col min-w-0 transition-opacity duration-200">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent truncate">
                  Skill<span className={isAdmin ? 'text-rose-400' : 'text-emerald-400'}>Swap</span>
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                  {isAdmin ? 'Admin Console' : 'P2P Platform'}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div
          className={`flex-1 px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 ${
            isCollapsed && !mobileOpen ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const badgeCount = getBadgeCount(item.path);
            const badgeText = formatBadge(badgeCount);

            return (
              <div key={item.path} className="relative group">
                <Link
                  to={item.path}
                  onClick={handleNavClick}
                  title={isCollapsed && !mobileOpen ? item.name : undefined}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isCollapsed && !mobileOpen ? 'justify-center px-0' : ''
                  } ${
                    active
                      ? isAdmin
                        ? 'bg-rose-500/10 text-rose-400 font-semibold border-l-4 border-rose-500 shadow-sm'
                        : 'bg-emerald-500/10 text-emerald-400 font-semibold border-l-4 border-emerald-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon
                      className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                        active
                          ? isAdmin
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {isCollapsed && !mobileOpen && badgeText && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black leading-tight flex items-center justify-center bg-emerald-500 text-slate-950 shadow-md ring-2 ring-slate-900 animate-in zoom-in-50 duration-150">
                        {badgeText}
                      </span>
                    )}
                  </div>

                  {(!isCollapsed || mobileOpen) && (
                    <>
                      <span className="truncate">{item.name}</span>
                      {badgeText && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950 shadow-sm shrink-0 animate-in zoom-in-50 duration-150">
                          {badgeText}
                        </span>
                      )}
                    </>
                  )}
                </Link>

                {/* Floating Tooltip when Collapsed on Desktop */}
                {isCollapsed && !mobileOpen && (
                  <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-white text-xs font-semibold shadow-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap flex items-center gap-2">
                    <span>{item.name}</span>
                    {badgeText && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950">
                        {badgeText}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
          <div
            className={`flex items-center gap-3 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 ${
              isCollapsed && !mobileOpen ? 'justify-center p-1.5' : ''
            }`}
          >
            {/* User Avatar */}
            <Link
              to="/profile"
              onClick={handleNavClick}
              className="relative shrink-0 group/avatar"
              title="View your profile"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs border overflow-hidden transition-transform group-hover/avatar:scale-105 ${
                  isAdmin
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name || 'User'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : user?.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
            </Link>

            {/* User Info (Expanded only) */}
            {(!isCollapsed || mobileOpen) && (
              <div className="flex-1 min-w-0">
                <Link
                  to="/profile"
                  onClick={handleNavClick}
                  className="block font-semibold text-xs text-white hover:text-emerald-400 transition-colors truncate"
                >
                  {user?.name || 'Member'}
                </Link>
                <p className="text-[10px] text-slate-400 truncate">
                  {isAdmin ? 'Administrator' : user?.email || 'Active Member'}
                </p>
              </div>
            )}

            {/* Logout Action */}
            <div className="relative group/logout">
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Tooltip on collapsed */}
              {isCollapsed && !mobileOpen && (
                <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-rose-400 text-xs font-semibold shadow-2xl pointer-events-none opacity-0 group-hover/logout:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap">
                  Sign Out
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
