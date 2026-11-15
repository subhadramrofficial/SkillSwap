import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Sparkles, 
  Check, 
  ArrowLeftRight, 
  CreditCard, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar,
  XCircle,
  ExternalLink
} from 'lucide-react';
import subscriptionService from '../../services/subscriptionService';
import { useAuth } from '../../context/AuthContext';
import { loadRazorpayScript } from '../../utils/loadRazorpay';

const SubscriptionPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [submittingPlan, setSubmittingPlan] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError('');
      const [usageRes, plansRes] = await Promise.allSettled([
        subscriptionService.getUsage(),
        subscriptionService.getPlans(),
      ]);

      if (usageRes.status === 'fulfilled' && usageRes.value?.data) {
        setUsage(usageRes.value.data);
      }

      if (plansRes.status === 'fulfilled' && plansRes.value?.data?.plans) {
        setPlans(plansRes.value.data.plans);
      }
    } catch (err) {
      setError(err.message || 'Unable to load subscription information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  // Handle return parameters if redirected
  useEffect(() => {
    const status = searchParams.get('status');
    const plan = searchParams.get('plan') || 'monthly';
    const subId = searchParams.get('subscription_id') || searchParams.get('session_id');

    if (subId && status === 'success') {
      const verify = async () => {
        try {
          const res = await subscriptionService.verifySubscription({
            subscriptionId: subId,
            plan,
          });
          if (res.success) {
            setFeedback({
              type: 'success',
              title: '🎉 Premium Membership Activated!',
              message: `Your SkillSwap Pro subscription has been verified through Razorpay. You now have unlimited skill exchanges!`,
            });
            fetchSubscriptionData();
          }
        } catch (err) {
          setFeedback({
            type: 'error',
            title: 'Subscription Verification Issue',
            message: err.message || 'Unable to verify subscription with Razorpay.',
          });
        }
      };
      verify();
    } else if (status === 'cancelled') {
      setFeedback({
        type: 'info',
        title: 'Checkout Cancelled',
        message: 'The Razorpay subscription checkout was cancelled. You have not been charged.',
      });
    }
  }, [searchParams]);

  const handleSubscribe = async (planKey) => {
    try {
      setSubmittingPlan(planKey);
      setError('');

      // 1. Initialize Razorpay subscription on backend
      const res = await subscriptionService.createSubscription({ plan: planKey });

      if (!res.success || !res.data?.subscriptionId) {
        throw new Error(res.message || 'Failed to initialize Razorpay subscription.');
      }

      const subData = res.data;

      // 2. Load Razorpay Checkout modal
      const isLoaded = await loadRazorpayScript();

      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection or disable ad-blockers and try again.');
      }

      if (!subData.keyId) {
        throw new Error('Razorpay Key ID is not configured on the server.');
      }

      const options = {
        key: subData.keyId,
        subscription_id: subData.subscriptionId,
        name: 'SkillSwap Pro',
        description: `${planKey === 'yearly' ? 'Annual' : 'Monthly'} Membership`,
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=128&q=80',
        handler: async (response) => {
          try {
            setSubmittingPlan(planKey);
            const verifyRes = await subscriptionService.verifySubscription({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
              subscriptionId: subData.subscriptionId,
              plan: planKey,
            });

            if (verifyRes.success) {
              setFeedback({
                type: 'success',
                title: '🎉 Premium Membership Activated!',
                message: `Your SkillSwap Pro ${planKey === 'yearly' ? 'Annual' : 'Monthly'} subscription is now active! Enjoy unlimited skill exchanges.`,
              });
              fetchSubscriptionData();
            } else {
              setError(verifyRes.message || 'Verification failed');
            }
          } catch (vErr) {
            setError(vErr.response?.data?.message || vErr.message || 'Verification failed');
          } finally {
            setSubmittingPlan(null);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: planKey === 'yearly' ? '#9333ea' : '#10b981',
        },
        modal: {
          ondismiss: () => {
            setSubmittingPlan(null);
            setFeedback({
              type: 'info',
              title: 'Checkout Closed',
              message: 'The Razorpay subscription checkout was closed without completing authorization.',
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (errResponse) => {
        setError(errResponse.error?.description || 'Subscription mandate authorization failed.');
        setSubmittingPlan(null);
      });
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to initialize subscription.');
      setSubmittingPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your Pro subscription? You will retain unlimited access until the end of your current billing period.')) {
      return;
    }

    try {
      setCancelLoading(true);
      setError('');
      const res = await subscriptionService.cancelSubscription();
      if (res.success) {
        setFeedback({
          type: 'info',
          title: 'Subscription Scheduled for Cancellation',
          message: res.message || 'Your subscription will end at the close of your current billing period. You retain full Pro access until then.',
        });
        fetchSubscriptionData();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to cancel subscription.');
    } finally {
      setCancelLoading(false);
    }
  };

  const completedCount = usage?.completedExchanges ?? user?.completedExchangeCount ?? 0;
  const freeLimit = usage?.freeLimit ?? 3;
  const remainingFree = usage?.remainingFreeExchanges ?? Math.max(0, freeLimit - completedCount);
  const hasReachedLimit = usage?.hasReachedLimit ?? (completedCount >= freeLimit);
  const isSubscribed = usage?.hasActiveSubscription ?? false;
  const currentPlan = usage?.subscription?.plan || 'free';
  const periodEnd = usage?.subscription?.currentPeriodEnd;
  const cancelAtEnd = usage?.subscription?.cancelAtPeriodEnd;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-10 animate-in fade-in">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          SkillSwap Premium Membership
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Simple, Transparent Plans for Every Learner
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Every member starts with 3 free completed skill exchanges. Subscribe to unlock unlimited collaborations, recurring monthly or yearly learning, and premium platform features.
        </p>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 sm:p-5 rounded-3xl border flex items-start justify-between gap-3 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Calendar className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-bold text-sm text-white">{feedback.title}</h4>
              <p className="text-xs mt-0.5 leading-relaxed">{feedback.message}</p>
            </div>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1 text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Current Usage Status Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Status</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isSubscribed
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    : hasReachedLimit
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {isSubscribed 
                  ? `Pro ${currentPlan === 'yearly' ? 'Annual' : 'Monthly'} Member` 
                  : hasReachedLimit 
                  ? 'Free Limit Reached' 
                  : 'Community Free Tier'}
              </span>

              {cancelAtEnd && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Cancels at period end
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {isSubscribed ? (
                'Unlimited Skill Exchanges Active'
              ) : (
                `${completedCount} of ${freeLimit} free exchanges used`
              )}
            </h2>

            <p className="text-xs text-slate-400">
              {isSubscribed
                ? `Your account has unlimited access to initiate and complete skill exchanges.${periodEnd ? ` Current billing cycle ends on ${new Date(periodEnd).toLocaleDateString()}.` : ''}`
                : hasReachedLimit
                ? 'You have completed all 3 free skill exchanges. A subscription is required before initiating another new exchange.'
                : `${remainingFree} more free completed exchange${remainingFree === 1 ? '' : 's'} available before a subscription is required.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isSubscribed ? (
              <>
                {!cancelAtEnd && (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span>Cancel Subscription</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <Link
                  to="/exchanges"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700/60 transition-colors"
                >
                  View My Exchanges
                </Link>
                <Link
                  to="/find-partners"
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
                >
                  Find Partners
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Progress bar for free tier */}
        {!isSubscribed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Free Exchange Allocation</span>
              <span className="font-bold text-white">
                {Math.round(Math.min(100, (completedCount / freeLimit) * 100))}% Used
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  hasReachedLimit ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{
                  width: `${Math.min(100, (completedCount / freeLimit) * 100)}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>0 Completed</span>
              <span>1 Completed</span>
              <span>2 Completed</span>
              <span>3 Completed (Limit Reached)</span>
            </div>
          </div>
        )}

        {/* Active & Pending Continuity Guarantee */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white">Continuous Exchanges Guarantee: </span>
            The 3-exchange limit only checks new exchange proposal creations. Any pending or active exchanges you have already started will never be blocked and can proceed to full completion normally.
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan 1: Free Tier */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
              Starter
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Free Community Tier</h3>
              <p className="text-xs text-slate-400 mt-1">
                Perfect for trying out peer-to-peer learning and testing skills.
              </p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-white">₹0</span>
              <span className="text-xs text-slate-400">/ forever</span>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>3 free completed skill exchanges</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Explore full skill and category directory</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Reciprocal partner suggestions engine</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Direct peer chat & session messaging</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Community ratings and reviews</span>
              </div>
            </div>
          </div>

          <button
            disabled
            className="w-full py-3 rounded-xl bg-slate-800 text-slate-400 font-semibold text-xs border border-slate-700/50 cursor-default"
          >
            {isSubscribed ? 'Free Tier Included' : 'Current Active Plan'}
          </button>
        </div>

        {/* Plan 2: Pro Monthly */}
        <div className={`p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 space-y-6 flex flex-col justify-between relative shadow-xl ${
          isSubscribed && currentPlan === 'monthly'
            ? 'border-purple-500/80 shadow-purple-500/10'
            : 'border-emerald-500/50 shadow-emerald-500/5'
        }`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
            Most Flexible
          </div>

          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
              <Zap className="w-3.5 h-3.5" />
              Pro Monthly
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Unlimited Learner</h3>
              <p className="text-xs text-slate-400 mt-1">
                For active learners who want unlimited monthly peer collaborations.
              </p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-white">₹499</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <div className="flex items-start gap-2.5 text-xs text-slate-200 font-medium">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Unlimited completed skill exchanges</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Priority placement in partner discovery</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Verified Pro Member badge on profile</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Recurring monthly auto-renewal via Razorpay</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Cancel anytime with 1 click</span>
              </div>
            </div>
          </div>

          {isSubscribed && currentPlan === 'monthly' ? (
            <div className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs text-center">
              Current Active Subscription
            </div>
          ) : (
            <button
              onClick={() => handleSubscribe('monthly')}
              disabled={submittingPlan !== null}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submittingPlan === 'monthly' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Razorpay...</span>
                </>
              ) : (
                <>
                  <span>Subscribe Monthly via Razorpay</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Plan 3: Pro Annual */}
        <div className={`p-6 sm:p-8 rounded-3xl bg-slate-900/60 border space-y-6 flex flex-col justify-between relative shadow-xl ${
          isSubscribed && currentPlan === 'yearly'
            ? 'border-purple-500/80 shadow-purple-500/10'
            : 'border-slate-800'
        }`}>
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold border border-purple-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Pro Annual (Save ~25%)
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Annual Master</h3>
              <p className="text-xs text-slate-400 mt-1">
                Best value for year-round learning with over 25% annual savings.
              </p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-extrabold text-white">₹4,499</span>
              <span className="text-xs text-slate-400">/ year</span>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <div className="flex items-start gap-2.5 text-xs text-slate-200 font-medium">
                <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>All Pro Monthly features included</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>Save ~25% compared to monthly billing</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>Priority customer & mentorship matching</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>Annual recurring billing via Razorpay</span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>Golden profile distinction badge</span>
              </div>
            </div>
          </div>

          {isSubscribed && currentPlan === 'yearly' ? (
            <div className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs text-center">
              Current Active Subscription
            </div>
          ) : (
            <button
              onClick={() => handleSubscribe('yearly')}
              disabled={submittingPlan !== null}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-600/20 hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submittingPlan === 'yearly' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Razorpay...</span>
                </>
              ) : (
                <>
                  <span>Subscribe Annually via Razorpay</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Razorpay Security & Guarantee Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-slate-800 text-slate-300 shrink-0">
            <CreditCard className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-white text-xs sm:text-sm">
              Official Razorpay Test Mode Integration
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Subscriptions use bank-grade 256-bit encryption through Razorpay Subscriptions. Supports recurring mandates, UPI Autopay, Cards and NetBanking. Cancel anytime with a single click.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
