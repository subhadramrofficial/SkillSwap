import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import exchangeService from '../../services/exchangeService';
import ExchangeCard from '../../components/exchanges/ExchangeCard';
import LeaveReviewModal from '../../components/reviews/LeaveReviewModal';
import SendGiftModal from '../../components/gifts/SendGiftModal';
import SubmitReportModal from '../../components/reports/SubmitReportModal';
import { 
  ArrowLeftRight, 
  Clock, 
  Sparkles, 
  History, 
  Inbox, 
  Send, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  PlusCircle, 
  Users 
} from 'lucide-react';

const ExchangeManagementPage = () => {
  const { user } = useAuth();
  const { exchangeUnreadCount, markExchangesAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'incoming' | 'outgoing' | 'history'
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Counters
  const [counts, setCounts] = useState({
    active: 0,
    incoming: 0,
    outgoing: 0,
    history: 0,
  });

  // Phase 6 Modals state
  const [reviewModalExchange, setReviewModalExchange] = useState(null);
  const [giftModalExchange, setGiftModalExchange] = useState(null);
  const [reportModalUser, setReportModalUser] = useState(null);

  const fetchAllExchanges = async () => {
    try {
      setLoading(true);
      const res = await exchangeService.getExchanges();
      if (res.success && res.data) {
        const all = res.data;

        // Calculate counts
        const incomingCount = all.filter(
          (e) => e.recipient?._id?.toString() === user?._id?.toString() && e.status === 'pending'
        ).length;

        const outgoingCount = all.filter(
          (e) => e.requester?._id?.toString() === user?._id?.toString() && e.status === 'pending'
        ).length;

        const activeCount = all.filter(
          (e) => ['accepted', 'active'].includes(e.status)
        ).length;

        const historyCount = all.filter(
          (e) => ['completed', 'rejected', 'cancelled'].includes(e.status)
        ).length;

        setCounts({
          incoming: incomingCount,
          outgoing: outgoingCount,
          active: activeCount,
          history: historyCount,
        });

        // Filter based on active tab
        filterByTab(all, activeTab);
      }
    } catch (err) {
      setError(err.message || 'Unable to load exchanges.');
    } finally {
      setLoading(false);
    }
  };

  const filterByTab = (allList, tab) => {
    let filtered = [];
    if (tab === 'incoming') {
      filtered = allList.filter(
        (e) => e.recipient?._id?.toString() === user?._id?.toString() && e.status === 'pending'
      );
    } else if (tab === 'outgoing') {
      filtered = allList.filter(
        (e) => e.requester?._id?.toString() === user?._id?.toString() && e.status === 'pending'
      );
    } else if (tab === 'active') {
      filtered = allList.filter((e) => ['accepted', 'active'].includes(e.status));
    } else if (tab === 'history') {
      filtered = allList.filter((e) => ['completed', 'rejected', 'cancelled'].includes(e.status));
    }
    setExchanges(filtered);
  };

  useEffect(() => {
    fetchAllExchanges();
  }, [activeTab]);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
    fetchAllExchanges();
  };

  const handleAccept = async (id) => {
    try {
      await exchangeService.acceptExchange(id);
      showFeedback('Exchange proposal accepted! You can now start collaborating.');
    } catch (err) {
      setError(err.message || 'Failed to accept exchange.');
    }
  };

  const handleReject = async (id) => {
    try {
      await exchangeService.rejectExchange(id);
      showFeedback('Exchange proposal declined.');
    } catch (err) {
      setError(err.message || 'Failed to decline exchange.');
    }
  };

  const handleCancel = async (id) => {
    try {
      await exchangeService.cancelExchange(id);
      showFeedback('Exchange proposal cancelled.');
    } catch (err) {
      setError(err.message || 'Failed to cancel exchange.');
    }
  };

  const handleActivate = async (id) => {
    try {
      await exchangeService.activateExchange(id);
      showFeedback('Learning session activated and marked in progress!');
    } catch (err) {
      setError(err.message || 'Failed to activate exchange.');
    }
  };

  const handleComplete = async (id) => {
    try {
      await exchangeService.completeExchange(id);
      showFeedback('Exchange successfully completed! You are now eligible to rate and review your partner.');
    } catch (err) {
      setError(err.message || 'Failed to complete exchange.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-7 h-7 text-emerald-400" />
            Skill Exchanges Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track your incoming learning requests, outgoing proposals, and active peer collaborations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {exchangeUnreadCount > 0 && (
            <button
              type="button"
              onClick={markExchangesAsRead}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Mark alerts read ({exchangeUnreadCount})</span>
            </button>
          )}
          <Link
            to="/find-partners"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
          >
            <Users className="w-4 h-4" />
            <span>Discover Partners</span>
          </Link>
        </div>
      </div>

      {/* Global Alerts */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Active Collaborations
          {counts.active > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-slate-950 font-black">
              {counts.active}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('incoming')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'incoming'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Inbox className="w-4 h-4" />
          Incoming Requests
          {counts.incoming > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
              {counts.incoming}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('outgoing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'outgoing'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Send className="w-4 h-4" />
          Sent Proposals
          {counts.outgoing > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500 text-slate-950 font-black">
              {counts.outgoing}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'history'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          Completed & History
          {counts.history > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {counts.history}
            </span>
          )}
        </button>
      </div>

      {/* Main Exchanges Stream */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading your exchanges...</p>
        </div>
      ) : exchanges.length > 0 ? (
        <div className="space-y-4">
          {exchanges.map((exchange) => (
            <ExchangeCard
              key={exchange._id}
              exchange={exchange}
              currentUserId={user?._id}
              onAccept={handleAccept}
              onReject={handleReject}
              onCancel={handleCancel}
              onActivate={handleActivate}
              onComplete={handleComplete}
              onLeaveReview={(ex) => setReviewModalExchange(ex)}
              onSendGift={(ex) => setGiftModalExchange(ex)}
              onReport={(target) => setReportModalUser(target)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            {activeTab === 'active' && <Sparkles className="w-7 h-7 text-emerald-400" />}
            {activeTab === 'incoming' && <Inbox className="w-7 h-7 text-amber-400" />}
            {activeTab === 'outgoing' && <Send className="w-7 h-7 text-sky-400" />}
            {activeTab === 'history' && <History className="w-7 h-7 text-slate-400" />}
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">
              {activeTab === 'active' && 'No active exchanges right now'}
              {activeTab === 'incoming' && 'No pending incoming requests'}
              {activeTab === 'outgoing' && 'No sent proposals awaiting response'}
              {activeTab === 'history' && 'No exchange history recorded yet'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              {activeTab === 'active' &&
                'When you or a partner accepts an exchange proposal, it will appear here so you can collaborate and chat in real-time.'}
              {activeTab === 'incoming' &&
                'Other members who want to learn your skills will send requests that show up here for your approval.'}
              {activeTab === 'outgoing' &&
                'Explore skills or discover partners and send proposals to start learning together.'}
              {activeTab === 'history' &&
                'Completed learning exchanges and past proposals will be safely archived here for your reference.'}
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/find-partners"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              Discover Learning Partners
            </Link>
          </div>
        </div>
      )}

      {/* Leave Review Modal */}
      {reviewModalExchange && (
        <LeaveReviewModal
          isOpen={!!reviewModalExchange}
          exchange={reviewModalExchange}
          onClose={() => setReviewModalExchange(null)}
          onSuccess={(msg) => showFeedback(msg)}
        />
      )}

      {/* Send Gift (Send a Coffee) Modal */}
      {giftModalExchange && (
        <SendGiftModal
          isOpen={!!giftModalExchange}
          exchange={giftModalExchange}
          onClose={() => setGiftModalExchange(null)}
          onSuccess={(msg) => showFeedback(msg)}
        />
      )}

      {/* Moderation Report Modal */}
      {reportModalUser && (
        <SubmitReportModal
          isOpen={!!reportModalUser}
          targetUser={reportModalUser}
          onClose={() => setReportModalUser(null)}
          onSuccess={(msg) => showFeedback(msg)}
        />
      )}
    </div>
  );
};

export default ExchangeManagementPage;
