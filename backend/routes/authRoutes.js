const express = require('express');
const { body } = require('express-validator');
const { 
  register, 
  login, 
  logout,
  getProfile, 
  updateAvatar, 
  updateProfile,
  sendVerificationCode,
  verifyCode,
  googleLogin
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/logout
router.post('/logout', logout);

// POST /api/auth/send-verification-code
router.post(
  '/send-verification-code',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],
  handleValidationErrors,
  sendVerificationCode
);

// POST /api/auth/verify-code
router.post(
  '/verify-code',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Verification code is required')
  ],
  handleValidationErrors,
  verifyCode
);

// POST /api/auth/google-login
router.post(
  '/google-login',
  [
    body('credential')
      .notEmpty()
      .withMessage('Google credential token is required')
  ],
  handleValidationErrors,
  googleLogin
);

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('reg_no')
      .notEmpty()
      .withMessage('Registration number is required'),
    body('first_name')
      .trim()
      .notEmpty()
      .withMessage('First name is required'),
    body('last_name')
      .trim()
      .notEmpty()
      .withMessage('Last name is required'),
    body('course_id')
      .isInt({ min: 1 })
      .withMessage('Valid course ID is required'),
    body('graduation_year')
      .isInt({ min: 2000, max: 2100 })
      .withMessage('Valid graduation year is required'),
    body('date_of_birth')
      .isISO8601()
      .withMessage('Valid date of birth is required (YYYY-MM-DD)')
  ],
  handleValidationErrors,
  register
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  handleValidationErrors,
  login
);

// GET /api/auth/profile
router.get('/profile', authenticate, getProfile);

// PUT /api/auth/profile
router.put(
  '/profile',
  authenticate,
  [
    body('first_name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('First name cannot be empty'),
    body('last_name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Last name cannot be empty'),
    body('graduation_year')
      .optional()
      .isInt({ min: 2000, max: 2100 })
      .withMessage('Please enter a valid graduation year'),
    body('course_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid course ID is required')
  ],
  handleValidationErrors,
  updateProfile
);

// PUT /api/auth/avatar
router.put('/avatar', authenticate, updateAvatar);

module.exports = router;
