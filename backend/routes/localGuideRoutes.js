const express = require('express');
const { body } = require('express-validator');
const {
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
} = require('../controllers/localGuideController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireStudent } = require('../middleware/authorize');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// GET /api/local-guide/categories - Get all categories (public)
router.get('/categories', getCategories);

// GET /api/local-guide/search-online - Search online places via Nominatim proxy
router.get('/search-online', searchOnlinePlaces);

// GET /api/local-guide/route - OSRM road routing proxy
router.get('/route', calculateRoute);

// GET /api/local-guide/places - Get all places (public, collegeId in query)
router.get('/places', optionalAuth, getPlaces);

// GET /api/local-guide/places/id/:id - Get single place (public)
router.get('/places/id/:id', optionalAuth, getPlaceById);

// GET /api/local-guide/places/:id/reviews - Get reviews for a place (public)
router.get('/places/:id/reviews', optionalAuth, getPlaceReviews);

// GET /api/local-guide/places/:category - Get places by category (public)
router.get('/places/:category', optionalAuth, getPlacesByCategory);

// POST /api/local-guide/places/:id/rating - Add/update rating & review (student only)
router.post(
  '/places/:id/rating',
  authenticate,
  requireStudent,
  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('reviewText')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Review cannot exceed 1000 characters')
  ],
  handleValidationErrors,
  addRating
);

// GET /api/local-guide/places/:id/rating - Get user's rating (student only)
router.get('/places/:id/rating', authenticate, requireStudent, getUserRating);

// POST /api/local-guide/places - Suggest / contribute a new student spot
router.post(
  '/places',
  authenticate,
  requireStudent,
  [
    body('placeName')
      .trim()
      .notEmpty()
      .withMessage('Place name is required')
      .isLength({ max: 255 }),
    body('placeDescription')
      .trim()
      .notEmpty()
      .withMessage('Place description is required'),
    body('categoryId')
      .isInt()
      .withMessage('Valid category ID is required')
  ],
  handleValidationErrors,
  createPlace
);

module.exports = router;
