import React from 'react';
import { Link } from 'react-router-dom';
import { 
  GraduationCap, 
  BookOpen, 
  Star, 
  Clock, 
  ArrowRight, 
  Edit, 
  Trash2,
  Sparkles,
  User
} from 'lucide-react';

const SkillCard = ({ 
  skill, 
  isOwner = false, 
  onEdit = null, 
  onDelete = null,
  onRequestExchange = null 
}) => {
  const isOffered = skill.listingType === 'offered';

  return (
    <div className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-black/40 group">
      <div className="space-y-3">
        {/* Header: Type Pill & Category */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isOffered
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
            }`}
          >
            {isOffered ? (
              <>
                <GraduationCap className="w-3.5 h-3.5" /> Can Teach
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" /> Wants to Learn
              </>
            )}
          </span>

          <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md truncate max-w-[130px]">
            {skill.category?.name || 'General'}
          </span>
        </div>

        {/* Title */}
        <Link
          to={`/skills/${skill._id}`}
          className="block font-bold text-lg text-white group-hover:text-emerald-400 transition-colors line-clamp-1"
        >
          {skill.title}
        </Link>

        {/* Experience Level & Availability */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="capitalize px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 font-medium">
            {skill.experienceLevel} level
          </span>
          {skill.owner?.availability && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 text-slate-500" />
              {skill.owner.availability}
            </span>
          )}
        </div>

        {/* Description */}
        {skill.description ? (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
            {skill.description}
          </p>
        ) : (
          <p className="text-xs text-slate-600 italic">No description provided.</p>
        )}
      </div>

      {/* Footer: Owner or Controls */}
      <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {isOwner ? (
          <div className="flex items-center justify-end gap-2 w-full">
            {onEdit && (
              <button
                onClick={() => onEdit(skill)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
                title="Edit skill"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(skill)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
                title="Delete skill"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Owner Info */}
            <Link
              to={`/profile/${skill.owner?._id}`}
              className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
            >
              {skill.owner?.profileImage ? (
                <img
                  src={skill.owner.profileImage}
                  alt={skill.owner.name}
                  className="w-6 h-6 rounded-full object-cover border border-slate-700"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] border border-emerald-500/30">
                  {skill.owner?.name?.charAt(0) || <User className="w-3 h-3" />}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium line-clamp-1">{skill.owner?.name}</span>
                {skill.owner?.averageRating > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    {skill.owner.averageRating.toFixed(1)}
                  </span>
                )}
              </div>
            </Link>

            {/* Action CTA */}
            {onRequestExchange ? (
              <button
                onClick={() => onRequestExchange(skill)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold text-xs border border-emerald-500/20 transition-all"
              >
                <span>Exchange</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <Link
                to={`/skills/${skill._id}`}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SkillCard;
