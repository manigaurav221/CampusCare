SET NAMES utf8mb4;
SET default_storage_engine = InnoDB;

CREATE TABLE IF NOT EXISTS avatars (
    avatar_id INT AUTO_INCREMENT PRIMARY KEY,
    avatar_url VARCHAR(512) NOT NULL,
    UNIQUE KEY uq_avatar_url (avatar_url)
);

CREATE TABLE IF NOT EXISTS states (
	state_id INT AUTO_INCREMENT PRIMARY KEY,
    state_name VARCHAR(50) NOT NULL,
    UNIQUE(state_name)
);

CREATE TABLE IF NOT EXISTS colleges (
	college_id INT AUTO_INCREMENT PRIMARY KEY,
    email_domain VARCHAR(255) NOT NULL,
    college_name VARCHAR(255) NOT NULL,
    city VARCHAR(50) NOT NULL,
    state_id INT NOT NULL,
    FOREIGN KEY (state_id) REFERENCES states(state_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    UNIQUE(email_domain)
);

CREATE TABLE IF NOT EXISTS courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    college_id INT NOT NULL,
    course_name VARCHAR(128) NOT NULL,

    UNIQUE KEY uq_course_college (course_id, college_id),
    UNIQUE KEY uq_course_name (course_name, college_id),

    FOREIGN KEY (college_id)
        REFERENCES colleges(college_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS local_guide_categories (
	category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    UNIQUE(category_name)
);

CREATE TABLE IF NOT EXISTS user_profiles (
	user_id INT AUTO_INCREMENT PRIMARY KEY,
    is_moderator BOOLEAN DEFAULT 0,
    is_admin BOOLEAN DEFAULT 0,
    reg_no VARCHAR(50) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    avatar_id INT DEFAULT 1,
    date_of_birth DATE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50),
    last_name VARCHAR(50),
    college_id INT NOT NULL,
    course_id INT NOT NULL,
    graduation_year INT NOT NULL,
    native_state_id INT,
    native_city VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (reg_no, college_id),
    FOREIGN KEY (course_id, college_id) REFERENCES courses(course_id, college_id),
    FOREIGN KEY (avatar_id) REFERENCES avatars(avatar_id),
    FOREIGN KEY (college_id) REFERENCES colleges(college_id),
    FOREIGN KEY (native_state_id) REFERENCES states(state_id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS blog_images (
    blog_image_id INT AUTO_INCREMENT PRIMARY KEY,
    blog_image_url VARCHAR(512) NOT NULL,
    UNIQUE KEY uq_blog_image_url (blog_image_url)
);

CREATE TABLE IF NOT EXISTS blog (
	blog_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    college_id INT NOT NULL,
    blog_title VARCHAR(128) NOT NULL,
    blog_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    FOREIGN KEY (college_id) REFERENCES colleges(college_id)
);

CREATE TABLE IF NOT EXISTS blog_specific_images (
	blog_id INT NOT NULL,
    blog_image_id INT NOT NULL,
    image_index TINYINT NOT NULL,
    PRIMARY KEY(blog_id, blog_image_id),
    FOREIGN KEY (blog_id) REFERENCES blog(blog_id) ON DELETE CASCADE,
    FOREIGN KEY (blog_image_id) REFERENCES blog_images(blog_image_id) ON DELETE CASCADE,
    UNIQUE(blog_id, image_index)
);

CREATE TABLE IF NOT EXISTS blog_comments (
	comment_id INT AUTO_INCREMENT PRIMARY KEY,
    blog_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blog_id) REFERENCES blog(blog_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blog_likes (
	blog_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (blog_id) REFERENCES blog(blog_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    PRIMARY KEY (blog_id, user_id)
);

CREATE TABLE IF NOT EXISTS academic_resources (
	resource_id INT AUTO_INCREMENT PRIMARY KEY,
    college_id INT NOT NULL,
    resource_title VARCHAR(255) NOT NULL,
    resource_description TEXT,
    resource_link VARCHAR(512) NOT NULL,
    FOREIGN KEY (college_id) REFERENCES colleges(college_id),
    UNIQUE KEY uq_resource_link (college_id, resource_link)
);

CREATE TABLE IF NOT EXISTS places (
	place_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    college_id INT NOT NULL,
    place_name VARCHAR(255) NOT NULL,
    place_description TEXT,
    address VARCHAR(255),
    distance DECIMAL(6, 2),
    website VARCHAR(2048),
    phone VARCHAR(20),
    lat DECIMAL(9,6) DEFAULT NULL,
    lng DECIMAL(9,6) DEFAULT NULL,
    price_range VARCHAR(50) DEFAULT '₹₹',
    tags VARCHAR(255) DEFAULT NULL,
    submitted_by INT DEFAULT NULL,
    FOREIGN KEY (category_id) REFERENCES local_guide_categories(category_id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (college_id) REFERENCES colleges(college_id),
    UNIQUE (place_name, college_id)
);

CREATE TABLE IF NOT EXISTS place_rating (
    place_id INT NOT NULL,
    user_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    PRIMARY KEY(place_id, user_id)
);

CREATE TABLE IF NOT EXISTS fares (
    fare_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    college_id INT NOT NULL,
    from_place_name VARCHAR(255) NOT NULL,
    from_lat DECIMAL(9,6),
    from_lng DECIMAL(9,6),
    to_place_name VARCHAR(255) NOT NULL,
    to_lat DECIMAL(9,6),
    to_lng DECIMAL(9,6),
    fare_amount INT NOT NULL,
    vehicle_type ENUM('auto','cab','e-rickshaw','bus','other') DEFAULT 'auto',
    notes VARCHAR(500),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    FOREIGN KEY (college_id) REFERENCES colleges(college_id)
);

CREATE TABLE IF NOT EXISTS dashboard_images (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    college_id INT NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    UNIQUE KEY uq_dashboard_image(image_url),
    FOREIGN KEY (college_id) REFERENCES colleges(college_id)
);

CREATE TABLE IF NOT EXISTS email_verifications (
    verification_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_otp (email, otp_code),
    INDEX idx_email_verified (email, is_verified)
);
