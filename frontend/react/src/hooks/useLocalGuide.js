import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../services/apiClient';
import { getUser } from '../services/authStorage';
import { SearchService } from '../services/searchService';

// MNNIT Campus Default Coordinates
const MNNIT_LAT = 25.4920;
const MNNIT_LNG = 81.8636;

export function useLocalGuide() {
  const [categories, setCategories] = useState([]);
  const [places, setPlaces] = useState([]);
  const [onlinePlaces, setOnlinePlaces] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiRequest('/local-guide/categories', 'GET');
        setCategories(res.categories || []);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch online places fallback via OpenStreetMap / Nominatim
  const fetchOnlineFallback = useCallback(async (catName, query = null) => {
    setOnlineLoading(true);
    try {
      const results = await SearchService.findNearbyPlaces(MNNIT_LAT, MNNIT_LNG, 15000, catName, query);

      const formatted = (results || []).slice(0, 16).map((item, idx) => {
        const itemLat = parseFloat(item.lat);
        const itemLng = parseFloat(item.lon || item.lng);

        const name = (item.place_name || item.display_name || item.name || 'Local Spot').split(',')[0].trim();
        const address = item.address || (item.display_name || '').split(',').slice(1, 3).join(',').trim() || 'Prayagraj';

        return {
          place_id: item.place_id || `online-${idx}-${Date.now()}`,
          place_name: name,
          place_description: item.place_description || `Discovered from OpenStreetMap directory near campus (${address}). Be the first student to review and rate this place!`,
          address,
          distance: item.distance != null ? parseFloat(item.distance) : 2.0,
          lat: itemLat,
          lng: itemLng,
          category_name: catName || item.category_name || 'General',
          price_range: item.price_range || '₹ - ₹₹',
          average_rating: item.average_rating || null,
          rating_count: item.rating_count || 0,
          reviews: item.reviews || [],
          isOnline: true
        };
      });

      setOnlinePlaces(formatted);
    } catch (err) {
      console.warn('Online fallback error:', err);
      setOnlinePlaces([]);
    } finally {
      setOnlineLoading(false);
    }
  }, []);

  // Fetch feeded places from database
  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = getUser();
      const endpoint = selectedCategory
        ? `/local-guide/places/${encodeURIComponent(selectedCategory)}`
        : '/local-guide/places';
      const url = user?.collegeId ? endpoint : `${endpoint}?collegeId=1`;
      const token = user ? true : null;

      const res = await apiRequest(url, 'GET', null, token);
      const fetchedPlaces = res.places || [];
      setPlaces(fetchedPlaces);

      // If no feeded places exist for this category, automatically load online places!
      if (fetchedPlaces.length === 0) {
        fetchOnlineFallback(selectedCategory);
      } else {
        setOnlinePlaces([]);
      }
    } catch (err) {
      console.error('Failed to load places:', err);
      setError(err.message || 'Failed to load places');
      // On backend failure, load online fallback
      fetchOnlineFallback(selectedCategory);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, fetchOnlineFallback]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  // Submit a rating + written review (optionally attach location)
  const submitRating = async (placeId, rating, reviewText = '', location = null) => {
    try {
      await apiRequest(
        `/local-guide/places/${placeId}/rating`,
        'POST',
        { rating, reviewText, location },
        true
      );
      // Refresh places to get updated rating & reviews
      await fetchPlaces();
      return { success: true };
    } catch (err) {
      console.error('Submit rating error:', err);
      return { success: false, error: err.message || 'Failed to submit rating' };
    }
  };

  // Student suggests/adds a new place
  const addPlace = async (placeData) => {
    try {
      const res = await apiRequest('/local-guide/places', 'POST', placeData, true);
      await fetchPlaces();
      return { success: true, place: res.place };
    } catch (err) {
      console.error('Add place error:', err);
      return { success: false, error: err.message || 'Failed to add place' };
    }
  };

  return {
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
    refreshPlaces: fetchPlaces,
    fetchOnlineFallback
  };
}
