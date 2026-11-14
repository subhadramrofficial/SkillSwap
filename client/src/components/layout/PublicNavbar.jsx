import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeftRight,
  Compass,
  Sparkles,
  LayoutDashboard,
  Menu,
  X,
  User,
  ShieldCheck
} from 'lucide-react';

const PublicNavbar = () => {
  const { isAuthenticated, isAdmin, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-900/80 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <ArrowLeftRight className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Skill<span className="text-emerald-400">Swap</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                P2P Learning
              </span>
            </div>
          </Link>

          {/* Desktop Nav Actions */}
          <nav className="hidden md:flex items-center gap-4">
            <Link
              to="/skills"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/skills')
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Compass className="w-4 h-4" />
              Explore Skills
            </Link>

            {isAuthenticated ? (
              <Link
                to={isAdmin ? '/admin/dashboard' : '/dashboard'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-emerald-500/20 hover:scale-105"
              >
                {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                <span>{isAdmin ? 'Admin Dashboard' : 'Open Dashboard'}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-105"
                >
                  <Sparkles className="w-4 h-4" />
                  Get Started
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-6 space-y-3">
          <Link
            to="/skills"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium text-slate-200 hover:bg-slate-800"
          >
            <Compass className="w-5 h-5 text-emerald-400" />
            Explore Skills
          </Link>

          {isAuthenticated ? (
            <Link
              to={isAdmin ? '/admin/dashboard' : '/dashboard'}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold"
            >
              <LayoutDashboard className="w-5 h-5" />
              Go to Dashboard
            </Link>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl text-slate-200 bg-slate-800 font-medium"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;
