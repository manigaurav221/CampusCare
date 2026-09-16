const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool = require('../config/database');
const User = require('../models/User');
const EmailVerification = require('../models/EmailVerification');
const { sendVerificationEmail } = require('../services/emailService');
const { JWT_EXPIRATION } = require('../config/constants');

// Helper for secure HttpOnly cookie settings
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// Register a new user
const register = async (req, res) => {
  try {
    const {
      email,
      password,
      reg_no,
      first_name,
      middle_name,
      last_name,
      college_id,
      course_id,
      graduation_year,
      date_of_birth,
      native_state_id,
      native_city
    } = req.body;

    // Validate required fields
    if (!email || !password || !reg_no || !first_name || !last_name || !course_id || !graduation_year || !date_of_birth) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanRegNo = String(reg_no).trim();

    // Verify that the email was verified
    const isVerified = await EmailVerification.isEmailVerified(cleanEmail);
    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your college email address with the verification code before registering.'
      });
    }

    // Check if user already exists with this email
    const existingUser = await User.findByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.'
      });
    }

    // Validate college email domain (for students)
    const college = await User.findCollegeByEmailDomain(cleanEmail);
    if (!college) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college email domain. Please use your official college email.'
      });
    }

    // Check if reg_no already exists for this college
    const [existingReg] = await pool.execute(
      'SELECT user_id FROM user_profiles WHERE reg_no = ? AND college_id = ?',
      [cleanRegNo, college.college_id]
    );
    if (existingReg.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A student with this registration number is already registered.'
      });
    }

    // Validate course_id belongs to this college
    const parsedCourseId = parseInt(course_id, 10);
    const [courseCheck] = await pool.execute(
      'SELECT course_id FROM courses WHERE course_id = ? AND college_id = ?',
      [parsedCourseId, college.college_id]
    );
    if (courseCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid course for your college.'
      });
    }

    // Sanitize native_state_id if provided
    let parsedStateId = null;
    if (native_state_id !== undefined && native_state_id !== null && String(native_state_id).trim() !== '') {
      const stateNum = parseInt(native_state_id, 10);
      if (!isNaN(stateNum)) {
        const [stateCheck] = await pool.execute('SELECT state_id FROM states WHERE state_id = ?', [stateNum]);
        if (stateCheck.length > 0) {
          parsedStateId = stateNum;
        }
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email: cleanEmail,
      hashed_password: hashedPassword,
      reg_no: cleanRegNo,
      first_name: String(first_name).trim(),
      middle_name: middle_name ? String(middle_name).trim() : null,
      last_name: String(last_name).trim(),
      college_id: college.college_id,
      course_id: parsedCourseId,
      graduation_year: parseInt(graduation_year, 10),
      date_of_birth,
      native_state_id: parsedStateId,
      native_city: native_city ? String(native_city).trim() : null
    });

    // Cleanup verification entry now that registration is complete
    await EmailVerification.consumeVerification(cleanEmail);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, getCookieOptions());

    // Return user data (without password)
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        userId: user.user_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        collegeId: user.college_id
      }
    });
  } catch (error) {
    console.error('Register error:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      const msg = error.sqlMessage || error.message || '';
      if (msg.includes('reg_no')) {
        return res.status(400).json({
          success: false,
          message: 'A student with this registration number is already registered.'
        });
      }
      if (msg.includes('email')) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists.'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry detected.'
      });
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({
        success: false,
        message: 'Invalid course, college, or state selected.'
      });
    }

    if (error.code === 'ER_TRUNCATED_WRONG_VALUE' || error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      return res.status(400).json({
        success: false,
        message: 'Invalid data format provided for one or more fields.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again later.'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.hashed_password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, getCookieOptions());

    // Get user details
    const userDetails = await User.findByIdWithDetails(user.user_id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        userId: userDetails.user_id,
        email: userDetails.email,
        firstName: userDetails.first_name,
        lastName: userDetails.last_name,
        collegeId: userDetails.college_id,
        collegeName: userDetails.college_name,
        courseName: userDetails.course_name,
        isModerator: userDetails.is_moderator,
        isAdmin: userDetails.is_admin,
        avatarUrl: userDetails.avatar_url
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userDetails = await User.findByIdWithDetails(req.user.userId);

    if (!userDetails) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({
      success: true,
      user: {
        userId: userDetails.user_id,
        email: userDetails.email,
        regNo: userDetails.reg_no,
        firstName: userDetails.first_name,
        middleName: userDetails.middle_name,
        lastName: userDetails.last_name,
        collegeId: userDetails.college_id,
        collegeName: userDetails.college_name,
        courseId: userDetails.course_id,
        courseName: userDetails.course_name,
        graduationYear: userDetails.graduation_year,
        avatarId: userDetails.avatar_id,
        avatarUrl: userDetails.avatar_url,
        isModerator: userDetails.is_moderator,
        isAdmin: userDetails.is_admin,
        createdAt: userDetails.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile.'
    });
  }
};

// Update current user's avatar
const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { avatar_id, avatar } = req.body;

    let targetAvatarId = avatar_id ? parseInt(avatar_id, 10) : null;

    // If client provided filename or path (e.g. 'Dragon.jpeg' or '/avatars/Dragon.jpeg')
    if (!targetAvatarId && avatar) {
      const cleanName = String(avatar).replace(/^\/?avatars\//, '');
      const [rows] = await pool.execute(
        'SELECT avatar_id FROM avatars WHERE avatar_url LIKE ? LIMIT 1',
        [`%${cleanName}%`]
      );
      if (rows.length > 0) {
        targetAvatarId = rows[0].avatar_id;
      }
    }

    if (!targetAvatarId) {
      return res.status(400).json({
        success: false,
        message: 'Valid avatar ID or name is required.'
      });
    }

    await User.update(userId, { avatar_id: targetAvatarId });
    const userDetails = await User.findByIdWithDetails(userId);

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      avatarId: userDetails.avatar_id,
      avatarUrl: userDetails.avatar_url,
      user: {
        userId: userDetails.user_id,
        email: userDetails.email,
        firstName: userDetails.first_name,
        lastName: userDetails.last_name,
        collegeId: userDetails.college_id,
        collegeName: userDetails.college_name,
        courseId: userDetails.course_id,
        courseName: userDetails.course_name,
        graduationYear: userDetails.graduation_year,
        avatarId: userDetails.avatar_id,
        avatarUrl: userDetails.avatar_url
      }
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating avatar.'
    });
  }
};

// Update current user profile (Personal & Academic info)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      first_name,
      middle_name,
      last_name,
      graduation_year,
      course_id,
      reg_no,
      native_state_id,
      native_city,
      date_of_birth
    } = req.body;

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name.trim();
    if (middle_name !== undefined) updateData.middle_name = middle_name ? middle_name.trim() : null;
    if (last_name !== undefined) updateData.last_name = last_name.trim();
    if (graduation_year !== undefined) updateData.graduation_year = parseInt(graduation_year, 10);
    if (course_id !== undefined) updateData.course_id = parseInt(course_id, 10);
    if (reg_no !== undefined) updateData.reg_no = reg_no ? reg_no.trim() : null;
    if (native_state_id !== undefined) updateData.native_state_id = native_state_id ? parseInt(native_state_id, 10) : null;
    if (native_city !== undefined) updateData.native_city = native_city ? native_city.trim() : null;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;

    await User.update(userId, updateData);
    const userDetails = await User.findByIdWithDetails(userId);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        userId: userDetails.user_id,
        email: userDetails.email,
        regNo: userDetails.reg_no,
        firstName: userDetails.first_name,
        middleName: userDetails.middle_name,
        lastName: userDetails.last_name,
        collegeId: userDetails.college_id,
        collegeName: userDetails.college_name,
        courseId: userDetails.course_id,
        courseName: userDetails.course_name,
        graduationYear: userDetails.graduation_year,
        avatarId: userDetails.avatar_id,
        avatarUrl: userDetails.avatar_url,
        isModerator: userDetails.is_moderator,
        isAdmin: userDetails.is_admin,
        createdAt: userDetails.created_at
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile.'
    });
  }
};

// Send email verification code (OTP)
const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists. Please log in instead.'
      });
    }

    // Validate college email domain
    const college = await User.findCollegeByEmailDomain(cleanEmail);
    if (!college) {
      return res.status(400).json({
        success: false,
        message: 'Invalid college email domain. Please use your official college email.'
      });
    }

    // Generate random 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to database
    await EmailVerification.createVerification(cleanEmail, otpCode);

    // Send email
    const emailResult = await sendVerificationEmail(cleanEmail, otpCode);

    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        message: emailResult.error || 'Failed to send verification email. Please check your mail server configuration.'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email.',
      college: {
        collegeId: college.college_id,
        collegeName: college.college_name
      }
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code. Please try again.'
    });
  }
};

// Verify the code entered by user
const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required.'
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const result = await EmailVerification.verifyCode(cleanEmail, code);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying code.'
    });
  }
};

// Google Login handler
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required.'
      });
    }

    let payload = null;
    const clientId = process.env.GOOGLE_CLIENT_ID;

    try {
      if (clientId && clientId !== 'your_google_client_id.apps.googleusercontent.com') {
        const client = new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: clientId
        });
        payload = ticket.getPayload();
      } else {
        // Fallback: verify directly with Google's public tokeninfo endpoint
        const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!tokenRes.ok) {
          throw new Error('Google token validation endpoint rejected the token');
        }
        payload = await tokenRes.json();
      }
    } catch (verifyErr) {
      console.error('Token verification error:', verifyErr.message);
      return res.status(401).json({
        success: false,
        message: 'Google authentication failed: ' + verifyErr.message
      });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Unable to extract email from Google account.'
      });
    }

    const googleEmail = payload.email.trim().toLowerCase();

    // Check if user already exists
    const user = await User.findByEmail(googleEmail);

    if (!user) {
      // Account does not exist yet. Check if domain belongs to a recognized college.
      const college = await User.findCollegeByEmailDomain(googleEmail);

      return res.status(404).json({
        success: false,
        notRegistered: true,
        message: 'No CampusCare account found with this Google email. Please complete registration to set up your student profile.',
        email: googleEmail,
        firstName: payload.given_name || payload.name || '',
        lastName: payload.family_name || '',
        collegeName: college ? college.college_name : null,
        collegeId: college ? college.college_id : null
      });
    }

    // User exists! Generate JWT token
    const token = jwt.sign(
      { userId: user.user_id },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Set HttpOnly cookie
    res.cookie('token', token, getCookieOptions());

    const userDetails = await User.findByIdWithDetails(user.user_id);

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        userId: userDetails.user_id,
        email: userDetails.email,
        firstName: userDetails.first_name,
        lastName: userDetails.last_name,
        collegeId: userDetails.college_id,
        collegeName: userDetails.college_name,
        courseName: userDetails.course_name,
        isModerator: userDetails.is_moderator,
        isAdmin: userDetails.is_admin,
        avatarUrl: userDetails.avatar_url
      }
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Google login.'
    });
  }
};

// Logout user (clears HttpOnly cookie)
const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateAvatar,
  updateProfile,
  sendVerificationCode,
  verifyCode,
  googleLogin
};



