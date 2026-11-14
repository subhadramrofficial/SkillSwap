import React, { useState } from 'react';
import { Star, X, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import reviewService from '../../services/reviewService';

const LeaveReviewModal = ({ isOpen, onClose, exchange, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !exchange) return null;

  // Determine partner
  const isRequester = exchange.requester?._id ? true : false;
  // Get partner object safely
  const partner = exchange.partner || (isRequester ? exchange.recipient : exchange.requester);

  const ratingDescriptions = {
    1: 'Needs significant improvement',
    2: 'Fair exchange, had some difficulties',
    3: 'Good experience, learned basics',
    4: 'Very helpful and collaborative partner',
    5: 'Exceptional mentor! Highly recommended',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Please choose a star rating between 1 and 5.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await reviewService.createReview({
        exchangeId: exchange._id,
        rating,
        comment,
      });

      if (onSuccess) {
        onSuccess('Your review has been submitted successfully! Thank you for supporting the community.');
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">Rate Your Exchange</h3>
              <p className="text-xs text-slate-400">
                Share constructive feedback for {partner?.name || 'your partner'}
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

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star selector */}
          <div className="text-center space-y-2 py-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Overall Experience
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((starVal) => {
                const isFilled = (hoverRating || rating) >= starVal;
                return (
                  <button
                    type="button"
                    key={starVal}
                    onMouseEnter={() => setHoverRating(starVal)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(starVal)}
                    className="p-1 focus:outline-none transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-700 hover:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-medium text-emerald-400 italic min-h-[18px]">
              {ratingDescriptions[hoverRating || rating]}
            </p>
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="review-comment" className="font-semibold text-slate-300">
                Feedback & Testimonial (Optional)
              </label>
              <span className="text-slate-500 text-[11px]">{comment.length}/500</span>
            </div>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you learn? How was their communication and teaching style?"
              className="w-full px-4 py-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition-all"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Submit Rating
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveReviewModal;
