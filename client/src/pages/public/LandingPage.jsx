import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftRight, 
  Sparkles, 
  Users, 
  MessageSquare, 
  Coffee, 
  ShieldCheck, 
  CheckCircle2, 
  Compass, 
  ArrowRight,
  GraduationCap
} from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-28 md:pb-36 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.15),rgba(255,255,255,0))]"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            Empowering Peer-to-Peer Knowledge Sharing
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Trade Skills, Not Bills. <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              Learn What You Love.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            SkillSwap connects enthusiastic learners worldwide. Teach a skill you've mastered, learn what you're passionate about, and build real friendships through mutual collaboration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition-all shadow-xl shadow-emerald-500/20 hover:scale-105"
            >
              Start Swapping Free
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              to="/skills"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-semibold text-base transition-all"
            >
              <Compass className="w-5 h-5 text-emerald-400" />
              Explore All Skills
            </Link>
          </div>

          {/* Quick Platform Metrics Banner */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
              <p className="text-2xl font-bold text-emerald-400">100%</p>
              <p className="text-xs text-slate-400 font-medium">Free Skill Exchange</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
              <p className="text-2xl font-bold text-sky-400">Real-Time</p>
              <p className="text-xs text-slate-400 font-medium">Socket.IO Messaging</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
              <p className="text-2xl font-bold text-teal-400">Mutual</p>
              <p className="text-xs text-slate-400 font-medium">Reciprocal Matching</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-sm">
              <p className="text-2xl font-bold text-amber-400">Demo Coffee</p>
              <p className="text-xs text-slate-400 font-medium">Simulated Gifting</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20 bg-slate-950 border-t border-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">Simple Process</h2>
            <p className="text-3xl font-extrabold text-white">How SkillSwap Works</p>
            <p className="text-slate-400 mt-2 text-sm">A seamless cycle of learning, sharing, and growing together.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
                1
              </div>
              <h3 className="text-lg font-bold text-white">List Your Skills</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Add the skills you're confident to teach (like Python, Guitar, or Spanish) and the skills you eagerly want to master.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-lg border border-sky-500/20">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Discover & Propose</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Our reciprocal matching engine identifies members with complementary skills. Send an exchange request with a personal learning goal.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-all space-y-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-lg border border-teal-500/20">
                3
              </div>
              <h3 className="text-lg font-bold text-white">Chat & Learn in Real-Time</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Connect via private real-time text chat, schedule sessions, mark exchanges complete, and leave verified ratings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Highlight Features */}
      <section className="py-20 bg-slate-900/30 border-t border-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                <Users className="w-3.5 h-3.5" />
                Community Built for Safety & Trust
              </div>
              <h2 className="text-3xl font-extrabold text-white leading-tight">
                Peer learning protected by design and community moderation.
              </h2>
              <ul className="space-y-3.5 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Age Eligibility (15+):</strong> Strictly validated on the backend to ensure a safe learning space.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Private Live Chat:</strong> Socket.IO rooms restricted only to verified exchange participants.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Simulated Gift Money:</strong> Show gratitude by buying a partner a simulated coffee without any real monetary cost.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Admin Moderation:</strong> Active review of listings and community reports for maximum safety.</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    JS
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Fullstack Mentor</h4>
                    <p className="text-xs text-slate-400">Offers: React & Node.js</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Mutual Match
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-2">
                <p className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  Exchange Match Details
                </p>
                <p className="text-slate-400">
                  "You can teach Spanish, and they want to learn Spanish. They teach React, which is on your wishlist!"
                </p>
              </div>
              <div className="flex justify-end">
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
                >
                  Join to Connect
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
