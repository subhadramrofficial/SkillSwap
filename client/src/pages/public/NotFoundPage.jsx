import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home, Compass } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-20 text-center">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-white">404</h1>
          <h2 className="text-xl font-semibold text-slate-200">Page Not Found</h2>
          <p className="text-sm text-slate-400">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            to="/skills"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors"
          >
            <Compass className="w-4 h-4" />
            Explore Skills
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
