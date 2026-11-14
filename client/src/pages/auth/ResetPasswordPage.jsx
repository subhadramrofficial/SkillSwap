import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import authService from '../../services/authService';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  // Verification state
  const [verifying, setVerifying] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [verificationError, setVerificationError] = useState('');

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      if (!token) {
        if (isMounted) {
          setVerifying(false);
          setIsTokenValid(false);
          setVerificationError('No reset token provided. Please request a new reset link.');
        }
        return;
      }

      try {
        const response = await authService.verifyResetToken(token);
        if (isMounted) {
          if (response.success && response.data?.valid) {
            setIsTokenValid(true);
            if (response.data.email) {
              setUserEmail(response.data.email);
            }
          } else {
            setIsTokenValid(false);
            setVerificationError(
              response.message || 'This password reset link is invalid or has expired.'
            );
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsTokenValid(false);
          setVerificationError(
            err.message || 'This password reset link is invalid or has expired.'
          );
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (password.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.resetPassword(token, password);
      if (response.success) {
        setResetSuccess(true);
      } else {
        setFormError(response.message || 'Unable to reset password. Please try again.');
      }
    } catch (err) {
      setFormError(
        err.message || 'Failed to reset password. The link may have expired or already been used.'
      );
    } finally {
      setSubmitting(false);
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
            Create New Password
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {userEmail
              ? `Enter your new secure password for ${userEmail}.`
              : 'Choose a strong password to protect your SkillSwap account.'}
          </p>
        </div>

        {/* Verification Loading State */}
        {verifying && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs font-medium">Validating secure reset link...</p>
          </div>
        )}

        {/* Invalid or Expired Token State */}
        {!verifying && !isTokenValid && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
              <div className="inline-flex w-10 h-10 rounded-full bg-rose-500/20 items-center justify-center text-rose-400 mx-auto">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Reset Link Invalid or Expired</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {verificationError ||
                  'For security, password reset links are single-use only and automatically expire after 15 minutes.'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                to="/forgot-password"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20"
              >
                Request a New Link
              </Link>

              <Link
                to="/login"
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {!verifying && isTokenValid && resetSuccess && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
              <div className="inline-flex w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Password Reset Complete</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your password has been successfully updated. You can now sign in with your new credentials.
              </p>
            </div>

            <div className="pt-2">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99]"
              >
                Sign In With New Password
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Active Reset Form */}
        {!verifying && isTokenValid && !resetSuccess && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs sm:text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Match Helper */}
            {password && confirmPassword && (
              <div className="text-[11px] flex items-center gap-1.5">
                {password === confirmPassword ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match yet
                  </span>
                )}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Confirm Password Reset
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
