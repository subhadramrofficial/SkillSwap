import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  GraduationCap, 
  BookOpen, 
  Clock, 
  Star, 
  User, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Calendar,
  Sparkles,
  Share2
} from 'lucide-react';
import skillService from '../../services/skillService';

const SkillDetailsPage = () => {
  const { id } = useParams();
  const [skill, setSkill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSkill = async () => {
      try {
        setLoading(true);
        const res = await skillService.getSkillById(id);
        if (res.success && res.data) {
          setSkill(res.data);
        }
      } catch (err) {
        setError(err.message || 'Unable to load skill details.');
      } finally {
        setLoading(false);
      }
    };

    fetchSkill();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs text-slate-400">Loading skill details...</p>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <h2 className="text-xl font-bold text-white">Skill Not Found</h2>
        <p className="text-xs text-slate-400">{error || 'This listing might have been removed or inactive.'}</p>
        <Link to="/skills" className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 text-slate-200">
          Back to Skills Directory
        </Link>
      </div>
    );
  }

  const isOffered = skill.listingType === 'offered';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/skills"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Directory
        </Link>
      </div>

      {/* Main Skill Card */}
      <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-8">
        {/* Header Tags */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isOffered
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              }`}
            >
              {isOffered ? (
                <>
                  <GraduationCap className="w-4 h-4" /> Skill Offered (Can Teach)
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" /> Skill Wanted (Looking to Learn)
                </>
              )}
            </span>

            <span className="text-xs font-medium text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700/60">
              {skill.category?.name}
            </span>

            <span className="capitalize text-xs font-medium text-slate-300 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/60">
              {skill.experienceLevel} level
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {skill.title}
          </h1>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Listed on {new Date(skill.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Description */}
        <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            About this Skill Listing
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {skill.description || 'No detailed description provided by the member.'}
          </p>
        </div>

        {/* Member Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-center sm:text-left">
            {skill.owner?.profileImage ? (
              <img
                src={skill.owner.profileImage}
                alt={skill.owner.name}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold text-2xl border border-emerald-500/30">
                {skill.owner?.name?.charAt(0) || <User className="w-6 h-6" />}
              </div>
            )}
            <div className="space-y-1">
              <Link
                to={`/profile/${skill.owner?._id}`}
                className="font-bold text-lg text-white hover:text-emerald-400 transition-colors"
              >
                {skill.owner?.name}
              </Link>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
                {skill.owner?.averageRating > 0 && (
                  <span className="flex items-center gap-1 text-amber-400 font-semibold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {skill.owner.averageRating.toFixed(1)} ({skill.owner.reviewCount} reviews)
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="capitalize">{skill.owner?.availability || 'Flexible'} schedule</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Link
              to={`/find-partners`}
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
            >
              Connect & Propose Exchange
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillDetailsPage;
