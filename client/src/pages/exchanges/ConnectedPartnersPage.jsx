import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  CheckCircle2,
  MessageSquare,
  User,
  Star,
  Clock,
  ArrowLeftRight,
  GraduationCap,
  BookOpen,
  Calendar,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  PlusCircle,
  ExternalLink,
  Coffee
} from 'lucide-react';
import skillService from '../../services/skillService';
import ExchangeRequestModal from '../../components/exchanges/ExchangeRequestModal';
import SendGiftModal from '../../components/gifts/SendGiftModal';

const ConnectedPartnersPage = () => {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Re-exchange modal
  const [modalOpen, setModalOpen] = useState(false);
  const [activePartner, setActivePartner] = useState(null);

  // Send Gift modal
  const [giftModalPartner, setGiftModalPartner] = useState(null);
  const [giftModalExchangeId, setGiftModalExchangeId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const fetchConnectedPartners = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await skillService.getConnectedPartners();
      if (res.success && res.data) {
        setConnections(res.data.connections || []);
      }
    } catch (err) {
      setError(err.message || 'Unable to load connected partners.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedPartners();
  }, []);

  const handleProposeNewExchange = (partner) => {
    setActivePartner(partner);
    setModalOpen(true);
  };

  const handleOpenGiftModal = (partner, exchangeId) => {
    setGiftModalPartner(partner);
    setGiftModalExchangeId(exchangeId || null);
  };

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 5000);
  };

  // Filter connections by search (partner name or skill titles)
  const filteredConnections = connections.filter((conn) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const nameMatch = conn.partner?.name?.toLowerCase().includes(q);
    const skillsMatch = conn.skillsExchanged?.some(
      (s) =>
        s.mySkill?.title?.toLowerCase().includes(q) ||
        s.theirSkill?.title?.toLowerCase().includes(q)
    );
    return nameMatch || skillsMatch;
  });

  const totalCompletedSwaps = connections.reduce(
    (acc, curr) => acc + (curr.totalCompleted || curr.skillsExchanged?.length || 1),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Verified Learning Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Connected Partners
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Learners with whom you have successfully completed skill exchanges. Stay in touch and collaborate again.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/find-partners"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>Find New Partners</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-bold uppercase tracking-wider">Connected Partners</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{connections.length}</p>
          <p className="text-[11px] text-slate-400">Peers with completed collaborations</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-teal-400">
            <span className="text-xs font-bold uppercase tracking-wider">Completed Exchanges</span>
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">{totalCompletedSwaps}</p>
          <p className="text-[11px] text-slate-400">Mutual learning journeys finished</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-2">
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-xs font-bold uppercase tracking-wider">Connection Status</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-white">Active</p>
          <p className="text-[11px] text-slate-400">Eligible for reviews and repeat swaps</p>
        </div>
      </div>

      {/* Search Bar */}
      {connections.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connected partners by name or skill..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Feedback */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading connected partners...</p>
        </div>
      ) : filteredConnections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredConnections.map((conn) => {
            const partner = conn.partner;
            const latestExchangeId = conn.latestExchangeId;

            return (
              <div
                key={partner?._id}
                className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 backdrop-blur-xl shadow-xl transition-all flex flex-col justify-between space-y-5"
              >
                {/* Top: Avatar & Basic Info */}
                <div className="flex items-start gap-4">
                  {partner?.profileImage ? (
                    <img
                      src={partner.profileImage}
                      alt={partner.name}
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/40 shrink-0 shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                      {partner?.name?.charAt(0).toUpperCase() || <User className="w-6 h-6" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        to={`/profile/${partner?._id}`}
                        className="font-extrabold text-base sm:text-lg text-white hover:text-emerald-400 transition-colors truncate"
                      >
                        {partner?.name}
                      </Link>

                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected Partner
                      </span>
                    </div>

                    {partner?.bio && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {partner.bio}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                      {partner?.averageRating > 0 && (
                        <span className="flex items-center gap-1 text-amber-400 font-semibold text-[11px]">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          {partner.averageRating.toFixed(1)} ({partner.reviewCount} reviews)
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Completed {new Date(conn.latestCompletedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle: Skills Exchanged Breakdown */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
                    Skills Exchanged ({conn.skillsExchanged?.length || 1})
                  </span>

                  <div className="space-y-2">
                    {conn.skillsExchanged?.map((swap, sIdx) => (
                      <div
                        key={swap.exchangeId || sIdx}
                        className="flex flex-wrap items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/80 gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400">You taught:</span>
                          <span className="font-semibold text-emerald-400 truncate">
                            {swap.mySkill?.title || 'Skill'}
                          </span>
                        </div>

                        <span className="text-slate-600 hidden sm:inline">↔</span>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400">They taught:</span>
                          <span className="font-semibold text-sky-400 truncate">
                            {swap.theirSkill?.title || 'Skill'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/profile/${partner?._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>View Profile</span>
                    </Link>

                    {latestExchangeId && (
                      <Link
                        to={`/messages?exchange=${latestExchangeId}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Open Chat</span>
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenGiftModal(partner, latestExchangeId)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-semibold transition-all"
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      <span>Gift Coffee</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleProposeNewExchange(partner)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Swap Again</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-emerald-400">
            <UserCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">No connected partners yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Once you propose an exchange, complete the mutual learning sessions, and finish the exchange, your learning partner will appear here as a Connected Partner!
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/find-partners"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
            >
              <Users className="w-4 h-4" />
              Find Potential Matches
            </Link>
            <Link
              to="/exchanges"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
              Check Active Exchanges
            </Link>
          </div>
        </div>
      )}

      {/* Exchange Proposal Modal for Repeat Swaps */}
      <ExchangeRequestModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          fetchConnectedPartners();
        }}
        partner={activePartner}
      />

      {/* Gift Coffee Modal */}
      {giftModalPartner && (
        <SendGiftModal
          isOpen={!!giftModalPartner}
          partner={giftModalPartner}
          exchange={giftModalExchangeId ? { _id: giftModalExchangeId } : null}
          onClose={() => setGiftModalPartner(null)}
          onSuccess={(msg) => showFeedback(msg)}
        />
      )}
    </div>
  );
};

export default ConnectedPartnersPage;
