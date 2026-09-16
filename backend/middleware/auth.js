const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token (from HttpOnly cookie or Authorization header)
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Fallback to Authorization: Bearer header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Token invalid.'
        });
      }

      // Attach user info to request object
      req.user = {
        userId: user.user_id,
        email: user.email,
        collegeId: user.college_id,
        isModerator: user.is_moderator,
        isAdmin: user.is_admin
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again.'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Authorization denied.'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (user) {
          req.user = {
            userId: user.user_id,
            email: user.email,
            collegeId: user.college_id,
            isModerator: user.is_moderator,
            isAdmin: user.is_admin
          };
        }
      } catch (error) {
        // Ignore token errors for optional auth
      }
    }

    next();
  } catch (error) {
    // Continue even if there's an error
    next();
  }
};

// Middleware to ensure user is an administrator
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Administrator privileges required.'
    });
  }
  next();
};

// Middleware to ensure user is moderator or admin
const requireModeratorOrAdmin = (req, res, next) => {
  if (!req.user || (!req.user.isModerator && !req.user.isAdmin)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Moderator or Administrator privileges required.'
    });
  }
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  requireModeratorOrAdmin
};

