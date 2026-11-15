import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Star, 
  Coffee, 
  Calendar,
  Sparkles,
  User,
  GraduationCap,
  BookOpen,
  Flag
} from 'lucide-react';

const ExchangeCard = ({
  exchange,
  currentUserId,
  onAccept = null,
  onReject = null,
  onCancel = null,
  onActivate = null,
  onComplete = null,
  onLeaveReview = null,
  onSendGift = null,
  onReport = null,
}) => {
  const isRequester = exchange.requester?._id?.toString() === currentUserId?.toString();
  const partner = isRequester ? exchange.recipient : exchange.requester;

  // Distinguish what I teach vs what they teach based on who requested
  const whatITeach = isRequester ? exchange.offeredSkill : exchange.requestedSkill;
  const whatTheyTeach = isRequester ? exchange.requestedSkill : exchange.offeredSkill;

  // Status badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending Request
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Sparkles className="w-3 h-3" /> Accepted (Ready)
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950">
            <CheckCircle2 className="w-3 h-3 fill-slate-950" /> Completed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 backdrop-blur-xl shadow-xl transition-all space-y-5">
      {/* Header: Partner Info & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {partner?.profileImage ? (
            <img
              src={partner.profileImage}
              alt={partner.name}
              className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-lg">
              {partner?.name?.charAt(0) || <User className="w-5 h-5" />}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${partner?._id}`}
                className="font-bold text-white hover:text-emerald-400 transition-colors"
              >
                {partner?.name}
              </Link>
              <span className="text-[11px] text-slate-500">
                ({isRequester ? 'Outgoing Proposal' : 'Incoming Request'})
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              {partner?.averageRating > 0 && (
                <span className="flex items-center gap-0.5 text-amber-400 font-semibold text-[11px]">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {partner.averageRating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px]">
                <Calendar className="w-3 h-3 text-slate-500" />
                {new Date(exchange.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(exchange.status)}
          {onReport && (
            <button
              type="button"
              onClick={() => onReport(partner)}
              title="Report inappropriate conduct"
              className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Skills Being Exchanged Visual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* You Teach */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5" />
            You Teach
          </span>
          <p className="font-extrabold text-white text-sm">
            {whatITeach?.title || 'Selected Skill'}
          </p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
            {whatITeach?.experienceLevel || 'Skill'} Level
          </span>
        </div>

        {/* They Teach */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            They Teach (You Learn)
          </span>
          <p className="font-extrabold text-white text-sm">
            {whatTheyTeach?.title || 'Requested Skill'}
          </p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 capitalize">
            {whatTheyTeach?.experienceLevel || 'Skill'} Level
          </span>
        </div>
      </div>

      {/* Goal Message */}
      {exchange.message && (
        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300 italic">
          "{exchange.message}"
        </div>
      )}

      {/* Actions Toolbar */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
        {/* Chat Button (Allowed for accepted, active, and completed) */}
        {['accepted', 'active', 'completed'].includes(exchange.status) ? (
          <Link
            to={`/messages?exchange=${exchange._id}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open Chat</span>
          </Link>
        ) : (
          <div></div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Pending State Controls */}
          {exchange.status === 'pending' && (
            <>
              {!isRequester ? (
                <>
                  <button
                    onClick={() => onReject && onReject(exchange._id)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => onAccept && onAccept(exchange._id)}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accept Proposal
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onCancel && onCancel(exchange._id)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                  Cancel Proposal
                </button>
              )}
            </>
          )}

          {/* Accepted State Controls */}
          {exchange.status === 'accepted' && (
            <button
              onClick={() => onActivate && onActivate(exchange._id)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Activate Learning Session
            </button>
          )}

          {/* Active State Controls */}
          {exchange.status === 'active' && (
            <button
              onClick={() => onComplete && onComplete(exchange._id)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Completed
            </button>
          )}

          {/* Completed State Controls */}
          {exchange.status === 'completed' && (
            <>
              {onLeaveReview && (
                <button
                  onClick={() => onLeaveReview(exchange)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                >
                  <Star className="w-3.5 h-3.5" />
                  Leave Review
                </button>
              )}
              {onSendGift && (
                <button
                  onClick={() => onSendGift(exchange)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-400" />
                  Send a Coffee
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExchangeCard;
