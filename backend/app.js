const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialize database connection pool
// This ensures the database connection is established when the app starts
require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const blogRoutes = require('./routes/blogRoutes');
const commentRoutes = require('./routes/commentRoutes');
const reactionRoutes = require('./routes/reactionRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const localGuideRoutes = require('./routes/localGuideRoutes');
const referenceRoutes = require('./routes/referenceRoutes');
const fareRoutes = require('./routes/fareRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiGuideRoutes = require('./routes/aiGuideRoutes');

const app = express();

// Security middleware
// CSP must explicitly allow accounts.google.com scripts — Helmet's default
// 'script-src self' blocks the GSI SDK and silently prevents Google Sign-In from loading.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",               // Vite injects inline scripts in the HTML
        "https://accounts.google.com",   // Google Identity Services (GSI) SDK
      ],
      frameSrc: [
        "'self'",
        "https://accounts.google.com",   // Google OAuth popup frame
      ],
      connectSrc: [
        "'self'",
        "https://accounts.google.com",
        "https://router.project-osrm.org",
        "https://*.openstreetmap.org",
      ],
      imgSrc:    [
        "'self'",
        "data:",
        "https:",
        "blob:",
        "https://*.openstreetmap.org",
        "https://*.openstreetmap.fr",
        "https://server.arcgisonline.com",
        "https://*.arcgisonline.com",
      ],
      styleSrc:  ["'self'", "https:", "'unsafe-inline'"],
      fontSrc:   ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      baseUri:   ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// CORS configuration - Allow frontend origins with credentials
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or file://)
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.startsWith('file://')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body and cookie parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets (avatars, college logos, app logos, images)
app.use('/avatars', express.static(path.join(__dirname, 'public', 'avatars')));
app.use('/colleges', express.static(path.join(__dirname, 'public', 'colleges')));
app.use('/logos', express.static(path.join(__dirname, 'public', 'logos')));
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API Health check routes
app.get(['/api', '/api/health'], (req, res) => {
  res.json({ 
    success: true,
    message: 'Campus Care API running',
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/blogs', commentRoutes);
app.use('/api/blogs', reactionRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/local-guide', localGuideRoutes);
app.use('/api/fares', fareRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai-guide', aiGuideRoutes);
app.use('/api', referenceRoutes);

// In production, serve React frontend SPA if dist exists
const frontendDist = path.join(__dirname, '../frontend/react/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/avatars') || req.path.startsWith('/colleges') || req.path.startsWith('/logos')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// 404 handler (must be before error handler)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
