import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Menu,
  User,
  LogOut,
  Edit3,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

const Header = ({ onOpenMobileMenu }) => {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  // Determine current page title and breadcrumb based on route
  const getPageInfo = () => {
    const path = location.pathname;
    if (path === '/dashboard') return { title: 'Dashboard', section: 'Overview' };
    if (path === '/skills') return { title: 'Explore Skills', section: 'Learning Directory' };
    if (path.startsWith('/skills/')) return { title: 'Skill Details', section: 'Explore Skills' };
    if (path === '/find-partners') return { title: 'Find Partners', section: 'Matchmaking' };
    if (path === '/connected-partners') return { title: 'Connected Partners', section: 'Network' };
    if (path === '/my-skills') return { title: 'My Skills', section: 'Skills Management' };
    if (path.startsWith('/exchanges')) return { title: 'Skill Exchanges', section: 'Collaborations' };
    if (path === '/messages') return { title: 'Messages & Chat', section: 'Live Collaboration' };
    if (path === '/gift-money') return { title: 'Simulated Gift Demo', section: 'Demonstration' };
    if (path === '/profile/edit') return { title: 'Edit Profile', section: 'Account Settings' };
    if (path.startsWith('/profile')) return { title: 'User Profile', section: 'Profile' };
    if (path === '/admin' || path === '/admin/dashboard') return { title: 'Platform Dashboard', section: 'Administration' };
    if (path === '/admin/users') return { title: 'User Management', section: 'Administration' };
    if (path === '/admin/categories') return { title: 'Skill Categories', section: 'Administration' };
    if (path === '/admin/reports') return { title: 'Reports & Moderation', section: 'Administration' };
    return { title: 'SkillSwap', section: 'Platform' };
  };

  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors">
      {/* Left: Mobile Menu Trigger + Breadcrumb Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb / Title */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>{isAdmin ? 'Admin Portal' : 'Workspace'}</span>
            <span>/</span>
            <span className="text-slate-300 truncate">{pageInfo.section}</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate leading-tight">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Right: Status Pill & User Avatar Dropdown */}
      <div className="flex items-center gap-3">
        {/* Quick Status / Role Pill */}
        {isAdmin ? (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Mode</span>
          </div>
        ) : (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>P2P Network</span>
          </div>
        )}

        {/* User Profile Avatar with Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-colors focus:outline-none"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border overflow-hidden ${
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
                <User className="w-3.5 h-3.5" />
              )}
            </div>

            <span className="hidden md:inline-block text-xs font-medium text-slate-200 max-w-[120px] truncate">
              {user?.name?.split(' ')[0] || 'Account'}
            </span>

            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header Info */}
              <div className="px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border overflow-hidden shrink-0 ${
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
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-white truncate">
                      {user?.name || 'SkillSwap Member'}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isAdmin
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {isAdmin ? 'Administrator' : 'Standard Member'}
                  </span>
                  {!isAdmin && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>View Profile</span>
                </Link>

                <Link
                  to="/profile/edit"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-sky-400" />
                  <span>Edit Profile & Avatar</span>
                </Link>
              </div>

              {/* Sign Out Action */}
              <div className="pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
