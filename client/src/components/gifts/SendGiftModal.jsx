import React, { useState, useEffect } from 'react';
import { 
  Coffee, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ShieldCheck, 
  Heart, 
  ArrowRight, 
  ArrowLeft, 
  Copy, 
  Receipt,
  User,
  CreditCard,
  Info
} from 'lucide-react';
import giftService from '../../services/giftService';
import { useAuth } from '../../context/AuthContext';
import { loadRazorpayScript } from '../../utils/loadRazorpay';

const SendGiftModal = ({ 
  isOpen, 
  onClose, 
  exchange = null, 
  partner: propPartner = null, 
  recipient: propRecipient = null,
  onSuccess 
}) => {
  const { user: currentUser } = useAuth();
  
  // Steps: 'form' | 'confirm' | 'receipt'
  const [step, setStep] = useState('form');
  const [selectedPreset, setSelectedPreset] = useState(100);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('Thanks so much for the learning session! Enjoy a coffee on me ☕');
  const [paymentMode, setPaymentMode] = useState('razorpay'); // 'razorpay' | 'demo'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [transactionReceipt, setTransactionReceipt] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Determine recipient partner
  let partner = propPartner || propRecipient;
  if (!partner && exchange) {
    const currentUserId = currentUser?._id?.toString();
    const isRequester = 
      exchange.requester?._id?.toString() === currentUserId ||
      exchange.requester?.toString() === currentUserId;
    partner = isRequester ? exchange.recipient : exchange.requester;
  }

  // Reset state when modal opens or partner changes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setSelectedPreset(100);
      setCustomAmount('');
      setMessage('Thanks so much for the learning session! Enjoy a coffee on me ☕');
      setPaymentMode('razorpay');
      setError('');
      setTransactionReceipt(null);
      setCopiedId(false);
    }
  }, [isOpen, partner?._id]);

  if (!isOpen) return null;

  const presets = [
    { amount: 50, label: 'Chai / Coffee', icon: '☕' },
    { amount: 100, label: 'Coffee & Treat', icon: '🥐' },
    { amount: 250, label: 'Specialty Brew & Snack', icon: '✨' },
  ];

  const effectiveAmount = customAmount ? parseFloat(customAmount) : selectedPreset;

  const handleProceedToConfirm = (e) => {
    e.preventDefault();
    setError('');

    if (!effectiveAmount || isNaN(effectiveAmount) || effectiveAmount < 1) {
      setError('Please select or specify a valid gift amount of at least ₹1.');
      return;
    }
    if (effectiveAmount > 10000) {
      setError('Gift amount cannot exceed ₹10,000.');
      return;
    }
    if (!partner?._id) {
      setError('Recipient details could not be identified.');
      return;
    }
    if (currentUser?._id && partner?._id.toString() === currentUser._id.toString()) {
      setError('You cannot send a gift to yourself.');
      return;
    }

    setStep('confirm');
  };

  const handleConfirmTransaction = async () => {
    try {
      setLoading(true);
      setError('');

      const payload = {
        amount: effectiveAmount,
        message: message.trim(),
        note: message.trim(),
      };

      if (exchange?._id) {
        payload.exchangeId = exchange._id;
      }
      if (partner?._id) {
        payload.recipientId = partner._id;
      }

      if (paymentMode === 'razorpay') {
        // 1. Initialize Razorpay Order on backend
        const res = await giftService.createOrder({
          ...payload,
          isDemo: false,
        });

        if (!res.success || !res.data?.orderId) {
          throw new Error(res.message || 'Failed to initialize Razorpay Order.');
        }

        const orderData = res.data;

        // 2. Load Razorpay Checkout modal script
        const isLoaded = await loadRazorpayScript();

        if (isLoaded && window.Razorpay && orderData.keyId && !orderData.orderId.startsWith('order_test_mock')) {
          // Open interactive Razorpay checkout modal
          const options = {
            key: orderData.keyId,
            amount: orderData.amountInPaise || Math.round(effectiveAmount * 100),
            currency: orderData.currency || 'INR',
            name: 'SkillSwap',
            description: `Coffee Gift for ${partner?.name || 'Partner'}`,
            image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=128&q=80',
            order_id: orderData.orderId,
            prefill: {
              name: currentUser?.name || '',
              email: currentUser?.email || '',
            },
            notes: {
              platform: 'SkillSwap',
              type: 'coffee_gift',
              giftId: orderData.giftId,
              recipient: partner?.name || '',
            },
            theme: {
              color: '#f59e0b', // amber-500
            },
            handler: async (response) => {
              try {
                setLoading(true);
                const verifyRes = await giftService.verifyPayment({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  giftId: orderData.giftId,
                  orderId: orderData.orderId,
                });

                if (verifyRes.success && verifyRes.data) {
                  setTransactionReceipt(verifyRes.data);
                  setStep('receipt');
                  if (onSuccess) {
                    onSuccess(`Coffee gift of ₹${effectiveAmount} sent to ${partner?.name || 'partner'}!`);
                  }
                } else {
                  setError(verifyRes.message || 'Payment signature verification failed.');
                }
              } catch (vErr) {
                setError(vErr.response?.data?.message || vErr.message || 'Payment verification failed.');
              } finally {
                setLoading(false);
              }
            },
            modal: {
              ondismiss: async () => {
                setLoading(false);
                setError('Checkout modal was closed before completing payment.');
                try {
                  await giftService.cancelOrder({ orderId: orderData.orderId, giftId: orderData.giftId });
                } catch (_) {}
              },
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (errResponse) => {
            setError(errResponse.error?.description || 'Payment failed. Please try again.');
            setLoading(false);
          });
          rzp.open();
        } else {
          // Test Mode / Headless simulation fallback
          const verifyRes = await giftService.verifyPayment({
            giftId: orderData.giftId,
            orderId: orderData.orderId,
            razorpay_order_id: orderData.orderId,
            razorpay_payment_id: `pay_test_${Date.now()}`,
            razorpay_signature: 'test_signature_offline',
          });

          if (verifyRes.success && verifyRes.data) {
            setTransactionReceipt(verifyRes.data);
            setStep('receipt');
            if (onSuccess) {
              onSuccess(`Coffee gift of ₹${effectiveAmount} verified for ${partner?.name || 'partner'}!`);
            }
          } else {
            throw new Error('Test transaction verification failed.');
          }
        }
      } else {
        // Simulated demo mode
        const res = await giftService.sendGift(payload);

        if (res.success && res.data) {
          setTransactionReceipt(res.data);
          setStep('receipt');
          if (onSuccess) {
            onSuccess(
              `Coffee gift of ₹${effectiveAmount} sent to ${partner?.name || 'your partner'}!`
            );
          }
        } else {
          throw new Error(res.message || 'Failed to complete transaction.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to process gift payment.');
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTxnId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">
                Gift Coffee Money
              </h3>
              <p className="text-xs text-slate-400">
                Send a voluntary token of appreciation via Razorpay
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
            step === 'form' 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' 
              : 'text-slate-500 border-slate-800'
          }`}>
            <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">1</span>
            <span>Gift Details</span>
          </div>

          <span className="text-slate-600">→</span>

          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
            step === 'confirm' 
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' 
              : 'text-slate-500 border-slate-800'
          }`}>
            <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">2</span>
            <span>Review & Confirm</span>
          </div>

          <span className="text-slate-600">→</span>

          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
            step === 'receipt' 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' 
              : 'text-slate-500 border-slate-800'
          }`}>
            <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">3</span>
            <span>Receipt</span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ----------------- STEP 1: GIFT FORM ----------------- */}
        {step === 'form' && (
          <form onSubmit={handleProceedToConfirm} className="space-y-5">
            {/* Recipient Profile Card */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3.5">
              {partner?.profileImage ? (
                <img
                  src={partner.profileImage}
                  alt={partner.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-emerald-500/40 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-bold text-lg shrink-0">
                  {partner?.name?.charAt(0) || <User className="w-5 h-5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Sending Gift To
                </span>
                <p className="font-extrabold text-white text-sm sm:text-base truncate">
                  {partner?.name || 'Exchange Partner'}
                </p>
                {partner?.email && (
                  <p className="text-[11px] text-slate-500 truncate">{partner.email}</p>
                )}
              </div>
            </div>

            {/* Predefined Amounts */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Select Coffee Amount (INR)
              </label>
              <div className="grid grid-cols-3 gap-3">
                {presets.map((preset) => (
                  <button
                    type="button"
                    key={preset.amount}
                    onClick={() => {
                      setSelectedPreset(preset.amount);
                      setCustomAmount('');
                    }}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      selectedPreset === preset.amount && !customAmount
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-lg shadow-amber-500/20 scale-[1.02]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xl">{preset.icon}</div>
                    <div className="text-sm font-black mt-1">₹{preset.amount}</div>
                    <div className="text-[10px] opacity-80 leading-tight mt-0.5">{preset.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Or Specify Custom Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="any"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPreset(null);
                  }}
                  placeholder="e.g. 150"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMode('razorpay')}
                  className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                    paymentMode === 'razorpay'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 mt-0.5 shrink-0 ${paymentMode === 'razorpay' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Razorpay Checkout</div>
                    <div className="text-[10px] text-slate-400">UPI, Cards, NetBanking</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('demo')}
                  className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                    paymentMode === 'demo'
                      ? 'bg-amber-500/10 border-amber-500/40 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${paymentMode === 'demo' ? 'text-amber-400' : 'text-slate-500'}`} />
                  <div>
                    <div className="text-xs font-bold">Demo Token</div>
                    <div className="text-[10px] text-slate-400">Offline simulation</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Optional Personal Message */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Personal Message (Optional)</span>
                <span className="text-[10px] text-slate-500">{message.length}/500</span>
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your appreciation or thank-you note..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                <span>Continue to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* ----------------- STEP 2: CONFIRMATION SCREEN ----------------- */}
        {step === 'confirm' && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-white text-base">
                Review & Confirm Coffee Gift
              </h4>
              <p className="text-xs text-slate-400">
                Please verify recipient and amount details before completing payment.
              </p>
            </div>

            {/* Transaction Review Summary Card */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              {/* Recipient */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
                <span className="text-slate-400">Recipient Partner:</span>
                <div className="flex items-center gap-2 text-white font-bold">
                  {partner?.profileImage ? (
                    <img
                      src={partner.profileImage}
                      alt={partner.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                      {partner?.name?.charAt(0)}
                    </div>
                  )}
                  <span>{partner?.name}</span>
                </div>
              </div>

              {/* Amount */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
                <span className="text-slate-400">Gift Amount:</span>
                <span className="text-xl font-black text-amber-400">
                  ₹{effectiveAmount} <span className="text-xs font-semibold text-slate-400">INR</span>
                </span>
              </div>

              {/* Payment Gateway */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
                <span className="text-slate-400">Payment Gateway:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  paymentMode === 'razorpay'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {paymentMode === 'razorpay' ? 'Razorpay (Orders & Checkout)' : 'Simulated Demo Token'}
                </span>
              </div>

              {/* Message */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-400">Personal Note:</span>
                <p className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 italic">
                  {message.trim() ? `"${message.trim()}"` : <span className="text-slate-500">No message attached</span>}
                </p>
              </div>
            </div>

            {/* Payout & Marketplace Escrow Notice */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-slate-400 text-[11px] leading-relaxed">
              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong className="text-slate-200">Test Mode Payout Note:</strong> Gift payments are credited to the SkillSwap platform ledger on behalf of the recipient. Direct disbursement to the recipient's bank account in production uses Razorpay Route / Payouts.
              </span>
            </div>

            {paymentMode === 'razorpay' && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-300 text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  Razorpay Checkout will open securely in a modal with UPI, Cards, and NetBanking test options.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Edit</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmTransaction}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Razorpay...</span>
                  </>
                ) : paymentMode === 'razorpay' ? (
                  <>
                    <span>Proceed to Razorpay Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Confirm Demo Gift</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ----------------- STEP 3: TRANSACTION RECEIPT ----------------- */}
        {step === 'receipt' && transactionReceipt && (
          <div className="space-y-5 animate-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-white text-lg">
                Coffee Gift Sent Successfully!
              </h4>
              <p className="text-xs text-slate-400">
                A token of appreciation has been recorded for {partner?.name}.
              </p>
            </div>

            {/* Receipt Card */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                <span>Transaction Ref:</span>
                <button
                  onClick={() => handleCopyTxnId(transactionReceipt.transactionId)}
                  className="flex items-center gap-1.5 text-amber-400 hover:underline font-bold"
                >
                  <span>{transactionReceipt.transactionId}</span>
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Amount:</span>
                <span className="text-white font-bold text-sm">₹{transactionReceipt.amount}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold uppercase">{transactionReceipt.status}</span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Payment Mode:</span>
                <span className="text-slate-300 font-bold uppercase">
                  {transactionReceipt.paymentMethod || 'Razorpay'}
                </span>
              </div>

              {transactionReceipt.razorpayPaymentId && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Razorpay Payment ID:</span>
                  <span className="text-slate-300 text-[11px] truncate max-w-[200px]">
                    {transactionReceipt.razorpayPaymentId}
                  </span>
                </div>
              )}

              {transactionReceipt.payoutNote && (
                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-sans leading-tight">
                  <span className="text-slate-300 font-semibold">Ledger Note: </span>
                  {transactionReceipt.payoutNote}
                </div>
              )}

              {transactionReceipt.message && (
                <div className="pt-2 border-t border-slate-800 text-slate-300 italic font-sans">
                  "{transactionReceipt.message}"
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
              >
                Close Receipt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SendGiftModal;
