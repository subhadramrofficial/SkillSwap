import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import skillService from '../../services/skillService';
import subscriptionService from '../../services/subscriptionService';
import { 
  BookOpen, 
  Users, 
  ArrowLeftRight, 
  MessageSquare, 
  Sparkles, 
  Clock, 
  Star, 
  PlusCircle, 
  Compass,
  Coffee,
  CheckCircle2,
  Calendar,
  GraduationCap,
  Loader2,
  CreditCard
} from 'lucide-react';

const DashboardPage = () => {
  const { user, isAdmin } = useAuth();
  const [teachingSkills, setTeachingSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  useEffect(() => {
    const fetchTeachingSkills = async () => {
      try {
        setLoadingSkills(true);
        const res = await skillService.getMySkills();
        if (res.success && res.data) {
          setTeachingSkills(res.data.offered || []);
        }
      } catch (err) {
        console.warn('[Dashboard Skills Fetch Error]', err.message);
      } finally {
        setLoadingSkills(false);
      }
    };

    const fetchUsage = async () => {
      try {
        setLoadingUsage(true);
        const res = await subscriptionService.getUsage();
        if (res.success && res.data) {
          setUsage(res.data);
        }
      } catch (err) {
        console.warn('[Dashboard Usage Fetch Error]', err.message);
      } finally {
        setLoadingUsage(false);
      }
    };

    fetchTeachingSkills();
    fetchUsage();
  }, []);

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/20 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Learning Hub Active
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Hello, {user?.name || 'Fellow Learner'}! 👋
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Ready to learn something new today? Connect with peers, share your expertise, and discover exciting skills.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/find-partners"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
            >
              <Users className="w-4 h-4" />
              Find Partners
            </Link>
            <Link
              to="/my-skills"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700/60 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              Manage Skills
            </Link>
          </div>
        </div>
      </div>

      {/* Free Limit Reached Alert Banner */}
      {usage?.hasReachedLimit && !usage?.hasActiveSubscription && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Free Completed Exchange Limit Reached (3 of 3 used)</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                You have completed 3 of 3 free skill exchanges. Any existing pending or active exchanges can continue normally, but you will need a subscription to initiate new exchange requests.
              </p>
            </div>
          </div>
          <Link
            to="/subscription"
            className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 hover:scale-105"
          >
            View Subscription Plans &rarr;
          </Link>
        </div>
      )}

      {/* Highlights & Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Free Completed Exchanges Usage */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Exchange Usage</span>
            <ArrowLeftRight className={`w-4 h-4 ${usage?.hasReachedLimit ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-bold text-white">
              {loadingUsage ? (
                '...'
              ) : usage?.hasActiveSubscription ? (
                'Unlimited (Pro)'
              ) : (
                `${usage?.completedExchanges || 0} of ${usage?.freeLimit || 3} used`
              )}
            </p>
            {usage?.hasReachedLimit && !usage?.hasActiveSubscription && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Limit
              </span>
            )}
          </div>
          {/* Usage Progress Bar */}
          {!usage?.hasActiveSubscription ? (
            <div className="space-y-1.5 pt-1">
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usage?.hasReachedLimit ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (((usage?.completedExchanges || 0) / (usage?.freeLimit || 3)) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {usage?.hasReachedLimit
                    ? '3 of 3 free used'
                    : `${usage?.remainingFreeExchanges ?? 3} free left`}
                </span>
                <Link to="/subscription" className="text-emerald-400 hover:underline font-semibold">
                  {usage?.hasReachedLimit ? 'Subscribe &rarr;' : 'Plans &rarr;'}
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-400">Active Pro Membership</p>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Availability</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-white capitalize">{user?.availability || 'Flexible'}</p>
          <p className="text-xs text-slate-400">Preferred schedule for exchanges</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Rating</span>
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-bold text-white">
              {user?.averageRating ? user.averageRating.toFixed(1) : 'New'}
            </p>
            <span className="text-xs text-slate-400">({user?.reviewCount || 0} reviews)</span>
          </div>
          <p className="text-xs text-slate-400">Verified peer exchange rating</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Account Status</span>
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-lg font-bold text-white capitalize">{user?.accountStatus || 'Active'}</p>
          <p className="text-xs text-slate-400">Full platform privileges</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Skills I Can Teach</span>
            <GraduationCap className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-white">
            {loadingSkills ? '...' : teachingSkills.length}
          </p>
          <p className="text-xs text-slate-400">Skills you are ready to share</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Action Cards */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-400" />
            Explore Modules
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/find-partners"
              className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all group space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Find Learning Partners</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Discover users matching your teaching skills and wishlist. Mutual reciprocal matches are prioritized.
              </p>
            </Link>

            <Link
              to="/skills"
              className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all group space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Explore Skill Directory</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Search community skill listings filtered by category, experience level, and teacher credentials.
              </p>
            </Link>

            <Link
              to="/exchanges"
              className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all group space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">My Exchanges</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track pending requests, active peer collaborations, and completed learning journeys.
              </p>
            </Link>

            <Link
              to="/messages"
              className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all group space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Real-Time Chat</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Live communication channel with accepted exchange partners with instant message delivery.
              </p>
            </Link>
          </div>
        </div>

        {/* Right Column: User Profile Snapshot */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white">Your Profile Snapshot</h2>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-extrabold text-xl shadow-lg shadow-emerald-500/20">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">{user?.name}</h3>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>

            {user?.bio ? (
              <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                "{user.bio}"
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                You haven't written a biography yet. Tell other learners about yourself!
              </p>
            )}

            {/* Skills I Can Teach */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                  Skills I Can Teach
                </h4>
                <Link
                  to="/my-skills"
                  className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Manage
                </Link>
              </div>

              {loadingSkills ? (
                <div className="py-4 flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  Loading teaching skills...
                </div>
              ) : teachingSkills.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {teachingSkills.map((skill) => (
                    <div
                      key={skill._id}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{skill.title}</p>
                        {skill.category?.name && (
                          <p className="text-[10px] text-slate-400 truncate">{skill.category.name}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize shrink-0">
                        {skill.experienceLevel || 'Skill'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">
                    You haven't added any teaching skills yet.
                  </p>
                  <Link
                    to="/my-skills"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    <PlusCircle className="w-3 h-3" />
                    Add Teaching Skill
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/profile/edit"
              className="block w-full py-2.5 text-center text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Edit Full Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
