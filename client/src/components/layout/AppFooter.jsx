import React from 'react';
import { ArrowLeftRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

const AppFooter = () => {
  return (
    <footer className="mt-auto border-t border-slate-900 bg-slate-950/40 text-slate-500 text-xs py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ArrowLeftRight className="w-3 h-3 stroke-[2.5]" />
          </div>
          <span className="font-semibold text-slate-400">SkillSwap</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-500">Peer-to-Peer Learning Platform</span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <Link to="/skills" className="hover:text-emerald-400 transition-colors">
            Skill Directory
          </Link>
          <Link to="/find-partners" className="hover:text-emerald-400 transition-colors">
            Find Partners
          </Link>
          <span className="flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> on MERN Stack
          </span>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
