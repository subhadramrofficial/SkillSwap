import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  BookOpen, 
  ArrowLeftRight, 
  Flag, 
  Coffee, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Loader2, 
  UserX, 
  UserCheck, 
  Eye, 
  ShieldAlert, 
  Filter,
  Calendar,
  Layers,
  Activity,
  GraduationCap,
  CreditCard
} from 'lucide-react';
import adminService from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';

const AdminDashboardPage = () => {
  const { user: currentAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const getActiveTab = () => {
    if (location.pathname.endsWith('/users')) return 'users';
    if (location.pathname.endsWith('/skills')) return 'skills';
    if (location.pathname.endsWith('/categories')) return 'categories';
    if (location.pathname.endsWith('/reports')) return 'reports';
    return searchParams.get('tab') || 'overview';
  };

  const activeTab = getActiveTab();

  const handleTabClick = (tabKey) => {
    if (tabKey === 'overview') {
      navigate('/admin/dashboard');
    } else {
      navigate(`/admin/${tabKey}`);
    }
  };

  // Global State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Overview Stats
  const [stats, setStats] = useState(null);

  // Users State
  const [users, setUsers] = useState([]);
  const [userPagination, setUserPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // Skills State
  const [skills, setSkills] = useState([]);
  const [skillsPagination, setSkillsPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [skillsCounts, setSkillsCounts] = useState({ total: 0, offered: 0, wanted: 0 });
  const [skillSearch, setSkillSearch] = useState('');
  const [skillCategoryFilter, setSkillCategoryFilter] = useState('');
  const [skillTypeFilter, setSkillTypeFilter] = useState('');
  const [skillStatusFilter, setSkillStatusFilter] = useState('');
  const [skillModal, setSkillModal] = useState({ open: false, data: null });
  const [skillEditTitle, setSkillEditTitle] = useState('');
  const [skillEditDesc, setSkillEditDesc] = useState('');
  const [skillEditCategory, setSkillEditCategory] = useState('');
  const [skillEditType, setSkillEditType] = useState('offered');
  const [skillEditLevel, setSkillEditLevel] = useState('intermediate');
  const [skillEditActive, setSkillEditActive] = useState(true);

  // Categories State
  const [categories, setCategories] = useState([]);
  const [categoryModal, setCategoryModal] = useState({ open: false, mode: 'create', data: null });
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState('BookOpen');

  // Reports State
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('pending');
  const [resolveModal, setResolveModal] = useState({ open: false, report: null });
  const [resolveStatus, setResolveStatus] = useState('resolved');
  const [moderatorNotes, setModeratorNotes] = useState('');
  const [deactivateUserCheck, setDeactivateUserCheck] = useState(false);

  const showFeedback = (msg) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 4000);
  };

  // Fetch Stats
  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await adminService.getStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      setError(err.message || 'Unable to load administrative stats.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Users
  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminService.getUsers({
        page,
        limit: 10,
        search: userSearch,
        role: userRoleFilter || undefined,
        status: userStatusFilter || undefined,
      });
      if (res.success && res.data) {
        setUsers(res.data.users);
        setUserPagination(res.data.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Skills
  const fetchSkills = async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminService.getSkills({
        page,
        limit: 10,
        search: skillSearch,
        category: skillCategoryFilter || undefined,
        listingType: skillTypeFilter || undefined,
        status: skillStatusFilter || undefined,
      });
      if (res.success && res.data) {
        setSkills(res.data.skills || []);
        setSkillsPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
        if (res.data.counts) {
          setSkillsCounts(res.data.counts);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load skills.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Categories
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await adminService.getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Reports
  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await adminService.getReports({
        status: reportFilter === 'all' ? undefined : reportFilter,
      });
      if (res.success && res.data) {
        setReports(res.data.reports);
      }
    } catch (err) {
      setError(err.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  };

  // Router effect on tab change
  useEffect(() => {
    setError('');
    if (activeTab === 'overview') fetchStats();
    if (activeTab === 'users') fetchUsers(1);
    if (activeTab === 'skills') {
      fetchSkills(1);
      if (categories.length === 0) fetchCategories();
    }
    if (activeTab === 'categories') fetchCategories();
    if (activeTab === 'reports') fetchReports();
  }, [activeTab, reportFilter, location.pathname]);

  // Open Edit Skill Modal
  const handleOpenEditSkill = (skill) => {
    setSkillEditTitle(skill.title || '');
    setSkillEditDesc(skill.description || '');
    setSkillEditCategory(skill.category?._id || skill.category || '');
    setSkillEditType(skill.listingType || 'offered');
    setSkillEditLevel(skill.experienceLevel || 'intermediate');
    setSkillEditActive(skill.isActive !== undefined ? skill.isActive : true);
    setSkillModal({ open: true, data: skill });
  };

  // Handle Edit Skill Submit
  const handleSkillSubmit = async (e) => {
    e.preventDefault();
    if (!skillModal.data) return;

    try {
      await adminService.updateSkill(skillModal.data._id, {
        title: skillEditTitle.trim(),
        description: skillEditDesc.trim(),
        category: skillEditCategory,
        listingType: skillEditType,
        experienceLevel: skillEditLevel,
        isActive: skillEditActive,
      });
      showFeedback(`Skill "${skillEditTitle}" updated successfully.`);
      setSkillModal({ open: false, data: null });
      fetchSkills(skillsPagination.page);
    } catch (err) {
      setError(err.message || 'Failed to update skill.');
    }
  };

  // Handle Skill Delete
  const handleDeleteSkill = async (skill) => {
    const ownerName = skill.owner?.name || 'user';
    if (!window.confirm(`Are you sure you want to permanently delete the skill "${skill.title}" by ${ownerName}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await adminService.deleteSkill(skill._id);
      showFeedback(res.message || `Skill "${skill.title}" permanently removed.`);
      fetchSkills(skillsPagination.page);
    } catch (err) {
      setError(err.message || 'Failed to delete skill.');
    }
  };

  // Handle User Status Toggle
  const handleToggleUserStatus = async (user) => {
    if (user._id === currentAdmin?._id) {
      setError('You cannot modify your own administrative account.');
      return;
    }
    const newStatus = !user.isActive;
    const confirmMsg = newStatus
      ? `Reactivate account for ${user.name}?`
      : `Deactivate ${user.name}? They will not be able to log in.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await adminService.updateUserStatus(user._id, { isActive: newStatus });
      showFeedback(`User ${user.name} has been ${newStatus ? 'reactivated' : 'deactivated'}.`);
      fetchUsers(userPagination.page);
    } catch (err) {
      setError(err.message || 'Failed to update user status.');
    }
  };

  // Handle Category Submit
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      if (categoryModal.mode === 'create') {
        await adminService.createCategory({
          name: catName.trim(),
          description: catDesc.trim(),
          icon: catIcon.trim() || 'BookOpen',
        });
        showFeedback(`Category "${catName}" created successfully.`);
      } else {
        await adminService.updateCategory(categoryModal.data._id, {
          name: catName.trim(),
          description: catDesc.trim(),
          icon: catIcon.trim() || 'BookOpen',
        });
        showFeedback(`Category "${catName}" updated.`);
      }
      setCategoryModal({ open: false, mode: 'create', data: null });
      fetchCategories();
    } catch (err) {
      setError(err.message || 'Failed to save category.');
    }
  };

  // Handle Category Delete / Deactivate
  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Delete or deactivate category "${cat.name}"?`)) return;
    try {
      const res = await adminService.deleteCategory(cat._id);
      showFeedback(res.message || 'Category removed.');
      fetchCategories();
    } catch (err) {
      setError(err.message || 'Failed to delete category.');
    }
  };

  // Handle Report Resolve
  const handleResolveReport = async (e) => {
    e.preventDefault();
    if (!resolveModal.report) return;

    try {
      await adminService.resolveReport(resolveModal.report._id, {
        status: resolveStatus,
        moderatorNotes,
        deactivateOffendingUser: deactivateUserCheck,
      });
      showFeedback(`Report marked as "${resolveStatus}".`);
      setResolveModal({ open: false, report: null });
      setModeratorNotes('');
      setDeactivateUserCheck(false);
      fetchReports();
    } catch (err) {
      setError(err.message || 'Failed to update report.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Administrator Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            SkillSwap Administration & Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Monitor platform metrics, moderate reported content, manage user accounts, and maintain skill categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Super Admin: {currentAdmin?.name}
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => handleTabClick('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'overview'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview & Metrics
        </button>

        <button
          onClick={() => handleTabClick('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'users'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          User Management
        </button>

        <button
          onClick={() => handleTabClick('skills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'skills'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Skill Management
          {stats?.skills?.total > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-bold">
              {stats.skills.total}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabClick('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'categories'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Skill Categories
        </button>

        <button
          onClick={() => handleTabClick('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === 'reports'
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Flag className="w-4 h-4" />
          Moderation Reports
          {stats?.reports?.pending > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
              {stats.reports.pending}
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW & PLATFORM METRICS */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {loading && !stats ? (
            <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading system metrics...</p>
            </div>
          ) : stats ? (
            <>
              {/* Primary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Users Metric */}
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Registered Members</span>
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white">{stats.users.total}</div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-bold">{stats.users.active} Active</span>
                    <span>•</span>
                    <span className="text-rose-400">{stats.users.deactivated} Suspended</span>
                  </div>
                </div>

                {/* Skills Metric */}
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Skill Listings</span>
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white">{stats.skills.total}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">{stats.skills.offered} Offered</span>
                      <span>•</span>
                      <span className="text-sky-400">{stats.skills.wanted} Wanted</span>
                    </div>
                    <button
                      onClick={() => handleTabClick('skills')}
                      className="text-rose-400 hover:underline font-semibold"
                    >
                      Manage &rarr;
                    </button>
                  </div>
                </div>

                {/* Exchanges Metric */}
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Skill Exchanges</span>
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <ArrowLeftRight className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white">{stats.exchanges.total}</div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-bold">{stats.exchanges.byStatus.completed} Done</span>
                    <span>•</span>
                    <span className="text-sky-400">{stats.exchanges.byStatus.active} Active</span>
                  </div>
                </div>

                {/* Pending Moderation Metric */}
                <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <span>Moderation Queue</span>
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                      <Flag className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white">{stats.reports.pending}</div>
                  <div className="text-[11px] text-slate-400">
                    {stats.reports.pending > 0 ? (
                      <span className="text-rose-400 font-bold">Requires moderator attention</span>
                    ) : (
                      <span className="text-emerald-400">Moderation queue clear</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Exchanges Status Breakdown & Demo Gifts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                    Exchanges Lifecycle Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-amber-400 font-semibold">Pending Approval</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {stats.exchanges.byStatus.pending}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-sky-400 font-semibold">Accepted / Ready</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {stats.exchanges.byStatus.accepted}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-emerald-400 font-semibold">In Progress (Active)</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {stats.exchanges.byStatus.active}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-emerald-500 font-semibold">Completed</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {stats.exchanges.byStatus.completed}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-rose-400 font-semibold">Declined</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {stats.exchanges.byStatus.rejected}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-semibold">Cancelled</div>
                      <div className="text-2xl font-black text-white mt-1">
                        {stats.exchanges.byStatus.cancelled}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Razorpay & Subscription Revenue Summary */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <CreditCard className="w-4 h-4" />
                      <span>Razorpay & Gift Revenue</span>
                    </div>
                    {stats?.subscriptions?.active > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {stats.subscriptions.active} Pro Member{stats.subscriptions.active === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  <div className="text-3xl font-black text-white">
                    ₹{stats.gifts.totalAmount || stats.gifts.totalUSD || stats.gifts.volumeDemoUSD || 0}{' '}
                    <span className="text-xs font-normal text-emerald-400">INR</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Razorpay Paid Gifts</span>
                      <span className="text-emerald-400 font-bold">₹{stats.gifts.razorpayAmount || stats.gifts.stripeUSD || 0}</span>
                      <span className="text-slate-500 text-[10px] block">({stats.gifts.razorpayCount || stats.gifts.stripeCount || 0} gifts)</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px]">Active Subscribers</span>
                      <span className="text-purple-400 font-bold">{stats.subscriptions?.active || 0}</span>
                      <span className="text-slate-500 text-[10px] block">
                        ({stats.subscriptions?.monthly || 0} mo, {stats.subscriptions?.yearly || 0} yr)
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    Razorpay Gateway Active: One-time coffee gifts & recurring pro subscriptions.
                  </div>
                </div>
              </div>

              {/* Recent Activity Streams */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Registrations */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                      Recent Member Registrations
                    </h3>
                    <button
                      onClick={() => setSearchParams({ tab: 'users' })}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      View all users &rarr;
                    </button>
                  </div>
                  <div className="space-y-3">
                    {stats.recent.users.map((u) => (
                      <div
                        key={u._id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/40 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs">
                            {u.name?.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{u.name}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pending Reports Quick Action */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                      Pending Moderation Queue
                    </h3>
                    <button
                      onClick={() => setSearchParams({ tab: 'reports' })}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Moderation dashboard &rarr;
                    </button>
                  </div>
                  <div className="space-y-3">
                    {stats.recent.pendingReports.length > 0 ? (
                      stats.recent.pendingReports.map((rep) => (
                        <div
                          key={rep._id}
                          className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-rose-300 capitalize">
                              Violation: {rep.reason.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(rep.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Reported Member:{' '}
                            <span className="font-semibold text-white">
                              {rep.reportedUser?.name}
                            </span>{' '}
                            (by {rep.reporter?.name})
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500">
                        No pending reports in the moderation queue.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: USER MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value);
                  setTimeout(() => fetchUsers(1), 50);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="deactivated">Deactivated Only</option>
              </select>

              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value);
                  setTimeout(() => fetchUsers(1), 50);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Administrators</option>
              </select>

              <button
                onClick={() => fetchUsers(1)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
              >
                Search
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Exchanges</th>
                  <th className="px-6 py-4">Subscription</th>
                  <th className="px-6 py-4">Ratings</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((u) => {
                  const isCurrent = u._id === currentAdmin?._id;

                  return (
                    <tr key={u._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center font-bold text-xs">
                            {u.name?.charAt(0)}
                          </div>
                          <div>
                            <Link
                              to={`/profile/${u._id}`}
                              className="font-bold text-white hover:text-emerald-400 transition-colors"
                            >
                              {u.name}
                            </Link>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {u.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            (u.completedExchangeCount || 0) >= 3 && u.subscription?.status !== 'active'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {u.subscription?.status === 'active'
                            ? `${u.completedExchangeCount || 0} (Unlimited)`
                            : `${u.completedExchangeCount || 0} / 3 Free`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.subscription?.status === 'active'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {u.subscription?.status === 'active'
                            ? `Pro (${u.subscription.plan})`
                            : 'Free Tier'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-amber-400">
                          {u.averageRating > 0 ? `${u.averageRating.toFixed(1)} ★ (${u.reviewCount})` : 'No reviews'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isCurrent ? (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                              u.isActive
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Self (Admin)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {userPagination.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Page {userPagination.page} of {userPagination.pages} ({userPagination.total} members)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={userPagination.page <= 1}
                  onClick={() => fetchUsers(userPagination.page - 1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={userPagination.page >= userPagination.pages}
                  onClick={() => fetchUsers(userPagination.page + 1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: SKILL MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'skills' && (
        <div className="space-y-6">
          {/* Header & KPI Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Skill Listings Management</h2>
              <p className="text-xs text-slate-400">
                Browse, search, edit, and moderate real skills registered by SkillSwap community members.
              </p>
            </div>

            {/* Quick KPI Counters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
                Total: <span className="text-white font-bold">{skillsCounts.total}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
                Offered (Teach): <span className="font-bold">{skillsCounts.offered}</span>
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs font-semibold text-sky-400">
                Wanted (Learn): <span className="font-bold">{skillsCounts.wanted}</span>
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSkills(1)}
                placeholder="Search skills by title or keyword..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Category Filter */}
              <select
                value={skillCategoryFilter}
                onChange={(e) => {
                  setSkillCategoryFilter(e.target.value);
                  setTimeout(() => fetchSkills(1), 50);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={skillTypeFilter}
                onChange={(e) => {
                  setSkillTypeFilter(e.target.value);
                  setTimeout(() => fetchSkills(1), 50);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">All Skill Types</option>
                <option value="offered">Can Teach (Offered)</option>
                <option value="wanted">Want to Learn (Wanted)</option>
              </select>

              {/* Status Filter */}
              <select
                value={skillStatusFilter}
                onChange={(e) => {
                  setSkillStatusFilter(e.target.value);
                  setTimeout(() => fetchSkills(1), 50);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                onClick={() => fetchSkills(1)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
              >
                Filter
              </button>

              {(skillSearch || skillCategoryFilter || skillTypeFilter || skillStatusFilter) && (
                <button
                  onClick={() => {
                    setSkillSearch('');
                    setSkillCategoryFilter('');
                    setSkillTypeFilter('');
                    setSkillStatusFilter('');
                    setTimeout(() => fetchSkills(1), 50);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Skills Table or Empty State */}
          {skills.length > 0 ? (
            <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 uppercase text-[10px] tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4">Skill Title</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Owner / Member</th>
                    <th className="px-6 py-4">Level</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date Added</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {skills.map((skill) => (
                    <tr key={skill._id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Skill Title & Description */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5 max-w-xs sm:max-w-sm">
                          <div className="font-bold text-white text-xs sm:text-sm">
                            {skill.title}
                          </div>
                          {skill.description ? (
                            <p className="text-[11px] text-slate-400 line-clamp-1">
                              {skill.description}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-600 italic">No description</p>
                          )}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-6 py-4">
                        {skill.listingType === 'offered' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <GraduationCap className="w-3 h-3" />
                            Can Teach
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <BookOpen className="w-3 h-3" />
                            Want to Learn
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-800 text-slate-200">
                          {skill.category?.name || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-4">
                        {skill.owner ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                              {skill.owner.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <Link
                                to={`/profile/${skill.owner._id}`}
                                className="font-semibold text-white hover:text-emerald-400 transition-colors block text-xs"
                              >
                                {skill.owner.name}
                              </Link>
                              <div className="text-[10px] text-slate-500">{skill.owner.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Unknown User</span>
                        )}
                      </td>

                      {/* Level */}
                      <td className="px-6 py-4">
                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {skill.experienceLevel || 'intermediate'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            skill.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {skill.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {skill.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Date Added */}
                      <td className="px-6 py-4 text-slate-400 text-[11px]">
                        {skill.createdAt ? new Date(skill.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditSkill(skill)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit Skill"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSkill(skill)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete Skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-3">
              <BookOpen className="w-10 h-10 mx-auto text-slate-600" />
              <div className="text-white font-bold text-sm">No skill listings found</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {skillSearch || skillCategoryFilter || skillTypeFilter || skillStatusFilter
                  ? 'No skills match your current search and filter criteria. Try resetting filters.'
                  : 'No skills have been registered by members in the system yet.'}
              </p>
              {(skillSearch || skillCategoryFilter || skillTypeFilter || skillStatusFilter) && (
                <button
                  onClick={() => {
                    setSkillSearch('');
                    setSkillCategoryFilter('');
                    setSkillTypeFilter('');
                    setSkillStatusFilter('');
                    setTimeout(() => fetchSkills(1), 50);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {skillsPagination.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                Page {skillsPagination.page} of {skillsPagination.pages} ({skillsPagination.total} skill listings)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={skillsPagination.page <= 1}
                  onClick={() => fetchSkills(skillsPagination.page - 1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={skillsPagination.page >= skillsPagination.pages}
                  onClick={() => fetchSkills(skillsPagination.page + 1)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Edit Skill Modal */}
          {skillModal.open && skillModal.data && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-white text-base">Edit Skill Listing</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Owner: <span className="text-white font-medium">{skillModal.data.owner?.name || 'Member'}</span> ({skillModal.data.owner?.email || 'N/A'})
                    </p>
                  </div>
                  <button
                    onClick={() => setSkillModal({ open: false, data: null })}
                    className="text-slate-400 hover:text-white text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSkillSubmit} className="space-y-4">
                  {/* Skill Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Skill Title *</label>
                    <input
                      type="text"
                      required
                      value={skillEditTitle}
                      onChange={(e) => setSkillEditTitle(e.target.value)}
                      placeholder="e.g. React.js Frontend Development"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  {/* Category & Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Category *</label>
                      <select
                        required
                        value={skillEditCategory}
                        onChange={(e) => setSkillEditCategory(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Skill Type *</label>
                      <select
                        required
                        value={skillEditType}
                        onChange={(e) => setSkillEditType(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                      >
                        <option value="offered">Can Teach (Offered)</option>
                        <option value="wanted">Want to Learn (Wanted)</option>
                      </select>
                    </div>
                  </div>

                  {/* Level & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Experience Level</label>
                      <select
                        value={skillEditLevel}
                        onChange={(e) => setSkillEditLevel(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 capitalize"
                      >
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Status</label>
                      <div className="pt-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={skillEditActive}
                            onChange={(e) => setSkillEditActive(e.target.checked)}
                            className="rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-rose-500"
                          />
                          <span>Active Listing (Visible to members)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Description</label>
                    <textarea
                      rows={3}
                      value={skillEditDesc}
                      onChange={(e) => setSkillEditDesc(e.target.value)}
                      placeholder="Detailed overview of skill expertise or learning goals..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSkillModal({ open: false, data: null })}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CATEGORY MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Skill Categories Directory</h2>
              <p className="text-xs text-slate-400">
                Standard categories available for members to classify offered and wanted skills.
              </p>
            </div>
            <button
              onClick={() => {
                setCatName('');
                setCatDesc('');
                setCatIcon('BookOpen');
                setCategoryModal({ open: true, mode: 'create', data: null });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow-md shadow-rose-600/20"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat._id}
                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-slate-700 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm">{cat.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          cat.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">slug: {cat.slug}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setCatName(cat.name);
                        setCatDesc(cat.description || '');
                        setCatIcon(cat.icon || 'BookOpen');
                        setCategoryModal({ open: true, mode: 'edit', data: cat });
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Edit Category"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete / Deactivate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                  {cat.description || 'No description provided.'}
                </p>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-emerald-400">
                    {cat.listingsCount || 0} active skills
                  </span>
                  <span className="text-slate-500">icon: {cat.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Category Create/Edit Modal */}
          {categoryModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                <h3 className="font-bold text-white text-base">
                  {categoryModal.mode === 'create' ? 'Add New Skill Category' : 'Edit Skill Category'}
                </h3>

                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Category Name</label>
                    <input
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g. Design & Creative Arts"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Description</label>
                    <textarea
                      rows={3}
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      placeholder="Brief overview of skills in this category..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Icon Identifier</label>
                    <input
                      type="text"
                      value={catIcon}
                      onChange={(e) => setCatIcon(e.target.value)}
                      placeholder="e.g. BookOpen, Code, Palette, Music"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCategoryModal({ open: false, mode: 'create', data: null })}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                    >
                      Save Category
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: MODERATION REPORTS */}
      {/* ======================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            {['pending', 'under_review', 'resolved', 'dismissed', 'all'].map((st) => (
              <button
                key={st}
                onClick={() => setReportFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  reportFilter === st
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Reports Table/Cards */}
          {reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map((rep) => (
                <div
                  key={rep._id}
                  className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm capitalize">
                          {rep.reason.replace('_', ' ')}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            rep.status === 'pending'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : rep.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Reporter: {rep.reporter?.name} ({rep.reporter?.email})</span>
                        <span>•</span>
                        <span className="text-rose-400 font-semibold">
                          Reported: {rep.reportedUser?.name} ({rep.reportedUser?.email})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setResolveModal({ open: true, report: rep });
                        setResolveStatus(rep.status === 'pending' ? 'resolved' : rep.status);
                        setModeratorNotes(rep.moderatorNotes || '');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-slate-200 hover:text-rose-400 border border-slate-700 text-xs font-semibold transition-colors"
                    >
                      Review & Resolve
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                    "{rep.details || 'No details entered by reporter.'}"
                  </p>

                  {rep.moderatorNotes && (
                    <div className="text-[11px] text-emerald-400 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
                      <span className="font-bold">Moderator Notes: </span>
                      {rep.moderatorNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500">
              No reports matching the "{reportFilter}" status filter.
            </div>
          )}

          {/* Resolve Report Modal */}
          {resolveModal.open && resolveModal.report && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
                <h3 className="font-bold text-white text-base">
                  Moderation Action: {resolveModal.report.reportedUser?.name}
                </h3>

                <form onSubmit={handleResolveReport} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Update Report Status</label>
                    <select
                      value={resolveStatus}
                      onChange={(e) => setResolveStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="under_review">Under Review</option>
                      <option value="resolved">Resolved (Violation Addressed)</option>
                      <option value="dismissed">Dismissed (No Action Required)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Moderator Audit Notes</label>
                    <textarea
                      rows={3}
                      required
                      value={moderatorNotes}
                      onChange={(e) => setModeratorNotes(e.target.value)}
                      placeholder="Explain findings and corrective actions taken..."
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                    />
                  </div>

                  {/* Deactivate User Checkbox */}
                  <label className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deactivateUserCheck}
                      onChange={(e) => setDeactivateUserCheck(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold">
                      Immediately deactivate reported user account ({resolveModal.report.reportedUser?.name})
                    </span>
                  </label>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setResolveModal({ open: false, report: null })}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                    >
                      Submit Resolution
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
