import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Sparkles, 
  ArrowLeftRight, 
  Star, 
  Clock, 
  GraduationCap, 
  BookOpen, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  PlusCircle,
  UserCheck,
  Search,
  X,
  Filter,
  CreditCard
} from 'lucide-react';
import skillService from '../../services/skillService';
import subscriptionService from '../../services/subscriptionService';
import ExchangeRequestModal from '../../components/exchanges/ExchangeRequestModal';

const PartnerDiscoveryPage = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({ total: 0, mutualCount: 0, complementaryCount: 0 });
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'mutual' | 'complementary'
  const [categoryFilter, setCategoryFilter] = useState('');

  // Exchange proposal modal
  const [modalOpen, setModalOpen] = useState(false);
  const [activePartner, setActivePartner] = useState(null);
  const [activeSkill, setActiveSkill] = useState(null);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError('');
      const [matchRes, catRes, usageRes] = await Promise.allSettled([
        skillService.getPartnerSuggestions(),
        skillService.getCategories(),
        subscriptionService.getUsage(),
      ]);

      if (matchRes.status === 'fulfilled' && matchRes.value?.data) {
        const data = matchRes.value.data;
        const list = Array.isArray(data) ? data : (data.suggestions || []);
        setSuggestions(list);
        setStats({
          total: data.total ?? list.length,
          mutualCount: data.mutualCount ?? list.filter((s) => s.matchType === 'mutual').length,
          complementaryCount: data.complementaryCount ?? list.filter((s) => s.matchType === 'complementary').length,
        });
      } else if (matchRes.status === 'rejected') {
        setError(matchRes.reason?.message || 'Unable to fetch match suggestions.');
      }

      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value?.data)) {
        setCategories(catRes.value.data);
      }

      if (usageRes.status === 'fulfilled' && usageRes.value?.data) {
        setUsage(usageRes.value.data);
      }
    } catch (err) {
      setError(err.message || 'Unable to fetch match suggestions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const handlePropose = (partnerUser, skillToLearn) => {
    setActivePartner(partnerUser);
    setActiveSkill(skillToLearn);
    setModalOpen(true);
  };

  const handleProposalSuccess = () => {
    setFeedback('Exchange proposal sent successfully! Track your request in Exchanges. This partner will now be managed under Exchanges.');
    // Re-fetch matches to update suggestions
    fetchMatches();
    setTimeout(() => setFeedback(''), 6000);
  };

  // Filter suggestions by search query, match type, and category
  const filteredSuggestions = suggestions.filter((match) => {
    // 1. Match type filter
    if (filterType !== 'all' && match.matchType !== filterType) {
      return false;
    }

    // 2. Category filter
    if (categoryFilter) {
      const hasCat =
        match.allOffered?.some((s) => s.category?._id === categoryFilter || s.category?.name === categoryFilter) ||
        match.allWanted?.some((s) => s.category?._id === categoryFilter || s.category?.name === categoryFilter);
      if (!hasCat) return false;
    }

    // 3. Search query filter
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const nameMatch = match.user?.name?.toLowerCase().includes(q);
    const teachMatch = match.allOffered?.some((s) => {
      const title = typeof s === 'string' ? s : s?.title;
      return title?.toLowerCase().includes(q);
    });
    const wantMatch = match.allWanted?.some((s) => {
      const title = typeof s === 'string' ? s : s?.title;
      return title?.toLowerCase().includes(q);
    });
    return nameMatch || teachMatch || wantMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Reciprocal Matching Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Partner Discovery
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Discover learners whose interests intersect with yours. Excludes active in-flight exchange proposals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/connected-partners"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-colors"
          >
            <UserCheck className="w-4 h-4" />
            <span>Connected Partners</span>
          </Link>

          <Link
            to="/my-skills"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Update My Skills</span>
          </Link>
        </div>
      </div>

      {/* Free limit reached alert banner */}
      {usage?.hasReachedLimit && !usage?.hasActiveSubscription && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                Free Exchange Limit Reached ({usage.completedExchanges} of {usage.freeLimit} used)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                You've completed all {usage.freeLimit} free skill exchanges. You can browse partners, but a subscription is required to initiate new exchange proposals.
              </p>
            </div>
          </div>
          <Link
            to="/subscription"
            className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
          >
            View Subscription Plans &rarr;
          </Link>
        </div>
      )}

      {/* Summary KPI Cards / Filter Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setFilterType(filterType === 'mutual' ? 'all' : 'mutual')}
          className={`p-5 rounded-2xl text-left transition-all ${
            filterType === 'mutual'
              ? 'bg-gradient-to-br from-emerald-950/80 to-slate-900 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20'
              : 'bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 hover:border-emerald-500/60'
          } space-y-2`}
        >
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Mutual Matches</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{stats.mutualCount}</p>
          <p className="text-[11px] text-slate-400">
            Both teaching what the other wants to learn
          </p>
        </button>

        <button
          onClick={() => setFilterType(filterType === 'complementary' ? 'all' : 'complementary')}
          className={`p-5 rounded-2xl text-left transition-all ${
            filterType === 'complementary'
              ? 'bg-slate-900/90 border-2 border-sky-400 shadow-lg shadow-sky-500/20'
              : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
          } space-y-2`}
        >
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-xs font-bold uppercase tracking-wider">Complementary</span>
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{stats.complementaryCount}</p>
          <p className="text-[11px] text-slate-400">
            Teaches skills on your wishlist
          </p>
        </button>

        <button
          onClick={() => setFilterType('all')}
          className={`p-5 rounded-2xl text-left transition-all ${
            filterType === 'all'
              ? 'bg-slate-900/90 border-2 border-slate-500 shadow-lg shadow-slate-500/10'
              : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
          } space-y-2`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Eligible Suggestions</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{stats.total}</p>
          <p className="text-[11px] text-slate-400">
            All potential partner profiles
          </p>
        </button>
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suggested partners by name or skill..."
            className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="relative sm:w-64 shrink-0">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-sm focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active Filter Chips */}
      {(filterType !== 'all' || categoryFilter || searchQuery) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Active filters:</span>
          {filterType !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize font-medium">
              Type: {filterType}
              <button onClick={() => setFilterType('all')} className="hover:text-white">
                <X className="w-3 h-3 ml-0.5" />
              </button>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
              Category: {categories.find((c) => c._id === categoryFilter)?.name || 'Selected'}
              <button onClick={() => setCategoryFilter('')} className="hover:text-white">
                <X className="w-3 h-3 ml-0.5" />
              </button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-white">
                <X className="w-3 h-3 ml-0.5" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setFilterType('all');
              setCategoryFilter('');
              setSearchQuery('');
            }}
            className="text-xs text-rose-400 hover:text-rose-300 underline ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Partner Results Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400">Calculating reciprocal skill overlaps...</p>
        </div>
      ) : filteredSuggestions.length > 0 ? (
        <div className="space-y-6">
          {filteredSuggestions.map((match, idx) => {
            const isMutual = match.matchType === 'mutual';

            return (
              <div
                key={match.user?._id || idx}
                className={`p-6 sm:p-8 rounded-3xl transition-all ${
                  isMutual
                    ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-2 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
                    : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Partner Overview */}
                  <div className="flex items-start gap-4">
                    {match.user?.profileImage ? (
                      <img
                        src={match.user.profileImage}
                        alt={match.user.name}
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                        {match.user?.name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/profile/${match.user?._id}`}
                          className="font-extrabold text-lg text-white hover:text-emerald-400 transition-colors"
                        >
                          {match.user?.name}
                        </Link>

                        {isMutual ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950 shadow-sm">
                            <Sparkles className="w-3 h-3 fill-slate-950" />
                            Mutual Match (Score: {match.score})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            Complementary Match
                          </span>
                        )}

                        {match.isPreviousPartner && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <UserCheck className="w-3 h-3" />
                            Previous Partner
                          </span>
                        )}
                      </div>

                      {/* Explanation Callout */}
                      <p className="text-xs text-emerald-400 font-medium">
                        💡 {match.explanation}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                        {match.user?.averageRating > 0 && (
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            {match.user.averageRating.toFixed(1)} ({match.user.reviewCount} reviews)
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span className="capitalize">{match.user?.availability || 'Flexible'} schedule</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const defaultSkill = match.theyTeach?.[0] || match.allOffered?.[0];
                        handlePropose(match.user, typeof defaultSkill === 'object' ? defaultSkill : null);
                      }}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 hover:scale-105"
                    >
                      <span>Propose Exchange</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Overlap Skills Breakdown */}
                <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* What They Teach */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-emerald-400" />
                      They Can Teach (Offered)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {match.allOffered?.map((sk, skIdx) => {
                        const title = typeof sk === 'string' ? sk : sk?.title || '';
                        const isMatchOverlap = match.theyTeach?.some(
                          (t) => (typeof t === 'string' ? t : t?.title) === title
                        );
                        return (
                          <span
                            key={sk?._id || title || skIdx}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isMatchOverlap
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 ring-1 ring-emerald-500/20 font-bold'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {title}
                            {isMatchOverlap && ' ★'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* What They Want */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-sky-400" />
                      They Want to Learn (Wishlist)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {match.allWanted?.map((sk, skIdx) => {
                        const title = typeof sk === 'string' ? sk : sk?.title || '';
                        const isMatchOverlap = match.theyWant?.some(
                          (w) => (typeof w === 'string' ? w : w?.title) === title
                        );
                        return (
                          <span
                            key={sk?._id || title || skIdx}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              isMatchOverlap
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 ring-1 ring-sky-500/20 font-bold'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            }`}
                          >
                            {title}
                            {isMatchOverlap && ' ★'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-emerald-400">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">
              {searchQuery || categoryFilter || filterType !== 'all'
                ? 'No matching partners found'
                : 'No new potential matches'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              {searchQuery || categoryFilter || filterType !== 'all'
                ? 'Try adjusting your search query, filter type, or category to find other learning partners.'
                : 'You have connected with all currently available partners or need to list additional skills you can teach and want to learn!'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/connected-partners"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
            >
              <UserCheck className="w-4 h-4" />
              View Connected Partners
            </Link>
            <Link
              to="/my-skills"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              Add More Skills
            </Link>
          </div>
        </div>
      )}

      {/* Exchange Proposal Modal */}
      <ExchangeRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleProposalSuccess}
        partner={activePartner}
        defaultRequestedSkill={activeSkill}
      />
    </div>
  );
};

export default PartnerDiscoveryPage;
