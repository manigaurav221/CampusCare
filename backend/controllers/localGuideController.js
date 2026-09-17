const LocalGuide = require('../models/LocalGuide');

// Get all places for a college
const getPlaces = async (req, res) => {
  try {
    const collegeId = req.user ? req.user.collegeId : (req.query.collegeId || 1);
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
    
    const places = await LocalGuide.findByCollegeId(parseInt(collegeId), categoryId);

    // Also attach recent reviews for each place
    const placesWithReviews = await Promise.all(
      places.map(async (place) => {
        const reviews = await LocalGuide.getReviews(place.place_id);
        return {
          ...place,
          reviews: reviews.slice(0, 3)
        };
      })
    );

    res.json({
      success: true,
      places: placesWithReviews,
      count: placesWithReviews.length
    });
  } catch (error) {
    console.error('Get places error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching places.'
    });
  }
};

// Get places by category name
const getPlacesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const collegeId = req.user ? req.user.collegeId : (req.query.collegeId || 1);

    const places = await LocalGuide.findByCategory(parseInt(collegeId), category);

    const placesWithReviews = await Promise.all(
      places.map(async (place) => {
        const reviews = await LocalGuide.getReviews(place.place_id);
        return {
          ...place,
          reviews: reviews.slice(0, 3)
        };
      })
    );

    res.json({
      success: true,
      category,
      places: placesWithReviews,
      count: placesWithReviews.length
    });
  } catch (error) {
    console.error('Get places by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching places by category.'
    });
  }
};

// Get a single place by ID with its full reviews
const getPlaceById = async (req, res) => {
  try {
    const { id } = req.params;
    const placeId = parseInt(id);

    const place = await LocalGuide.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found.'
      });
    }

    const reviews = await LocalGuide.getReviews(placeId);

    res.json({
      success: true,
      place: {
        ...place,
        reviews
      }
    });
  } catch (error) {
    console.error('Get place by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching place.'
    });
  }
};

// Get all categories
const getCategories = async (req, res) => {
  try {
    const categories = await LocalGuide.getCategories();

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching categories.'
    });
  }
};

// Add or update rating + review for a place
const addRating = async (req, res) => {
  try {
    const { id } = req.params;
    const placeId = parseInt(id);
    const userId = req.user.userId;
    const { rating, reviewText, location } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.'
      });
    }

    const place = await LocalGuide.findById(placeId);
    if (!place) {
      return res.status(404).json({
        success: false,
        message: 'Place not found.'
      });
    }

    // Validate optional location coordinates if provided
    let locationData = null;
    if (location && location.lat && location.lng) {
      locationData = {
        lat: parseFloat(location.lat),
        lng: parseFloat(location.lng),
        address: location.address ? location.address.trim() : null
      };
    }

    const updatedPlace = await LocalGuide.addRating(
      placeId,
      userId,
      rating,
      reviewText ? reviewText.trim() : null,
      locationData
    );

    const reviews = await LocalGuide.getReviews(placeId);

    res.json({
      success: true,
      message: 'Rating and review added successfully!',
      place: {
        ...updatedPlace,
        reviews
      }
    });
  } catch (error) {
    console.error('Add rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding rating.'
    });
  }
};

// Get user's rating and review for a place
const getUserRating = async (req, res) => {
  try {
    const { id } = req.params;
    const placeId = parseInt(id);
    const userId = req.user.userId;

    const rating = await LocalGuide.getUserRating(placeId, userId);

    res.json({
      success: true,
      rating: rating ? rating.rating : null,
      reviewText: rating ? rating.review_text : null
    });
  } catch (error) {
    console.error('Get user rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user rating.'
    });
  }
};

// Get all reviews for a place
const getPlaceReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const placeId = parseInt(id);

    const reviews = await LocalGuide.getReviews(placeId);

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    console.error('Get place reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reviews.'
    });
  }
};

// Create a new place (by student)
const createPlace = async (req, res) => {
  try {
    const collegeId = req.user.collegeId;
    const userId = req.user.userId;
    const {
      categoryId,
      placeName,
      placeDescription,
      address,
      distance,
      lat,
      lng,
      priceRange,
      tags,
      website,
      phone,
      initialRating,
      initialReview
    } = req.body;

    if (!placeName || !placeDescription || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Place name, description, and category are required.'
      });
    }

    const createdPlace = await LocalGuide.create({
      category_id: parseInt(categoryId),
      college_id: collegeId,
      place_name: placeName.trim(),
      place_description: placeDescription.trim(),
      address: address ? address.trim() : null,
      distance: distance ? parseFloat(distance) : null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      price_range: priceRange || '₹₹',
      tags: tags ? tags.trim() : null,
      website: website ? website.trim() : null,
      phone: phone ? phone.trim() : null,
      submitted_by: userId
    });

    // If user provided an initial rating/review:
    if (initialRating && initialRating >= 1 && initialRating <= 5) {
      await LocalGuide.addRating(
        createdPlace.place_id,
        userId,
        initialRating,
        initialReview ? initialReview.trim() : null
      );
    }

    res.status(201).json({
      success: true,
      message: 'Place added successfully! Thank you for contributing to the student guide.',
      place: createdPlace
    });
  } catch (error) {
    console.error('Create place error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'A place with this name already exists for your college.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while creating place.'
    });
  }
};

// In-memory cache for online search results
const onlineSearchCache = new Map();

// Keyword mapping for Local Guide categories
const CATEGORY_MAP = {
  'food': ['restaurant', 'cafe', 'dhaba', 'fast food'],
  'healthcare': ['hospital', 'pharmacy', 'clinic', 'chemist'],
  'local hotspots': ['park', 'monument', 'temple', 'ghat', 'tourist attraction'],
  'tech support': ['electronics', 'computer repair', 'mobile repair'],
  'general stores': ['supermarket', 'convenience store', 'stationery', 'grocery'],
  'cinema': ['cinema', 'movie theatre'],
  'arcades': ['arcade', 'gaming center', 'amusement'],
  'clothing': ['clothing store', 'tailor', 'garments'],
  'logistics': ['courier', 'post office', 'parcel service'],
  'miscellaneous': ['stationery', 'xerox', 'printing']
};

/**
 * Server-side online search proxy
 * Overcomes browser CORS restrictions and User-Agent blocking by Nominatim.
 */
const searchOnlinePlaces = async (req, res) => {
  try {
    const category = (req.query.category || '').trim();
    const q = (req.query.q || '').trim();
    const lat = parseFloat(req.query.lat) || 25.4920; // Default: MNNIT Prayagraj
    const lng = parseFloat(req.query.lng) || 81.8639;
    const radiusMeters = parseInt(req.query.radius, 10) || 15000;

    const cacheKey = `${category.toLowerCase()}:${q.toLowerCase()}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    if (onlineSearchCache.has(cacheKey)) {
      const cached = onlineSearchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 3600000) {
        return res.json({ success: true, places: cached.data, cached: true });
      }
    }

    let searchTerm = q;
    if (!searchTerm && category) {
      const catLower = category.toLowerCase();
      const keywords = CATEGORY_MAP[catLower] || [category];
      searchTerm = keywords[0];
    }
    if (!searchTerm) {
      searchTerm = 'restaurant';
    }

    const delta = Math.max(0.08, (radiusMeters / 1000) / 111);
    const viewbox = [
      (lng - delta).toFixed(4),
      (lat + delta).toFixed(4),
      (lng + delta).toFixed(4),
      (lat - delta).toFixed(4)
    ].join(',');

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&viewbox=${viewbox}&bounded=1&limit=25&countrycodes=in&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CampusCare/1.0 (educational portal; contact: campuscare404@gmail.com)'
      },
      signal: AbortSignal.timeout(8000)
    });

    let rawPlaces = [];
    if (response.ok) {
      rawPlaces = await response.json();
    }

    if (rawPlaces.length === 0) {
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&viewbox=${viewbox}&bounded=0&limit=20&countrycodes=in&addressdetails=1`;
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'CampusCare/1.0 (educational portal; contact: campuscare404@gmail.com)'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (fbRes.ok) {
        rawPlaces = await fbRes.json();
      }
    }

    const R = 6371;
    const formatted = rawPlaces.map((item, idx) => {
      const itemLat = parseFloat(item.lat);
      const itemLng = parseFloat(item.lon || item.lng);

      let dist = null;
      if (!isNaN(itemLat) && !isNaN(itemLng)) {
        const dLat = ((itemLat - lat) * Math.PI) / 180;
        const dLon = ((itemLng - lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) * Math.cos((itemLat * Math.PI) / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        dist = parseFloat((R * c).toFixed(1));
      }

      const name = (item.display_name || item.name || 'Local Spot').split(',')[0].trim();
      const addressParts = (item.display_name || '').split(',').slice(1, 4).map(s => s.trim()).filter(Boolean);
      const address = addressParts.join(', ') || 'Prayagraj';

      return {
        place_id: `online-osm-${item.place_id || idx}`,
        place_name: name,
        place_description: `Discovered from OpenStreetMap directory near campus (${address}). Be the first student to review and rate this spot!`,
        address,
        distance: dist != null ? dist : 2.5,
        lat: itemLat,
        lng: itemLng,
        category_name: category || 'General',
        price_range: '₹ - ₹₹',
        average_rating: null,
        rating_count: 0,
        reviews: [],
        isOnline: true
      };
    }).sort((a, b) => a.distance - b.distance);

    onlineSearchCache.set(cacheKey, { data: formatted, timestamp: Date.now() });

    res.json({
      success: true,
      query: searchTerm,
      category,
      places: formatted,
      count: formatted.length
    });
  } catch (error) {
    console.error('Online search error:', error.message);
    res.json({
      success: true,
      places: [],
      count: 0,
      error: error.message
    });
  }
};

/**
 * Server-side OSRM route calculation proxy
 * Avoids browser CSP/CORS blocking and guarantees full road paths.
 */
const calculateRoute = async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng, profile = 'driving' } = req.query;
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ success: false, message: 'Coordinates required' });
    }

    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      throw new Error(`OSRM responded with status ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Route calculation error:', error.message);
    res.status(502).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPlaces,
  getPlacesByCategory,
  getPlaceById,
  getCategories,
  addRating,
  getUserRating,
  getPlaceReviews,
  createPlace,
  searchOnlinePlaces,
  calculateRoute
};
