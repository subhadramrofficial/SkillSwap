import React from 'react';
import { ArrowLeftRight, Heart, Sparkles, Shield, Coffee } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950">
                <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
              </div>
              <span className="font-bold text-lg text-white">SkillSwap</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Peer-to-peer knowledge exchange platform built on the MERN stack. Learn new skills mutually without financial barriers.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">Explore</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/skills" className="hover:text-emerald-400 transition-colors">Explore All Skills</Link></li>
              <li><Link to="/find-partners" className="hover:text-emerald-400 transition-colors">Partner Discovery</Link></li>
              <li><Link to="/gift-money" className="hover:text-emerald-400 transition-colors">Send a Coffee</Link></li>
            </ul>
          </div>

          {/* Learning Community */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">Community</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Free Peer Exchange</li>
              <li className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-sky-400" /> Age-Verified Safety (15+)</li>
              <li className="flex items-center gap-1.5"><Coffee className="w-3.5 h-3.5 text-amber-400" /> Send a Coffee</li>
            </ul>
          </div>

          {/* Gifting Notice */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Coffee Gifting
            </span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              SkillSwap enables members to express gratitude by gifting coffee to learning mentors via secure Razorpay checkout.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} SkillSwap Platform. Built for collaborative learning.</p>
          <p className="flex items-center gap-1">
            Engineered with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> using MERN Stack
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
