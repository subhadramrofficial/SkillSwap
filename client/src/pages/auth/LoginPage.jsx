import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { 
  ArrowLeftRight, 
  LogIn, 
  AlertCircle, 
  Loader2, 
  Lock, 
  Mail,
  ShieldCheck
} from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from?.pathname || '/dashboard';

  React.useEffect(() => {
    const notice = sessionStorage.getItem('auth_revoked_notice');
    if (notice) {
      setError(notice);
      sessionStorage.removeItem('auth_revoked_notice');
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', formData);

      if (response.success && response.data) {
        login(response.data.user, response.data.token);
        const destination = response.data.user?.role === 'admin'
          ? '/admin/dashboard'
          : (from === '/admin' || from.startsWith('/admin/') ? '/dashboard' : from);
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
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
            Welcome Back
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Sign in to continue swapping skills and communicating with learning partners.
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
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
              <Link
                to="/forgot-password"
                className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <div className="flex justify-end pt-0.5">
              <Link
                to="/forgot-password"
                className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
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
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Links */}
        <div className="pt-2 flex flex-col items-center gap-3 text-xs text-slate-400">
          <div>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Create an account
            </Link>
          </div>

          <div className="border-t border-slate-800/80 w-full pt-3 text-center">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Portal Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
