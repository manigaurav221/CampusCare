const pool = require('../config/database');

class LocalGuide {
  // Get all places for a college (with ratings, category, and coords)
  static async findByCollegeId(collegeId, categoryId = null) {
    let query = `
      SELECT 
        p.place_id, p.place_name, p.place_description, p.address,
        p.distance, p.lat, p.lng, p.price_range, p.tags, p.website, p.phone, p.category_id,
        lg.category_name,
        COALESCE(ROUND(AVG(pr.rating), 1), 0) as average_rating,
        COUNT(pr.rating) as rating_count
      FROM places p
      LEFT JOIN local_guide_categories lg ON p.category_id = lg.category_id
      LEFT JOIN place_rating pr ON p.place_id = pr.place_id
      WHERE p.college_id = ?
    `;

    const params = [collegeId];

    if (categoryId) {
      query += ' AND p.category_id = ?';
      params.push(categoryId);
    }

    query += `
      GROUP BY p.place_id, p.place_name, p.place_description, p.address,
               p.distance, p.lat, p.lng, p.price_range, p.tags, p.website, p.phone, p.category_id, lg.category_name
      ORDER BY average_rating DESC, rating_count DESC
    `;

    const [rows] = await pool.query(query, params);
    return rows;
  }

  // Get places by category name
  static async findByCategory(collegeId, categoryName) {
    const [rows] = await pool.query(
      `SELECT 
        p.place_id, p.place_name, p.place_description, p.address,
        p.distance, p.lat, p.lng, p.price_range, p.tags, p.website, p.phone, p.category_id,
        lg.category_name,
        COALESCE(ROUND(AVG(pr.rating), 1), 0) as average_rating,
        COUNT(pr.rating) as rating_count
      FROM places p
      LEFT JOIN local_guide_categories lg ON p.category_id = lg.category_id
      LEFT JOIN place_rating pr ON p.place_id = pr.place_id
      WHERE p.college_id = ? AND lg.category_name = ?
      GROUP BY p.place_id, p.place_name, p.place_description, p.address,
               p.distance, p.lat, p.lng, p.price_range, p.tags, p.website, p.phone, p.category_id, lg.category_name
      ORDER BY average_rating DESC, rating_count DESC`,
      [collegeId, categoryName]
    );
    return rows;
  }

  // Get a single place by ID
  static async findById(placeId) {
    const [rows] = await pool.query(
      `SELECT 
        p.place_id, p.place_name, p.place_description, p.address,
        p.distance, p.lat, p.lng, p.price_range, p.tags, p.website, p.phone, p.category_id, p.college_id,
        lg.category_name,
        COALESCE(ROUND(AVG(pr.rating), 1), 0) as average_rating,
        COUNT(pr.rating) as rating_count
      FROM places p
      INNER JOIN local_guide_categories lg ON p.category_id = lg.category_id
      LEFT JOIN place_rating pr ON p.place_id = pr.place_id
      WHERE p.place_id = ?
      GROUP BY p.place_id, p.place_name, p.place_description, p.address,
               p.distance, p.lat, p.lng, p.price_range, p.tags, p.website, p.phone, p.category_id, p.college_id, lg.category_name`,
      [placeId]
    );
    return rows[0] || null;
  }

  // Get student reviews for a place
  static async getReviews(placeId) {
    const [rows] = await pool.query(
      `SELECT 
        pr.place_id,
        pr.user_id,
        pr.rating,
        pr.review_text,
        pr.created_at,
        up.first_name,
        up.last_name
      FROM place_rating pr
      JOIN user_profiles up ON pr.user_id = up.user_id
      WHERE pr.place_id = ? AND (pr.review_text IS NOT NULL AND pr.review_text != '')
      ORDER BY pr.created_at DESC`,
      [placeId]
    );
    return rows;
  }

  // Get all categories
  static async getCategories() {
    const [rows] = await pool.query(
      'SELECT category_id, category_name FROM local_guide_categories ORDER BY category_name'
    );
    return rows;
  }

  // Add or update a rating + written review (optionally attach/update spot coordinates)
  static async addRating(placeId, userId, rating, reviewText = null, locationData = null) {
    await pool.query(
      `INSERT INTO place_rating (place_id, user_id, rating, review_text) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), review_text = COALESCE(VALUES(review_text), review_text)`,
      [placeId, userId, rating, reviewText]
    );

    if (locationData && locationData.lat && locationData.lng) {
      await pool.query(
        `UPDATE places 
         SET lat = ?, lng = ?, 
             address = COALESCE(?, address)
         WHERE place_id = ?`,
        [locationData.lat, locationData.lng, locationData.address || null, placeId]
      );
    }

    return this.findById(placeId);
  }

  // Get user's rating for a place
  static async getUserRating(placeId, userId) {
    const [rows] = await pool.query(
      'SELECT rating, review_text FROM place_rating WHERE place_id = ? AND user_id = ?',
      [placeId, userId]
    );
    return rows[0] || null;
  }

  // Create a new place (by student or moderator)
  static async create(placeData) {
    const {
      category_id,
      college_id,
      place_name,
      place_description,
      address,
      distance = null,
      lat = null,
      lng = null,
      price_range = '₹₹',
      tags = null,
      website = null,
      phone = null,
      submitted_by = null
    } = placeData;

    const [result] = await pool.query(
      `INSERT INTO places (category_id, college_id, place_name, place_description, address, distance, lat, lng, price_range, tags, website, phone, submitted_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, college_id, place_name, place_description, address, distance, lat, lng, price_range, tags, website, phone, submitted_by]
    );

    return this.findById(result.insertId);
  }
}

module.exports = LocalGuide;
