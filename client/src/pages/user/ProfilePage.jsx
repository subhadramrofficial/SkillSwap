import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import reviewService from '../../services/reviewService';
import skillService from '../../services/skillService';
import SubmitReportModal from '../../components/reports/SubmitReportModal';
import { 
  User, 
  Calendar, 
  Clock, 
  Star, 
  Edit, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  Flag,
  MessageSquare,
  GraduationCap
} from 'lucide-react';

const ProfilePage = () => {
  const { id } = useParams();
  const { user: currentUser } = useAuth();

  const isOwnProfile = !id || id === currentUser?._id;

  const [profile, setProfile] = useState(isOwnProfile ? currentUser : null);
  const [teachingSkills, setTeachingSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(!isOwnProfile);
  const [error, setError] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        let targetUser = currentUser;
        if (!isOwnProfile && id) {
          const res = await api.get(`/users/profile/${id}`);
          if (res.success && res.data) {
            targetUser = res.data;
            setProfile(targetUser);
            if (res.data.teachingSkills) {
              setTeachingSkills(res.data.teachingSkills);
            }
          }
        } else if (isOwnProfile) {
          setProfile(currentUser);
        }

        const targetId = targetUser?._id || id;

        // Fetch teaching skills if viewing own profile or if not returned by profile API
        if (targetId) {
          try {
            setSkillsLoading(true);
            if (isOwnProfile) {
              const sRes = await skillService.getMySkills();
              if (sRes.success && sRes.data) {
                setTeachingSkills(sRes.data.offered || []);
              }
            } else if (!targetUser?.teachingSkills) {
              const sRes = await skillService.getUserSkills(targetId);
              if (sRes.success && sRes.data) {
                setTeachingSkills(sRes.data.offered || []);
              }
            }
          } catch (skillErr) {
            console.warn('[Profile Skills Fetch Error]', skillErr.message);
          } finally {
            setSkillsLoading(false);
          }
        }

        // Fetch user reviews
        if (targetId) {
          const revRes = await reviewService.getUserReviews(targetId);
          if (revRes.success && revRes.data) {
            setReviews(revRes.data);
          }
        }
      } catch (err) {
        setError(err.message || 'Unable to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [id, isOwnProfile, currentUser]);

  if (loading) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading user profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <h2 className="text-xl font-bold text-white">Profile Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-sm">{error || 'This user does not exist or has been deactivated.'}</p>
        <Link to="/dashboard" className="mt-2 text-xs font-semibold px-4 py-2 rounded-xl bg-slate-800 text-slate-200">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Profile Header Card */}
      <div className="p-6 sm:p-10 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            {/* Avatar */}
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt={profile.name}
                className="w-24 h-24 rounded-3xl object-cover border-2 border-emerald-500/40 shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center text-4xl font-extrabold shadow-xl shadow-emerald-500/20">
                {profile.name?.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {profile.name}
                </h1>
                {profile.role === 'admin' && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Admin
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified (15+)
                </span>
              </div>

              {profile.email && isOwnProfile && (
                <p className="text-xs text-slate-400">{profile.email}</p>
              )}

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="font-semibold text-white">
                    {profile.averageRating ? profile.averageRating.toFixed(1) : 'New'}
                  </span>
                  <span>({profile.reviewCount || 0} reviews)</span>
                </div>

                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="capitalize">{profile.availability || 'Flexible'} schedule</span>
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {isOwnProfile ? (
              <Link
                to="/profile/edit"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors"
              >
                <Edit className="w-4 h-4 text-emerald-400" />
                Edit Profile
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to={`/find-partners`}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors"
                >
                  Exchange Request
                </Link>
                <button
                  type="button"
                  onClick={() => setIsReportOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 font-semibold text-xs transition-colors"
                  title="Report user"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {reportSuccess && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{reportSuccess}</span>
          </div>
        )}
      </div>

      {/* Profile Details & Bio */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Biography Card */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">About Me</h3>
            {profile.bio ? (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">No biography provided yet.</p>
            )}
          </div>

          {/* Skills I Can Teach Card */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-400" />
                Skills I Can Teach ({teachingSkills.length})
              </h3>
              {isOwnProfile && (
                <Link
                  to="/my-skills"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Manage Skills →
                </Link>
              )}
            </div>

            {skillsLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                Loading teaching skills...
              </div>
            ) : teachingSkills.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teachingSkills.map((skill) => (
                  <div
                    key={skill._id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{skill.title}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize shrink-0">
                        {skill.experienceLevel || 'Intermediate'}
                      </span>
                    </div>
                    {skill.category?.name && (
                      <p className="text-[10px] text-slate-400">{skill.category.name}</p>
                    )}
                    {skill.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {skill.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-slate-400 italic">
                  {isOwnProfile
                    ? "You haven't added any teaching skills yet."
                    : `${profile.name} has not listed any teaching skills yet.`}
                </p>
                {isOwnProfile && (
                  <Link
                    to="/my-skills"
                    className="inline-block text-xs font-semibold text-emerald-400 hover:underline"
                  >
                    + Add your first teaching skill
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Ratings & Testimonials Card */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                Partner Reviews & Feedback ({reviews.length})
              </h3>
              {profile.averageRating > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{profile.averageRating.toFixed(1)} / 5.0</span>
                </div>
              )}
            </div>

            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div key={rev._id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        {rev.reviewer?.profileImage ? (
                          <img
                            src={rev.reviewer.profileImage}
                            alt={rev.reviewer.name}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
                            {rev.reviewer?.name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                          </div>
                        )}
                        <span className="text-xs font-bold text-white">{rev.reviewer?.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 text-xs">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${
                              i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        "{rev.comment}"
                      </p>
                    )}
                    <div className="text-[10px] text-slate-500">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No reviews received yet. Reviews appear here after completed exchanges.</p>
            )}
          </div>
        </div>

        {/* Right Info Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Safety & Verification
            </h3>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Age verified (&gt; 15 years)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Account active and in good standing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Mutual skill exchange participant</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Moderation Report Modal */}
      {isReportOpen && profile && (
        <SubmitReportModal
          isOpen={isReportOpen}
          targetUser={profile}
          onClose={() => setIsReportOpen(false)}
          onSuccess={(msg) => setReportSuccess(msg)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
