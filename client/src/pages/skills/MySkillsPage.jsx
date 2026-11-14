import React, { useEffect, useState } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Plus, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Trash2,
  Sparkles
} from 'lucide-react';
import skillService from '../../services/skillService';
import SkillCard from '../../components/skills/SkillCard';
import SkillFormModal from '../../components/skills/SkillFormModal';

const MySkillsPage = () => {
  const [activeTab, setActiveTab] = useState('offered'); // 'offered' | 'wanted'
  const [offeredSkills, setOfferedSkills] = useState([]);
  const [wantedSkills, setWantedSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);

  // Delete confirmation
  const [deletingSkill, setDeletingSkill] = useState(null);

  const fetchMySkills = async () => {
    try {
      setLoading(true);
      setError('');
      const [skillsResult, catResult] = await Promise.allSettled([
        skillService.getMySkills(),
        skillService.getCategories(),
      ]);

      if (skillsResult.status === 'fulfilled' && skillsResult.value?.success && skillsResult.value.data) {
        setOfferedSkills(skillsResult.value.data.offered || []);
        setWantedSkills(skillsResult.value.data.wanted || []);
      } else if (skillsResult.status === 'rejected') {
        setError(skillsResult.reason?.message || 'Unable to load your skill listings.');
      }

      if (catResult.status === 'fulfilled' && catResult.value?.success && Array.isArray(catResult.value.data)) {
        setCategories(catResult.value.data);
      }
    } catch (err) {
      setError(err.message || 'Unable to load your skills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySkills();
  }, []);

  const handleOpenAddModal = () => {
    setEditingSkill(null);
    setIsModalOpen(true);
  };

  const handleEditSkill = (skill) => {
    setEditingSkill(skill);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSkill) return;

    try {
      await skillService.deleteSkill(deletingSkill._id);
      setNotification(`Removed "${deletingSkill.title}" from your listings.`);
      setDeletingSkill(null);
      fetchMySkills();
      setTimeout(() => setNotification(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete skill.');
      setDeletingSkill(null);
    }
  };

  const currentList = activeTab === 'offered' ? offeredSkills : wantedSkills;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Skill Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage skills you can teach and skills you want to learn to get matched with learning partners.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Add New Skill
        </button>
      </div>

      {/* Notification Alerts */}
      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('offered')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'offered'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Skills I Can Teach
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300">
            {offeredSkills.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('wanted')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'wanted'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Skills I Want to Learn
          <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300">
            {wantedSkills.length}
          </span>
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400">Loading your skill portfolio...</p>
        </div>
      ) : currentList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentList.map((skill) => (
            <SkillCard
              key={skill._id}
              skill={skill}
              isOwner={true}
              onEdit={handleEditSkill}
              onDelete={(sk) => setDeletingSkill(sk)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            {activeTab === 'offered' ? (
              <GraduationCap className="w-7 h-7 text-emerald-400" />
            ) : (
              <BookOpen className="w-7 h-7 text-sky-400" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">
              {activeTab === 'offered'
                ? 'No teaching skills listed yet'
                : 'No wanted skills on your wishlist'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              {activeTab === 'offered'
                ? 'List skills you are comfortable teaching (like programming languages, instruments, or design) to attract exchange partners.'
                : 'Add skills you are passionate to learn so other users can find you and offer help.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {activeTab === 'offered' ? 'Teaching Skill' : 'Wanted Skill'}
          </button>
        </div>
      )}

      {/* Add / Edit Skill Modal */}
      <SkillFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchMySkills}
        categories={categories}
        initialSkill={editingSkill}
        defaultType={activeTab}
      />

      {/* Delete Confirmation Modal */}
      {deletingSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Remove Skill Listing</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <strong className="text-white">"{deletingSkill.title}"</strong>? 
              This will remove it from discovery matches. Historical exchanges will not be affected.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDeletingSkill(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySkillsPage;
