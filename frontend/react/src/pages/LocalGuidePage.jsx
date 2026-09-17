import { useState, useMemo, useEffect } from 'react';
import { TopNav } from '../components/layout/TopNav';
import { Footer } from '../components/layout/Footer';
import { SEO } from '../components/common/SEO';
import { useLocalGuide } from '../hooks/useLocalGuide';
import { PlaceCard } from '../components/localGuide/PlaceCard';
import { AddPlaceModal } from '../components/localGuide/AddPlaceModal';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { PlaceCardSkeleton } from '../components/common/SkeletonLoader';
import { EmptyState } from '../components/common/EmptyState';

export function LocalGuidePage() {
  const {
    categories,
    places,
    onlinePlaces,
    selectedCategory,
    setSelectedCategory,
    loading,
    onlineLoading,
    error,
    submitRating,
    addPlace,
    fetchOnlineFallback
  } = useLocalGuide();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'online'

  // Filter places based on search query
  const filteredPlaces = useMemo(() => {
    if (!searchQuery.trim()) return places;
    const q = searchQuery.toLowerCase();
    return places.filter(
      (p) =>
        p.place_name?.toLowerCase().includes(q) ||
        p.place_description?.toLowerCase().includes(q) ||
        p.tags?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q)
    );
  }, [places, searchQuery]);

  // When user types in search query and no database spots match, automatically trigger online search!
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length >= 2 && filteredPlaces.length === 0) {
      const timer = setTimeout(() => {
        fetchOnlineFallback(selectedCategory, query);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, filteredPlaces.length, selectedCategory, fetchOnlineFallback]);

  // Handle claiming an online spot into the permanent student database
  const handleClaimOnlineSpot = async (onlinePlace, rating, reviewText) => {
    // Find matching category ID
    const cat = categories.find((c) => c.category_name === onlinePlace.category_name) || categories[0];
    const res = await addPlace({
      placeName: onlinePlace.place_name,
      categoryId: cat ? cat.category_id : 23,
      placeDescription: onlinePlace.place_description,
      address: onlinePlace.address,
      distance: onlinePlace.distance,
      lat: onlinePlace.lat,
      lng: onlinePlace.lng,
      priceRange: onlinePlace.price_range || '₹₹',
      tags: onlinePlace.category_name,
      initialRating: rating,
      initialReview: reviewText
    });
    return res;
  };

  const categoryIcons = {
    Food: '🍔',
    Healthcare: '🏥',
    'Local Hotspots': '📍',
    'Tech Support': '💻',
    'General Stores': '🛒',
    Cinema: '🎬',
    Arcades: '🎮',
    Clothing: '👕',
    Logistics: '📦',
    Miscellaneous: '✨'
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-text-primary">
      <SEO
        title="Local Campus Guide - MNNIT"
        description="For students, by students. Discover trusted cafes, dhabas, printing services, and hangouts around campus."
      />
      <TopNav />

      <main className="flex-1 p-4 sm:p-6 md:p-10 max-w-6xl mx-auto w-full space-y-6 fade-in">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest mb-1">
              <span>📍</span>
              <span>For Students, By Students</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
              Campus Local Guide
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">
              Student-reviewed cafes, dhabas, midnight food points, printing hubs, and hangout spots around MNNIT.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs sm:text-sm px-5 py-3 rounded-xl flex items-center gap-2 shadow-xl shadow-primary/25 hover:scale-[1.02] transition-all self-start md:self-auto"
          >
            <span className="text-base">➕</span>
            <span>Recommend a Spot</span>
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="card-glass rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spots, food dishes, Xerox, cafes, medicines..."
              className="w-full px-4 py-3 pl-11 rounded-xl border border-white/15 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              style={{
                backgroundColor: '#1E293B',
                color: '#F8FAFC',
              }}
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary text-base pointer-events-none">
              🔍
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-text-secondary hover:text-white px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Chips Scroller */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                selectedCategory === ''
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-card/40 border border-white/10 text-text-secondary hover:bg-card hover:text-white'
              }`}
            >
              <span>🌟</span>
              <span>All Spots</span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => setSelectedCategory(cat.category_name)}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  selectedCategory === cat.category_name
                    ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                    : 'bg-card/40 border border-white/10 text-text-secondary hover:bg-card hover:text-white'
                }`}
              >
                <span>{categoryIcons[cat.category_name] || '📍'}</span>
                <span>{cat.category_name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Add Spot Modal */}
        {isAddModalOpen && (
          <AddPlaceModal
            categories={categories}
            onSubmit={async (data) => {
              const res = await addPlace(data);
              return res;
            }}
            onClose={() => setIsAddModalOpen(false)}
          />
        )}

        <ErrorMessage message={error} className="mb-4" />

        {/* Content Section */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <PlaceCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPlaces.length > 0 ? (
          /* PRIMARY DISPLAY: Student Feeded Spots */
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <span>🎓</span>
                <span>Student-Verified Recommendations ({filteredPlaces.length})</span>
              </span>
              <span className="text-[11px] text-primary">Ranked by Student Ratings</span>
            </div>

            <div className="space-y-4">
              {filteredPlaces.map((place) => (
                <PlaceCard
                  key={place.place_id}
                  place={place}
                  onSubmitRating={submitRating}
                />
              ))}
            </div>
          </div>
        ) : (
          /* FALLBACK DISPLAY: Online Sources when no feeded data exists */
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-card/40 border border-dashed border-white/15 text-center space-y-2">
              <span className="text-3xl block">🌐</span>
              <h3 className="font-bold text-text-primary text-base">
                No Student Reviews for this Category Yet
              </h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                Showing nearest verified facilities discovered from online directory around campus. Be the first student to review or claim any of these spots!
              </p>
            </div>

            {onlineLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <PlaceCardSkeleton key={i} />
                ))}
              </div>
            ) : onlinePlaces.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <span>📍</span>
                    <span>Discovered Nearby from Online Sources ({onlinePlaces.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchOnlineFallback(selectedCategory)}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <span>🔄</span>
                    <span>Refresh Online Search</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {onlinePlaces.map((place) => (
                    <PlaceCard
                      key={place.place_id}
                      place={place}
                      onSubmitRating={submitRating}
                      onClaimOnlineSpot={handleClaimOnlineSpot}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="card-glass rounded-2xl p-8 text-center">
                <EmptyState
                  message="No places found nearby. Click 'Recommend a Spot' above to add one!"
                  icon="📍"
                />
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
