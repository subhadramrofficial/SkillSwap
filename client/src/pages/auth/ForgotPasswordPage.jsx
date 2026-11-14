import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../../services/authService';
import {
  ArrowLeftRight,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please provide your registered email address.');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.forgotPassword(cleanEmail);
      if (response.success) {
        setSubmitted(true);
      } else {
        setError(response.message || 'Unable to process your request. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to the server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-950">
      <div className="max-w-md w-full space-y-8 bg-slate-900/60 p-8 rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 items-center justify-center shadow-lg shadow-emerald-500/20 mb-2">
            <KeyRound className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Reset Password
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {submitted
              ? 'Password reset instructions have been dispatched.'
              : 'Enter your email address to receive a secure single-use password reset link.'}
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          /* Confirmation Screen */
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <div className="inline-flex w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Check Your Email</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                If an account with that email address exists in SkillSwap, we have dispatched a password reset link. Please check your inbox and spam folder.
              </p>
              <p className="text-[11px] text-slate-500">
                For security reasons, this link will expire in <span className="text-emerald-400 font-semibold">15 minutes</span>.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail('');
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                Send to another email address
              </button>

              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : (
          /* Request Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Send Password Reset Link
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
