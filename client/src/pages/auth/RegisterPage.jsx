import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { 
  ArrowLeftRight, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2,
  Loader2, 
  Calendar, 
  Lock, 
  Mail, 
  User 
} from 'lucide-react';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    dateOfBirth: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Calculate live age for immediate feedback
  const calculateLiveAge = (dobString) => {
    if (!dobString) return null;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const calculatedAge = calculateLiveAge(formData.dateOfBirth);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: null });
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Client-side age validation check
    if (calculatedAge !== null && calculatedAge < 15) {
      setError('You must be older than 15 years to join SkillSwap.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', formData);

      if (response.success && response.data) {
        login(response.data.user, response.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information.');
      if (err.errors) {
        const errorMap = {};
        err.errors.forEach((e) => {
          errorMap[e.field] = e.message;
        });
        setFieldErrors(errorMap);
      }
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
            <ArrowLeftRight className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Join the SkillSwap Community
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Share what you know. Learn what you desire. 100% free peer learning.
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Alex Morgan"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            {fieldErrors.name && (
              <p className="text-[11px] text-rose-400">{fieldErrors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="alex@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            {fieldErrors.email && (
              <p className="text-[11px] text-rose-400">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                name="password"
                required
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            {fieldErrors.password && (
              <p className="text-[11px] text-rose-400">{fieldErrors.password}</p>
            )}
          </div>

          {/* Date of Birth & Live Age Check */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Date of Birth</label>
              {calculatedAge !== null && (
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    calculatedAge >= 15 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {calculatedAge >= 15 ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Age: {calculatedAge} (Eligible)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" /> Age: {calculatedAge} (Must be &gt; 15)
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="date"
                name="dateOfBirth"
                required
                value={formData.dateOfBirth}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            {fieldErrors.dateOfBirth && (
              <p className="text-[11px] text-rose-400">{fieldErrors.dateOfBirth}</p>
            )}
            <p className="text-[11px] text-slate-500">
              SkillSwap is safe and requires members to be at least 15 years old.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Free Account
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div className="text-center pt-2 text-xs text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
