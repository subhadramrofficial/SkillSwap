import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Coffee, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  Calendar, 
  User, 
  Loader2, 
  AlertCircle, 
  Heart,
  ArrowLeftRight,
  Info,
  Copy,
  CheckCircle2,
  Receipt,
  UserCheck,
  CreditCard,
  Clock,
  XCircle,
  CheckCheck,
  Trash2
} from 'lucide-react';
import giftService from '../../services/giftService';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { resolveNotificationCategory } from '../../services/notificationService';

const GiftMoneyPage = () => {
  const { user } = useAuth();
  const {
    notifications,
    giftUnreadCount,
    markGiftsAsRead,
    markSingleAsRead,
    deleteNotification,
    refreshBadges,
  } = useNotifications();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('received'); // 'received' | 'sent'
  const [history, setHistory] = useState({ 
    sent: [], 
    received: [], 
    stats: { sent: { totalAmount: 0 }, received: { totalAmount: 0 } } 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchGiftHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await giftService.getGiftHistory();
      if (res.success && res.data) {
        setHistory(res.data);
      }
    } catch (err) {
      setError(err.message || 'Unable to load gift history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGiftHistory();
  }, []);

  // Handle return status if redirected back
  useEffect(() => {
    const status = searchParams.get('status');
    const orderId = searchParams.get('order_id') || searchParams.get('session_id');

    if (orderId && status === 'success') {
      setPaymentFeedback({
        type: 'success',
        title: 'Razorpay Coffee Gift Confirmed!',
        message: 'Your payment was successfully confirmed through Razorpay. Thank you for supporting peer mentorship!',
      });
      fetchGiftHistory();
    } else if (status === 'cancelled') {
      setPaymentFeedback({
        type: 'info',
        title: 'Checkout Cancelled',
        message: 'The Razorpay payment session was cancelled. No charges were deducted.',
      });
    }
  }, [searchParams]);

  const handleCopyTxnId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentList = activeTab === 'received' ? (history.received || []) : (history.sent || []);

  const totalReceived = history.stats?.received?.totalAmount ?? history.stats?.totalReceivedUSD ?? 0;
  const totalSent = history.stats?.sent?.totalAmount ?? history.stats?.totalSentUSD ?? 0;

  const giftNotifications = notifications.filter(
    (n) => resolveNotificationCategory(n) === 'gifts'
  );
  const unreadGiftNotifications = giftNotifications.filter((n) => !n.isRead);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8 animate-in fade-in">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20 mb-2">
            <Coffee className="w-3.5 h-3.5" />
            <span>Peer Appreciation Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Coffee Money Transactions
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track voluntary tokens of appreciation sent and received via Razorpay UPI/Cards and peer exchanges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/connected-partners"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Connected Partners</span>
          </Link>
          <Link
            to="/exchanges"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Exchanges</span>
          </Link>
        </div>
      </div>

      {/* Coffee Gift Alerts Section */}
      {giftNotifications.length > 0 && (
        <div className="p-5 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Coffee className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base">Coffee Gift Alerts</h3>
                  {unreadGiftNotifications.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black shadow-sm">
                      {unreadGiftNotifications.length > 99 ? '99+' : unreadGiftNotifications.length} unread
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Peer tokens of appreciation sent directly to you.
                </p>
              </div>
            </div>

            {unreadGiftNotifications.length > 0 && (
              <button
                type="button"
                onClick={markGiftsAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-colors self-start sm:self-auto"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all coffee gifts read</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {giftNotifications.map((notif) => (
              <div
                key={notif._id}
                className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  !notif.isRead
                    ? 'bg-slate-800/80 border-amber-500/40 shadow-md'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{notif.title}</p>
                    <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{notif.message}</p>
                    {notif.sender?.name && (
                      <p className="text-[11px] text-amber-400 font-medium mt-1">
                        From: {notif.sender.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={() => markSingleAsRead(notif._id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteNotification(notif._id)}
                    title="Delete notification"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Feedback Banner */}
      {paymentFeedback && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border flex items-start justify-between gap-3 animate-in fade-in ${
            paymentFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : paymentFeedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {paymentFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : paymentFeedback.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm text-white">{paymentFeedback.title}</h4>
              <p className="text-xs mt-0.5 leading-relaxed">{paymentFeedback.message}</p>
            </div>
          </div>
          <button
            onClick={() => setPaymentFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Total Received */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Coffee Received</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            ₹{totalReceived}{' '}
            <span className="text-xs font-medium text-emerald-400">INR</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {history.received?.length || 0} gratitude gifts received from partners
          </p>
        </div>

        {/* Total Sent */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Coffee Sent</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            ₹{totalSent}{' '}
            <span className="text-xs font-medium text-amber-400">INR</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {history.sent?.length || 0} gifts sent to mentor partners
          </p>
        </div>

        {/* Razorpay Security & Gratitude Impact Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col justify-between space-y-3 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Razorpay Payment Security</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All payments are processed securely with bank-grade encryption via Razorpay UPI, Cards, and NetBanking. No sensitive card credentials are ever stored on SkillSwap.
          </p>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>Always voluntary — skill exchange sessions remain 100% free.</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'received'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Gifts Received ({history.received?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'sent'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Gifts Sent ({history.sent?.length || 0})</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Transaction List */}
      {loading ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading gift transactions...</p>
        </div>
      ) : currentList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentList.map((item) => {
            const isReceived = activeTab === 'received';
            const counterparty = isReceived ? item.sender : item.recipient;
            const messageText = item.message || item.note;
            const isRazorpay = item.paymentMethod === 'razorpay' || (!item.isDemo && item.razorpayOrderId);

            return (
              <div
                key={item._id}
                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 space-y-4 transition-all flex flex-col justify-between"
              >
                {/* Header: Counterparty, Amount & Status */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      {counterparty?.profileImage ? (
                        <img
                          src={counterparty.profileImage}
                          alt={counterparty.name}
                          className="w-11 h-11 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {counterparty?.name?.charAt(0) || <User className="w-4 h-4" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs sm:text-sm truncate">
                          {isReceived ? `From ${counterparty?.name || 'Partner'}` : `To ${counterparty?.name || 'Partner'}`}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black ${
                          isReceived
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <Coffee className="w-3.5 h-3.5" />
                        {isReceived ? '+' : '-'}₹{item.amount} INR
                      </span>
                    </div>
                  </div>

                  {/* Transaction ID & Status Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Receipt className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono text-amber-400/90 font-semibold">
                        {item.transactionId || `TXN-${item._id?.slice(-8)}`}
                      </span>
                      <button
                        onClick={() => handleCopyTxnId(item.transactionId || item._id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                        title="Copy Transaction ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {copiedId === (item.transactionId || item._id) && (
                        <span className="text-[10px] text-emerald-400 font-bold">Copied!</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.status === 'completed' ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isRazorpay
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {isRazorpay ? <CreditCard className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
                          {isRazorpay ? 'Paid via Razorpay' : 'Coffee Gift'}
                        </span>
                      ) : item.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <Clock className="w-3 h-3" />
                          Pending Razorpay Order
                        </span>
                      ) : item.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          <XCircle className="w-3 h-3" />
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <AlertCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Personal Message */}
                  {messageText && (
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 italic">
                      "{messageText}"
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 text-right pt-2 border-t border-slate-800/50 flex items-center justify-between">
                  <span>{isRazorpay ? 'Razorpay Verified Transaction' : 'Simulated Token'}</span>
                  {item.razorpayPaymentId && (
                    <span className="font-mono text-slate-500 truncate max-w-[170px]">
                      Pay ID: {item.razorpayPaymentId}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-amber-400">
            <Coffee className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-base">
            {activeTab === 'received' ? 'No gifts received yet' : 'No gifts sent yet'}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {activeTab === 'received'
              ? 'Complete learning exchanges and share your knowledge. Partners can voluntarily treat you to a coffee via Razorpay in appreciation!'
              : 'After you finish a successful exchange session with a mentor, you can send them a coffee directly from your Completed Exchanges or Connected Partners page.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/connected-partners"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              Connected Partners
            </Link>
            <Link
              to="/exchanges"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-md shadow-amber-500/20"
            >
              Go to Exchanges
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default GiftMoneyPage;
