import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeftRight, ArrowLeft } from 'lucide-react';

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Sleek Minimal Auth Header */}
      <header className="h-16 border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <ArrowLeftRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Skill<span className="text-emerald-400">Swap</span>
            </span>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Auth Content Container */}
      <main className="flex-1 flex flex-col items-center justify-center">
        <Outlet />
      </main>

      {/* Minimal Footer */}
      <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} SkillSwap Platform. Mutual peer learning.</p>
      </footer>
    </div>
  );
};

export default AuthLayout;
