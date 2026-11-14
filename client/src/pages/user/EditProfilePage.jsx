import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { 
  User, 
  Save, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Image, 
  Clock,
  UploadCloud,
  Trash2
} from 'lucide-react';

const EditProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    profileImage: user?.profileImage || '',
    availability: user?.availability || 'flexible',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileError, setFileError] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
    setSuccess('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');
    setError('');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setFileError('Unsupported file format. Please choose a JPEG, PNG, or WebP image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setFileError('File size exceeds 5MB limit. Please choose a smaller image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCancelNewImage = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let finalProfileImageUrl = formData.profileImage;

      // If user selected a new file from their computer, upload it first
      if (selectedFile) {
        const uploadData = new FormData();
        uploadData.append('avatar', selectedFile);

        const uploadResponse = await api.post('/users/upload-avatar', uploadData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (uploadResponse.success && uploadResponse.data?.profileImage) {
          finalProfileImageUrl = uploadResponse.data.profileImage;
        } else {
          throw new Error('Failed to upload image file.');
        }
      }

      // Update profile preserving existing learning interests
      const response = await api.patch('/users/me', {
        ...formData,
        profileImage: finalProfileImageUrl,
      });

      if (response.success && response.data) {
        updateUser(response.data);
        setSuccess('Profile updated successfully!');
        setTimeout(() => {
          navigate('/profile');
        }, 1200);
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Profile
        </Link>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white">Edit Your Profile</h1>
      </div>

      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-emerald-400 text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">Full Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Your full name"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Biography */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Biography</label>
              <span className="text-[11px] text-slate-500">{formData.bio.length}/500</span>
            </div>
            <textarea
              name="bio"
              rows={4}
              maxLength={500}
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell others what you are passionate about, your teaching style, or your learning aspirations..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Profile Picture Upload & Preview */}
          <div className="space-y-3 pt-1">
            <label className="block text-xs font-semibold text-slate-300">
              Profile Picture
            </label>

            {/* Live Preview & Actions Container */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              {/* Avatar Preview */}
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 border-2 border-emerald-500/30 flex items-center justify-center shrink-0 shadow-md">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : formData.profileImage ? (
                  <img
                    src={formData.profileImage}
                    alt="Current Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-400 font-bold text-2xl">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : <User className="w-8 h-8 text-slate-500" />}
                  </div>
                )}
                {previewUrl && (
                  <span className="absolute bottom-0 inset-x-0 bg-emerald-500/90 text-slate-950 text-[9px] font-bold text-center py-0.5">
                    PREVIEW
                  </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="profile-picture-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-semibold transition-all hover:scale-[1.02]"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Upload Profile Picture
                  </button>

                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleCancelNewImage}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      title="Cancel selection and retain existing photo"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      Retain Current Picture
                    </button>
                  )}
                </div>

                {selectedFile ? (
                  <p className="text-[11px] text-emerald-400 font-medium">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB) — Click 'Save Changes' to update.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Supports JPEG, PNG, or WebP up to 5MB. Preview appears above.
                  </p>
                )}

                {/* File format/size validation error */}
                {fileError && (
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs pt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Optional URL fallback */}
            <div className="space-y-1 pt-1">
              <label className="block text-[11px] font-medium text-slate-400">
                Or provide an image URL directly:
              </label>
              <div className="relative">
                <Image className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="url"
                  name="profileImage"
                  value={formData.profileImage}
                  onChange={handleChange}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          </div>


          {/* Availability */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Availability Preference
            </label>
            <select
              name="availability"
              value={formData.availability}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="flexible">Flexible (Anytime)</option>
              <option value="weekdays">Weekdays Only</option>
              <option value="weekends">Weekends Only</option>
              <option value="evenings">Evenings Only</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <Link
              to="/profile"
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfilePage;
