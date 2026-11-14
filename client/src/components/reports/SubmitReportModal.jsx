import React, { useState } from 'react';
import { Flag, X, AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import reportService from '../../services/reportService';

const SubmitReportModal = ({ isOpen, onClose, targetUser, onSuccess }) => {
  const [reason, setReason] = useState('inappropriate_behavior');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !targetUser) return null;

  const reasonOptions = [
    { value: 'inappropriate_behavior', label: 'Inappropriate or unprofessional behavior' },
    { value: 'spam', label: 'Spam, unsolicited promotion, or scams' },
    { value: 'harassment', label: 'Harassment, intimidation, or offensive language' },
    { value: 'offensive_content', label: 'Offensive or harmful profile content' },
    { value: 'other', label: 'Other platform violations' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!details.trim()) {
      setError('Please provide a brief explanation of the incident.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await reportService.createReport({
        reportedUser: targetUser._id,
        reason,
        details,
      });

      if (onSuccess) {
        onSuccess('Your report has been submitted to the moderation team. Thank you for keeping SkillSwap safe.');
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit report.');
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
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">Report User</h3>
              <p className="text-xs text-slate-400">
                Reporting member: <span className="text-white font-semibold">{targetUser.name}</span>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Violation Reason Category
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500"
            >
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">
                Description of the Issue
              </label>
              <span className="text-slate-500 text-[11px]">{details.length}/1000</span>
            </div>
            <textarea
              rows={4}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please explain what happened, including any relevant dates or context..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none transition-all"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 text-[11px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Reports are confidential and reviewed by platform administrators within 24 hours.</span>
          </div>

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
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Filing Report...
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  Submit Moderation Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitReportModal;
