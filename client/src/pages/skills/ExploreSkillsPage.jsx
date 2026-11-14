import React, { useEffect, useState, useRef } from 'react';
import { 
  Search, 
  Filter, 
  GraduationCap, 
  BookOpen, 
  Compass, 
  Loader2, 
  AlertCircle,
  X,
  Sparkles,
  ArrowRight,
  Tag
} from 'lucide-react';
import skillService from '../../services/skillService';
import SkillCard from '../../components/skills/SkillCard';

// Helper to highlight matching characters in suggestions
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

const ExploreSkillsPage = () => {
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [listingType, setListingType] = useState(''); // '' | 'offered' | 'wanted'
  const [experienceLevel, setExperienceLevel] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef(null);

  // Pagination
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });

  const fetchCategories = async () => {
    try {
      const res = await skillService.getCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch categories:', err.message);
    }
  };

  const fetchSkills = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 12 };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (listingType) params.listingType = listingType;
      if (experienceLevel) params.experienceLevel = experienceLevel;

      const res = await skillService.getSkills(params);
      if (res.success && res.data) {
        setSkills(res.data);
        if (res.meta) setMeta(res.meta);
      }
    } catch (err) {
      setError(err.message || 'Unable to load skills.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Grid fetch debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSkills(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, listingType, experienceLevel]);

  // Dynamic search suggestions fetch
  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    setSuggestionsLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const params = {};
        if (selectedCategory) params.category = selectedCategory;
        if (listingType) params.listingType = listingType;

        const res = await skillService.getSkillSuggestions(query, params);
        if (res.success && Array.isArray(res.data)) {
          setSuggestions(res.data);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.warn('Autocomplete fetch failed:', err.message);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
        setShowSuggestions(true);
      }
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [search, selectedCategory, listingType]);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation for suggestions
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[activeSuggestionIndex]);
      } else {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const selectSuggestion = (suggestion) => {
    setSearch(suggestion.title);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('');
    setListingType('');
    setExperienceLevel('');
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const hasActiveFilters = !!(search || selectedCategory || listingType || experienceLevel);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
      {/* Page Title & Search Bar */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Compass className="w-7 h-7 text-emerald-400" />
            Explore Skill Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse skills taught and sought by community members across diverse disciplines.
          </p>
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1" ref={searchContainerRef}>
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => {
                if (search.trim()) setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search skills (e.g. Web Development, React, Python, UI/UX)..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setShowSuggestions(false);
                }}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Dynamic Search Suggestions Autocomplete Dropdown */}
            {showSuggestions && search.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150">
                {suggestionsLoading ? (
                  <div className="p-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Searching suggestions...</span>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="py-2">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        Suggested Skills
                      </span>
                      <span className="text-[10px] text-slate-500 lowercase">
                        arrow keys to navigate • enter to select
                      </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/40">
                      {suggestions.map((item, idx) => {
                        const isSelected = idx === activeSuggestionIndex;
                        return (
                          <div
                            key={`${item.title}-${idx}`}
                            onClick={() => selectSuggestion(item)}
                            onMouseEnter={() => setActiveSuggestionIndex(idx)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-slate-800/90 text-white'
                                : 'text-slate-300 hover:bg-slate-850 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Search className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                              <div className="truncate">
                                <div className="text-sm">
                                  <HighlightMatch text={item.title} query={search} />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {item.categoryName && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-medium">
                                  {item.categoryName}
                                </span>
                              )}
                              {item.listingType && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  item.listingType === 'offered'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                }`}>
                                  {item.listingType === 'offered' ? 'Teach' : 'Learn'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center space-y-1">
                    <p className="text-xs font-semibold text-slate-300">
                      No matching skills found for "{search.trim()}"
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Try another keyword or press Enter to search the full directory.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Level Filter */}
          <select
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Experience Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs: Type & Categories */}
      <div className="space-y-3">
        {/* Listing Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setListingType('')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              listingType === ''
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Listings
          </button>
          <button
            onClick={() => setListingType('offered')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              listingType === 'offered'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Can Teach (Offered)
          </button>
          <button
            onClick={() => setListingType('wanted')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              listingType === 'wanted'
                ? 'bg-sky-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Wants to Learn (Wanted)
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-rose-400 hover:underline ml-auto flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('')}
            className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === ''
                ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`whitespace-nowrap px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat._id
                  ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Found {meta.total} skills</span>
        {meta.pages > 1 && <span>Page {meta.page} of {meta.pages}</span>}
      </div>

      {/* Grid of Skills */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs text-slate-400">Searching skills directory...</p>
        </div>
      ) : skills.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Deduplicate skills safely by _id */}
          {Array.from(new Map(skills.map((s) => [s._id, s])).values()).map((skill) => (
            <SkillCard key={skill._id} skill={skill} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4 max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base">
              {search.trim() ? `No skills matching "${search.trim()}"` : 'No skills matched your search'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {search.trim()
                ? `We couldn't find any skills matching "${search.trim()}". Try searching with a different keyword, checking your spelling, or clearing active filters.`
                : 'Try adjusting your search keywords, switching categories, or clearing active filters.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          {Array.from({ length: meta.pages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchSkills(p)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                meta.page === p
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExploreSkillsPage;
