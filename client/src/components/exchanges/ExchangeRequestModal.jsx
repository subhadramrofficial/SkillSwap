import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  X, 
  ArrowLeftRight, 
  GraduationCap, 
  BookOpen, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  PlusCircle,
  Clock,
  CreditCard
} from 'lucide-react';
import exchangeService from '../../services/exchangeService';
import skillService from '../../services/skillService';

const ExchangeRequestModal = ({
  isOpen,
  onClose,
  onSuccess,
  partner,
  defaultRequestedSkill = null,
}) => {
  const [myOfferedSkills, setMyOfferedSkills] = useState([]);
  const [partnerOfferedSkills, setPartnerOfferedSkills] = useState([]);
  const [activePartnerExchanges, setActivePartnerExchanges] = useState([]);
  const [selectedOfferedSkill, setSelectedOfferedSkill] = useState('');
  const [selectedRequestedSkill, setSelectedRequestedSkill] = useState('');
  const [message, setMessage] = useState('');
  const [usage, setUsage] = useState(null);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const partnerId = partner?._id || partner?.user?._id || (typeof partner === 'string' ? partner : null);
  const partnerName = partner?.name || partner?.user?.name || 'Learning Partner';

  useEffect(() => {
    if (isOpen) {
      setError('');
      setMessage('');
      fetchSkills();
    }
  }, [isOpen, partnerId, defaultRequestedSkill?._id]);

  const fetchSkills = async () => {
    try {
      setLoadingSkills(true);
      setError('');

      // 1. Fetch current user's teaching skills
      const myRes = await skillService.getMySkills();
      const myOffered = myRes.data?.offered || [];
      setMyOfferedSkills(myOffered);
      if (myOffered.length > 0) {
        setSelectedOfferedSkill(myOffered[0]._id);
      }

      // 2. Fetch exchange usage and free limit status
      try {
        const uRes = await exchangeService.getUsage();
        if (uRes.success && uRes.data) {
          setUsage(uRes.data);
        }
      } catch (uErr) {
        console.warn('Failed to load exchange usage:', uErr.message);
      }

      // 3. Fetch existing exchanges to distinguish active/pending vs completed
      let existingInFlightExchanges = [];
      try {
        const exRes = await exchangeService.getExchanges();
        if (exRes.success && exRes.data) {
          existingInFlightExchanges = exRes.data.filter((ex) => {
            const isPartner =
              ex.requester?._id?.toString() === partnerId?.toString() ||
              ex.recipient?._id?.toString() === partnerId?.toString();
            return isPartner && ['pending', 'accepted', 'active'].includes(ex.status);
          });
          setActivePartnerExchanges(existingInFlightExchanges);
        }
      } catch (e) {
        console.warn('Failed to load active exchanges:', e.message);
      }

      // 4. Fetch partner's teaching skills
      let partnerSkills = [];

      // Check if partner already has allOffered in props
      if (partner?.allOffered && partner.allOffered.length > 0) {
        partnerSkills = [...partner.allOffered];
      } else if (partnerId) {
        // Fetch dynamically from backend
        try {
          const pRes = await skillService.getUserSkills(partnerId);
          if (pRes.success && pRes.data?.offered) {
            partnerSkills = pRes.data.offered;
          }
        } catch (pErr) {
          console.warn('Failed to fetch user skills via getUserSkills:', pErr.message);
          // Fallback to getSkills query with owner filter
          const fallbackRes = await skillService.getSkills({
            owner: partnerId,
            listingType: 'offered',
            limit: 50,
          });
          if (fallbackRes.success && fallbackRes.data) {
            partnerSkills = fallbackRes.data;
          }
        }
      }

      // If defaultRequestedSkill is supplied and not in partnerSkills, prepend it
      if (defaultRequestedSkill && defaultRequestedSkill._id) {
        const exists = partnerSkills.some((s) => s._id?.toString() === defaultRequestedSkill._id.toString());
        if (!exists) {
          partnerSkills = [defaultRequestedSkill, ...partnerSkills];
        }
      }

      setPartnerOfferedSkills(partnerSkills);

      // Select initial requested skill
      if (defaultRequestedSkill && defaultRequestedSkill._id) {
        setSelectedRequestedSkill(defaultRequestedSkill._id);
      } else if (partnerSkills.length > 0) {
        setSelectedRequestedSkill(partnerSkills[0]._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load available skills for exchange.');
    } finally {
      setLoadingSkills(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (usage && !usage.canInitiateExchange) {
      setError('You have completed your 3 free skill exchanges. A subscription is required before proposing new exchanges.');
      return;
    }

    if (!selectedOfferedSkill) {
      setError('Please select a skill you can offer in return.');
      return;
    }

    if (!selectedRequestedSkill) {
      setError('Please select the skill you wish to learn.');
      return;
    }

    if (!partnerId) {
      setError('Partner details could not be identified.');
      return;
    }

    // Check if the exact skill combination is currently pending or active
    const isAlreadyInFlight = activePartnerExchanges.some((ex) => {
      const offeredMatches =
        ex.offeredSkill?._id?.toString() === selectedOfferedSkill.toString() ||
        ex.requestedSkill?._id?.toString() === selectedOfferedSkill.toString();
      const requestedMatches =
        ex.requestedSkill?._id?.toString() === selectedRequestedSkill.toString() ||
        ex.offeredSkill?._id?.toString() === selectedRequestedSkill.toString();
      return offeredMatches && requestedMatches;
    });

    if (isAlreadyInFlight) {
      setError('An exchange proposal for this exact skill combination is already pending or in progress with this partner. Please choose different skills.');
      return;
    }

    setSubmitting(true);

    try {
      await exchangeService.createExchange({
        recipient: partnerId,
        offeredSkill: selectedOfferedSkill,
        requestedSkill: selectedRequestedSkill,
        message: message.trim(),
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const errRes = err.response?.data;
      if (errRes?.errors?.code === 'SUBSCRIPTION_REQUIRED' || errRes?.message?.includes('free limit') || err.response?.status === 403) {
        setError(errRes?.message || 'You have reached your free limit of 3 completed exchanges. A subscription is required to initiate new exchanges.');
        if (errRes?.errors) {
          setUsage((prev) => ({ ...(prev || {}), ...errRes.errors, canInitiateExchange: false, hasReachedLimit: true }));
        }
      } else {
        setError(errRes?.message || err.message || 'Failed to send exchange request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Propose Skill Exchange</h3>
              <p className="text-xs text-slate-400">Collaborate with {partnerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Subscription Required Notice */}
        {usage && !usage.canInitiateExchange && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <CreditCard className="w-4 h-4" />
              <span>Subscription Required to Propose Exchanges</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You have completed {usage.completedExchanges} of {usage.freeLimit} free skill exchanges. A subscription is required before proposing any new skill exchanges. Existing active and pending exchanges continue normally.
            </p>
            <div className="pt-1">
              <Link
                to="/subscription"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                View Subscription Plans &rarr;
              </Link>
            </div>
          </div>
        )}

        {loadingSkills ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <p className="text-xs">Loading skills for this exchange proposal...</p>
          </div>
        ) : myOfferedSkills.length === 0 ? (
          /* Notice when current user has no offered skills listed */
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="font-bold text-sm text-white">You haven't listed any teaching skills</h4>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              SkillSwap is a mutual exchange community. To propose an exchange, you need to list at least one skill you can teach in return.
            </p>
            <div className="pt-2">
              <Link
                to="/my-skills"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Add Skill I Can Teach
              </Link>
            </div>
          </div>
        ) : partnerOfferedSkills.length === 0 ? (
          /* Notice when partner has no active offered skills listed */
          <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="font-bold text-sm text-white">{partnerName} has no teaching skills listed</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              This partner currently does not have any active offered skills in their profile. Once they add a skill they can teach, you can propose an exchange.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* The Skill You Want to Learn */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                  Skill You Want to Learn (from {partnerName})
                </span>
                <span className="text-[10px] text-slate-500">
                  {partnerOfferedSkills.length} available
                </span>
              </label>
              <select
                value={selectedRequestedSkill}
                onChange={(e) => setSelectedRequestedSkill(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                {partnerOfferedSkills.map((sk) => {
                  const isInActiveSwap = activePartnerExchanges.some(
                    (ex) =>
                      ex.requestedSkill?._id?.toString() === sk._id?.toString() ||
                      ex.offeredSkill?._id?.toString() === sk._id?.toString()
                  );
                  return (
                    <option key={sk._id} value={sk._id}>
                      {sk.title} ({sk.experienceLevel || 'intermediate'} level)
                      {isInActiveSwap ? ' [In Active Exchange]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* The Skill You Will Offer in Return */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                  Skill You Can Teach in Return
                </span>
                <span className="text-[10px] text-slate-500">
                  {myOfferedSkills.length} available
                </span>
              </label>
              <select
                value={selectedOfferedSkill}
                onChange={(e) => setSelectedOfferedSkill(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                {myOfferedSkills.map((sk) => {
                  const isInActiveSwap = activePartnerExchanges.some(
                    (ex) =>
                      ex.offeredSkill?._id?.toString() === sk._id?.toString() ||
                      ex.requestedSkill?._id?.toString() === sk._id?.toString()
                  );
                  return (
                    <option key={sk._id} value={sk._id}>
                      {sk.title} ({sk.experienceLevel || 'intermediate'} level)
                      {isInActiveSwap ? ' [In Active Exchange]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* In-flight exchange notice if applicable */}
            {activePartnerExchanges.length > 0 && (
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  You have {activePartnerExchanges.length} active or pending exchange with {partnerName}. You can exchange different skills!
                </span>
              </div>
            )}

            {/* Learning Goal or Introductory Message */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Message & Learning Goals (Optional)
                </label>
                <span className="text-[11px] text-slate-500">{message.length}/500</span>
              </div>
              <textarea
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself and describe what you'd like to achieve together..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || (usage && !usage.canInitiateExchange)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    Send Proposal
                  </>
                )}
              </button>
            </div>
            {usage && !usage.canInitiateExchange && (
              <p className="text-[11px] text-amber-400 text-right font-medium">
                Free exchange limit reached. Subscription required to propose new exchanges.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default ExchangeRequestModal;
