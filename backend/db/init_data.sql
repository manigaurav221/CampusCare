-- THIS DATA IS FOR ALL THE FIELDS THAT ARE CONTROLLED PURELY BY DEVELOPERS AND HAVE NO RELATION WITH THE COLLEGE ADMIN OR END USERS

INSERT IGNORE INTO avatars (avatar_url) VALUES 
('/avatars/Fox.jpeg'),
('/avatars/Eagle.jpeg'),
('/avatars/Dragon.jpeg'),
('/avatars/Serpent.jpeg'),
('/avatars/Unicorn.jpeg');

INSERT IGNORE INTO local_guide_categories (category_name) VALUES
('Healthcare'),
('Tech Support'),
('Food'),
('Cinema'),
('Arcades'),
('Local Hotspots'),
('General Stores'),
('Clothing'),
('Logistics'),
('Miscellaneous');

/*
INSERT INTO places (category_id, college_id, place_name, place_description, address, distance, website, phone) VALUES
(<category_id>, 1, <name>, <description>, <address>, <distance>, <website>, <phone>);
*/ 

INSERT IGNORE INTO states (state_name) VALUES
('Andhra Pradesh'),
('Arunachal Pradesh'),
('Assam'),
('Bihar'),
('Chattisgarh'),
('Goa'),
('Gujrat'),
('Haryana'),
('Himachal Pradesh'),
('Jharkhand'),
('Karnataka'),
('Kerala'),
('Madhya Pradesh'),
('Maharashtra'),
('Manipur'),
('Meghalaya'),
('Mizoram'),
('Nagaland'),
('Odisha'),
('Punjab'),
('Rajasthan'),
('Sikkim'),
('Tamil Nadu'),
('Telangana'),
('Tripura'),
('Uttar Pradesh'),
('Uttarakhand'),
('West Bengal'),
('UT : Andaman and Nicobar Islands'),
('UT : Chandigarh'),
('UT : Dadra and Nagar Haveli and Daman and Diu'),
('UT : Delhi(NCT)'),
('UT : Jammu and Kashmir'),
('UT : Ladakh'),
('UT : Lakshadweep'),
('UT : Puducherry');

-- Email domain should be stored without '@' (backend matches both, but this is the clean format)
INSERT IGNORE INTO colleges (college_id, email_domain, college_name, city, state_id) VALUES 
(1, 'mnnit.ac.in', 'Motilal Nehru National Institute of Technology Allahabad', 'Prayagraj', 26);



-- Local guide categories used by routes like /api/local-guide/places/:category
/*INSERT INTO local_guide_categories (category_name)
SELECT 'healthcare'
WHERE NOT EXISTS (SELECT 1 FROM local_guide_categories WHERE category_name = 'healthcare');

INSERT INTO local_guide_categories (category_name)
SELECT 'tech'
WHERE NOT EXISTS (SELECT 1 FROM local_guide_categories WHERE category_name = 'tech');

INSERT INTO local_guide_categories (category_name)
SELECT 'clothing'
WHERE NOT EXISTS (SELECT 1 FROM local_guide_categories WHERE category_name = 'clothing');

INSERT INTO local_guide_categories (category_name)
SELECT 'food'
WHERE NOT EXISTS (SELECT 1 FROM local_guide_categories WHERE category_name = 'food');

INSERT INTO local_guide_categories (category_name)
SELECT 'logistics'
WHERE NOT EXISTS (SELECT 1 FROM local_guide_categories WHERE category_name = 'logistics');*/