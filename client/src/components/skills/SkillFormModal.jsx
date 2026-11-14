import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle, 
  GraduationCap, 
  BookOpen, 
  Sparkles, 
  Tag, 
  RotateCcw 
} from 'lucide-react';
import skillService from '../../services/skillService';

// Highlight query matches in autocomplete suggestions
const HighlightMatch = ({ text = '', query = '' }) => {
  if (!query || !query.trim()) return <span>{text}</span>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="text-emerald-400 font-bold">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const SkillFormModal = ({ 
  isOpen, 
  onClose, 
  onSaved, 
  categories: propCategories = [], 
  initialSkill = null, 
  defaultType = 'offered' 
}) => {
  const isEditing = !!initialSkill;

  // Categories state
  const [localCategories, setLocalCategories] = useState(propCategories || []);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    listingType: defaultType,
    experienceLevel: 'intermediate',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Autocomplete suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const titleContainerRef = useRef(null);

  // 1. Fetch categories reliably when modal opens or if not present
  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      setCategoriesError('');
      const res = await skillService.getCategories();
      if (res.success && Array.isArray(res.data)) {
        setLocalCategories(res.data);
        if (!initialSkill && res.data.length > 0) {
          setFormData((prev) => ({
            ...prev,
            category: prev.category || res.data[0]._id,
          }));
        }
      } else {
        setCategoriesError('No categories returned from server.');
      }
    } catch (err) {
      setCategoriesError(err.message || 'Failed to fetch categories.');
    } finally {
      setCategoriesLoading(false);
    }
  }, [initialSkill]);

  useEffect(() => {
    if (!isOpen) return;

    if (propCategories && propCategories.length > 0) {
      setLocalCategories(propCategories);
    } else {
      fetchCategories();
    }
  }, [isOpen, propCategories, fetchCategories]);

  // 2. Initialize or reset form values when opening or switching skill
  useEffect(() => {
    if (!isOpen) return;

    if (initialSkill) {
      setFormData({
        title: initialSkill.title || '',
        category: initialSkill.category?._id || initialSkill.category || '',
        listingType: initialSkill.listingType || defaultType,
        experienceLevel: initialSkill.experienceLevel || 'intermediate',
        description: initialSkill.description || '',
      });
    } else {
      const defaultCatId =
        (propCategories && propCategories.length > 0 && propCategories[0]._id) ||
        (localCategories && localCategories.length > 0 && localCategories[0]._id) ||
        '';

      setFormData({
        title: '',
        category: defaultCatId,
        listingType: defaultType,
        experienceLevel: 'intermediate',
        description: '',
      });
    }
    setError('');
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  }, [isOpen, initialSkill, defaultType]);

  // 3. Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (titleContainerRef.current && !titleContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 4. Autocomplete suggestion query handling
  useEffect(() => {
    const term = formData.title.trim();
    if (!term || term.length < 1) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    setSuggestionsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = {};
        if (formData.listingType) params.listingType = formData.listingType;
        if (formData.category) params.category = formData.category;

        let res = await skillService.getSkillSuggestions(term, params);

        // If category filter returned 0 results, fall back to search across all categories
        // to prevent breaking suggestions when category is filtered
        if (formData.category && (!res.success || !res.data || res.data.length === 0)) {
          res = await skillService.getSkillSuggestions(term, {
            listingType: formData.listingType,
          });
        }

        if (res.success && Array.isArray(res.data)) {
          setSuggestions(res.data);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.warn('[SkillFormModal Autocomplete Error]', err.message);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
        setShowSuggestions(true);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [formData.title, formData.category, formData.listingType]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  // Select a suggestion while strictly PRESERVING the user's selected category
  const selectSuggestion = (suggestion) => {
    setFormData((prev) => {
      // Preserve existing category if already selected, or fill from suggestion if empty
      const preservedCategory = prev.category || suggestion.categoryId || '';
      return {
        ...prev,
        title: suggestion.title,
        category: preservedCategory,
      };
    });
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    setError('');
  };

  // Keyboard navigation for suggestions
  const handleTitleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Please provide a title for the skill.');
      return;
    }

    if (!formData.category) {
      setError('Please select a skill category.');
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        await skillService.updateSkill(initialSkill._id, formData);
      } else {
        await skillService.createSkill(formData);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save skill listing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white">
              {isEditing ? 'Edit Skill Listing' : 'Add New Skill'}
            </h3>
            <p className="text-xs text-slate-400">
              {formData.listingType === 'offered'
                ? 'Share knowledge you can comfortably teach others.'
                : 'Declare a skill you want to master.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Listing Type Toggle (Only if not editing) */}
          {!isEditing && (
            <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, listingType: 'offered' }))}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  formData.listingType === 'offered'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                I Can Teach
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, listingType: 'wanted' }))}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  formData.listingType === 'wanted'
                    ? 'bg-sky-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                I Want to Learn
              </button>
            </div>
          )}

          {/* Skill Title with Autocomplete Suggestions */}
          <div className="space-y-1 relative" ref={titleContainerRef}>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300">Skill Title</label>
              {suggestionsLoading && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                  Finding suggestions...
                </span>
              )}
            </div>

            <input
              type="text"
              name="title"
              required
              maxLength={60}
              value={formData.title}
              onChange={handleChange}
              onFocus={() => {
                if (formData.title.trim()) setShowSuggestions(true);
              }}
              onKeyDown={handleTitleKeyDown}
              placeholder="e.g. React.js, Conversational Spanish, Piano Basics"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-emerald-500"
              autoComplete="off"
            />

            {/* Suggestions Dropdown */}
            {showSuggestions && formData.title.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-56 overflow-y-auto">
                {suggestions.length > 0 ? (
                  <div className="py-1 divide-y divide-slate-800/40">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between bg-slate-900/60">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        Suggested Skills
                      </span>
                      <span className="text-[9px] text-slate-500 lowercase">
                        enter to select
                      </span>
                    </div>
                    {suggestions.map((item, idx) => {
                      const isSelected = idx === activeSuggestionIndex;
                      return (
                        <div
                          key={`${item.title}-${idx}`}
                          onClick={() => selectSuggestion(item)}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          className={`px-3 py-2 flex items-center justify-between cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-400'
                              : 'text-slate-200 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="font-medium truncate pr-2">
                            <HighlightMatch text={item.title} query={formData.title} />
                          </div>
                          {item.categoryName && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0 flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" />
                              {item.categoryName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !suggestionsLoading && (
                    <div className="p-3 text-center text-xs text-slate-500">
                      No matching skill suggestions found. You can add this as a new custom skill.
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Category & Experience Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Dropdown */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">Category</label>
                {categoriesLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    Loading...
                  </span>
                )}
                {categoriesError && (
                  <button
                    type="button"
                    onClick={fetchCategories}
                    className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                    title="Retry category fetch"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Retry
                  </button>
                )}
              </div>

              {categoriesLoading ? (
                <select
                  disabled
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-500 text-xs cursor-wait"
                >
                  <option value="">Loading categories...</option>
                </select>
              ) : categoriesError ? (
                <div className="space-y-1">
                  <select
                    name="category"
                    value=""
                    disabled
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-rose-800/60 text-rose-400 text-xs"
                  >
                    <option value="">Failed to load categories</option>
                  </select>
                  <p className="text-[10px] text-rose-400">{categoriesError}</p>
                </div>
              ) : localCategories.length === 0 ? (
                <div className="space-y-1">
                  <select
                    name="category"
                    disabled
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-xs"
                  >
                    <option value="">No categories available</option>
                  </select>
                  <p className="text-[10px] text-amber-400">No skill categories found.</p>
                </div>
              ) : (
                <select
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select category</option>
                  {localCategories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Proficiency Level */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                {formData.listingType === 'offered' ? 'Proficiency Level' : 'Target Level'}
              </label>
              <select
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleChange}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-300">Description</label>
              <span className="text-[11px] text-slate-500">{formData.description.length}/500</span>
            </div>
            <textarea
              name="description"
              rows={3}
              maxLength={500}
              value={formData.description}
              onChange={handleChange}
              placeholder="Outline what you can teach (or what specific topics you hope to learn)..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || categoriesLoading || !formData.category}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SkillFormModal;
