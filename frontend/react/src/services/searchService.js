import axios from 'axios';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Custom user agent for Nominatim compliance
const USER_AGENT = 'CampusCare/1.0 (educational-purpose fare calculation app)';

export class SearchService {
  // Search for places with autocomplete and proximity sorting
  static async searchPlaces(query, userLocation = null, limit = 10, options = {}) {
    try {
      const campusLat = userLocation?.lat || 25.4920;
      const campusLng = userLocation?.lng || 81.8639;
      const delta = 0.25;
      const viewbox = [
        (campusLng - delta).toFixed(4),
        (campusLat + delta).toFixed(4),
        (campusLng + delta).toFixed(4),
        (campusLat - delta).toFixed(4)
      ].join(',');

      const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          ...options.headers
        },
        params: {
          format: 'json',
          q: query,
          viewbox: viewbox,
          bounded: 0, // Prioritize nearby without strictly dropping valid outer matches
          limit: limit * 2, // Get more results to filter and sort
          addressdetails: 1,
          extratags: 1,
          countrycodes: 'in', // Prioritize India
          ...options.params
        }
      });

      let places = response.data;

      // If user location is available, sort by proximity
      if (userLocation && userLocation.lat && userLocation.lng) {
        places = places.map(place => ({
          ...place,
          distance: this.calculateDistance(
            userLocation.lat, 
            userLocation.lng, 
            place.lat, 
            place.lon
          )
        })).sort((a, b) => a.distance - b.distance);

        // Add proximity indicator to display names
        places = places.map(place => ({
          ...place,
          display_name: this.addProximityInfo(place.display_name, place.distance)
        }));
      }

      // Return only the requested limit
      return places.slice(0, limit);
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Failed to search places');
    }
  }

  // Get detailed place information
  static async getPlaceDetails(placeId) {
    try {
      const response = await axios.get(`${NOMINATIM_BASE_URL}/details`, {
        params: {
          format: 'json',
          place_id: placeId,
          addressdetails: 1,
          extratags: 1
        }
      });
      return response.data;
    } catch (error) {
      console.error('Place details error:', error);
      throw new Error('Failed to get place details');
    }
  }

  // Reverse geocoding - get address from coordinates
  static async reverseGeocode(lat, lng) {
    try {
      const response = await axios.get(`${NOMINATIM_BASE_URL}/reverse`, {
        params: {
          format: 'json',
          lat: lat,
          lon: lng,
          addressdetails: 1
        }
      });
      return response.data;
    } catch (error) {
      console.error('Reverse geocode error:', error);
      throw new Error('Failed to get address from coordinates');
    }
  }

  // Calculate route using backend proxy first (falling back to direct OSRM)
  static async calculateRoute(startLat, startLng, endLat, endLng, profile = 'driving') {
    // 1. Try backend proxy first (avoids browser CSP/CORS blocks)
    try {
      const response = await axios.get('/api/local-guide/route', {
        params: { startLat, startLng, endLat, endLng, profile },
        timeout: 7000
      });
      if (response.data?.routes?.[0]?.geometry?.coordinates) {
        return response.data;
      }
    } catch (proxyErr) {
      console.warn('Backend route proxy failed, trying direct OSRM...', proxyErr.message);
    }

    // 2. Fallback to direct OSRM call
    try {
      const OSRM_BASE_URL = `https://router.project-osrm.org/route/v1/${profile}`;
      const response = await axios.get(`${OSRM_BASE_URL}/${startLng},${startLat};${endLng},${endLat}`, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
          continue_straight: false
        },
        timeout: 7000
      });
      return response.data;
    } catch (error) {
      console.error('Route calculation error:', error);
      throw new Error('Failed to calculate route');
    }
  }

  // Map Local Guide category to proper OpenStreetMap search keywords
  static getCategoryKeywords(category) {
    if (!category) return ['restaurant', 'cafe', 'hospital', 'shop', 'pharmacy'];
    const cat = category.toLowerCase().trim();
    if (cat.includes('food') || cat.includes('restaurant') || cat.includes('cafe')) {
      return ['restaurant', 'cafe', 'dhaba', 'fast food', 'bakery'];
    }
    if (cat.includes('health') || cat.includes('hospital') || cat.includes('medical')) {
      return ['hospital', 'pharmacy', 'clinic', 'chemist'];
    }
    if (cat.includes('hotspot') || cat.includes('tourism') || cat.includes('attraction')) {
      return ['park', 'monument', 'temple', 'ghat', 'viewpoint'];
    }
    if (cat.includes('tech') || cat.includes('computer') || cat.includes('support')) {
      return ['electronics', 'computer repair', 'mobile repair'];
    }
    if (cat.includes('general') || cat.includes('store') || cat.includes('grocery')) {
      return ['supermarket', 'convenience store', 'grocery', 'stationery'];
    }
    if (cat.includes('cinema') || cat.includes('movie') || cat.includes('theatre')) {
      return ['cinema', 'movie theatre'];
    }
    if (cat.includes('arcade') || cat.includes('game') || cat.includes('gaming')) {
      return ['arcade', 'gaming', 'entertainment'];
    }
    if (cat.includes('cloth') || cat.includes('fashion') || cat.includes('apparel')) {
      return ['clothing', 'clothes', 'tailor'];
    }
    if (cat.includes('logistics') || cat.includes('courier') || cat.includes('post')) {
      return ['courier', 'post office', 'parcel'];
    }
    return [category];
  }

  // Find nearby places using backend proxy first (falls back to client dummy data)
  static async findNearbyPlaces(lat, lng, radius = 15000, category = null, query = null) {
    try {
      console.log(`🔍 Searching nearby for category="${category}" q="${query || ''}" around ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      // 1. Query server-side proxy (has proper User-Agent and no browser CORS/preflight issues)
      const response = await axios.get('/api/local-guide/search-online', {
        params: {
          lat,
          lng,
          radius,
          category: category || '',
          q: query || ''
        },
        timeout: 8000
      });

      if (response.data?.success && Array.isArray(response.data.places) && response.data.places.length > 0) {
        console.log(`✅ Backend search-online returned ${response.data.places.length} places for "${category || query}"`);
        return response.data.places;
      }
    } catch (apiErr) {
      console.warn('Backend search-online failed, falling back to category data:', apiErr.message);
    }

    // 2. Fallback to category-normalized dummy data
    return this.getCategorySpecificDummyData(lat, lng, category || query);
  }

  // Helper method to get category-specific dummy data
  static getCategorySpecificDummyData(lat, lng, category) {
    console.log(`🔍 Getting dummy data for category: "${category}"`);
    
    const dummyData = {
      'hotel': [
        {
          place_id: 'hotel1',
          display_name: 'Hotel Clarks Inn, Civil Lines, Prayagraj',
          lat: lat + 0.045,
          lon: lng + 0.045,
          class: 'tourism',
          type: 'hotel',
          distance: 5200
        },
        {
          place_id: 'hotel2',
          display_name: 'Hotel Allahabad, MG Road, Prayagraj',
          lat: lat - 0.032,
          lon: lng - 0.028,
          class: 'tourism',
          type: 'hotel',
          distance: 3800
        },
        {
          place_id: 'hotel3',
          display_name: 'Park Plaza Hotel, Civil Lines, Prayagraj',
          lat: lat + 0.058,
          lon: lng - 0.041,
          class: 'tourism',
          type: 'hotel',
          distance: 6700
        }
      ],
      'restaurant': [
        {
          place_id: 'rest1',
          display_name: 'Sagar Restaurant, Civil Lines, Prayagraj',
          lat: lat + 0.025,
          lon: lng + 0.038,
          class: 'amenity',
          type: 'restaurant',
          distance: 4500
        },
        {
          place_id: 'rest2',
          display_name: 'Domino\'s Pizza, Katra, Prayagraj',
          lat: lat - 0.042,
          lon: lng - 0.035,
          class: 'amenity',
          type: 'restaurant',
          distance: 5300
        },
        {
          place_id: 'rest3',
          display_name: 'Biryani Paradise, Katra, Prayagraj',
          lat: lat + 0.067,
          lon: lng - 0.029,
          class: 'amenity',
          type: 'restaurant',
          distance: 7200
        }
      ],
      'hospital': [
        {
          place_id: 'hosp1',
          display_name: 'SRN Hospital, Civil Lines, Prayagraj',
          lat: lat + 0.018,
          lon: lng + 0.041,
          class: 'amenity',
          type: 'hospital',
          distance: 4600
        },
        {
          place_id: 'hosp2',
          display_name: 'Medical College Hospital, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'hospital',
          distance: 150
        },
        {
          place_id: 'hosp3',
          display_name: 'Jeevan Jyoti Hospital, Civil Lines, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'hospital',
          distance: 200
        }
      ],
      'healthcare': [
        {
          place_id: 'health1',
          display_name: 'Apollo Health Center, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'clinic',
          distance: 100
        },
        {
          place_id: 'health2',
          display_name: 'Max Healthcare, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'clinic',
          distance: 150
        },
        {
          place_id: 'health3',
          display_name: 'Fortis Health, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'clinic',
          distance: 200
        }
      ],
      'school': [
        {
          place_id: 'school1',
          display_name: 'St. Joseph\'s School, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'school',
          distance: 100
        },
        {
          place_id: 'school2',
          display_name: 'Delhi Public School, Naini, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'school',
          distance: 150
        },
        {
          place_id: 'school3',
          display_name: 'Gurukul Montessori School, Civil Lines, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'school',
          distance: 200
        }
      ],
      'university': [
        {
          place_id: 'uni1',
          display_name: 'University of Allahabad, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'university',
          distance: 100
        },
        {
          place_id: 'uni2',
          display_name: 'IIIT Allahabad, Jhalwa, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'university',
          distance: 150
        },
        {
          place_id: 'uni3',
          display_name: 'MNNIT, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'university',
          distance: 200
        }
      ],
      'bank': [
        {
          place_id: 'bank1',
          display_name: 'State Bank of India, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'bank',
          distance: 100
        },
        {
          place_id: 'bank2',
          display_name: 'Punjab National Bank, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'bank',
          distance: 150
        },
        {
          place_id: 'bank3',
          display_name: 'ICICI Bank, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'bank',
          distance: 200
        }
      ],
      'atm': [
        {
          place_id: 'atm1',
          display_name: 'SBI ATM, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'atm',
          distance: 100
        },
        {
          place_id: 'atm2',
          display_name: 'HDFC ATM, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'atm',
          distance: 150
        },
        {
          place_id: 'atm3',
          display_name: 'ICICI ATM, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'atm',
          distance: 200
        }
      ],
      'pharmacy': [
        {
          place_id: 'pharm1',
          display_name: 'Apollo Pharmacy, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'pharmacy',
          distance: 100
        },
        {
          place_id: 'pharm2',
          display_name: 'MedPlus, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'pharmacy',
          distance: 150
        },
        {
          place_id: 'pharm3',
          display_name: 'Wellness Forever, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'pharmacy',
          distance: 200
        }
      ],
      'supermarket': [
        {
          place_id: 'super1',
          display_name: 'Big Bazaar, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'shop',
          type: 'supermarket',
          distance: 100
        },
        {
          place_id: 'super2',
          display_name: 'Reliance Fresh, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'shop',
          type: 'supermarket',
          distance: 150
        },
        {
          place_id: 'super3',
          display_name: 'More Supermarket, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'shop',
          type: 'supermarket',
          distance: 200
        }
      ],
      'general_stores': [
        {
          place_id: 'general1',
          display_name: 'General Store, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'shop',
          type: 'general',
          distance: 100
        },
        {
          place_id: 'general2',
          display_name: 'Kirana Store, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'shop',
          type: 'general',
          distance: 150
        },
        {
          place_id: 'general3',
          display_name: 'Daily Needs, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'shop',
          type: 'general',
          distance: 200
        }
      ],
      'mall': [
        {
          place_id: 'mall1',
          display_name: 'Vinayak City Centre, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'shop',
          type: 'mall',
          distance: 100
        },
        {
          place_id: 'mall2',
          display_name: 'Jwala Complex, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'shop',
          type: 'mall',
          distance: 150
        },
        {
          place_id: 'mall3',
          display_name: 'Taj Mall, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'shop',
          type: 'mall',
          distance: 200
        }
      ],
      'clothing': [
        {
          place_id: 'cloth1',
          display_name: 'Raymond, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'shop',
          type: 'clothing',
          distance: 100
        },
        {
          place_id: 'cloth2',
          display_name: 'Fabindia, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'shop',
          type: 'clothing',
          distance: 150
        },
        {
          place_id: 'cloth3',
          display_name: 'Allen Solly, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'shop',
          type: 'clothing',
          distance: 200
        }
      ],
      'fuel': [
        {
          place_id: 'fuel1',
          display_name: 'Indian Oil Petrol Pump, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'fuel',
          distance: 100
        },
        {
          place_id: 'fuel2',
          display_name: 'HP Petrol Pump, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'fuel',
          distance: 150
        },
        {
          place_id: 'fuel3',
          display_name: 'Bharat Petroleum, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'fuel',
          distance: 200
        }
      ],
      'parking': [
        {
          place_id: 'park1',
          display_name: 'Civil Lines Parking, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'parking',
          distance: 100
        },
        {
          place_id: 'park2',
          display_name: 'Katra Parking Area, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'parking',
          distance: 150
        },
        {
          place_id: 'park3',
          display_name: 'MG Road Parking, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'parking',
          distance: 200
        }
      ],
      'cinema': [
        {
          place_id: 'cinema1',
          display_name: 'PVR Cinemas, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'cinema',
          distance: 100
        },
        {
          place_id: 'cinema2',
          display_name: 'INOX Theatre, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'cinema',
          distance: 150
        },
        {
          place_id: 'cinema3',
          display_name: 'Cinepolis, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'cinema',
          distance: 200
        }
      ],
      'arcade': [
        {
          place_id: 'arcade1',
          display_name: 'Game Zone Arcade, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'arcade',
          distance: 100
        },
        {
          place_id: 'arcade2',
          display_name: 'Fun Zone Gaming, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'arcade',
          distance: 150
        },
        {
          place_id: 'arcade3',
          display_name: 'Play Arena, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'arcade',
          distance: 200
        }
      ],
      'park': [
        {
          place_id: 'park1',
          display_name: 'Chandrashekhar Azad Park, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'leisure',
          type: 'park',
          distance: 100
        },
        {
          place_id: 'park2',
          display_name: 'Minto Park, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'leisure',
          type: 'park',
          distance: 150
        },
        {
          place_id: 'park3',
          display_name: 'Company Garden, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'leisure',
          type: 'park',
          distance: 200
        }
      ],
      'gym': [
        {
          place_id: 'gym1',
          display_name: 'Gold\'s Gym, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'leisure',
          type: 'gym',
          distance: 100
        },
        {
          place_id: 'gym2',
          display_name: 'Fitline Gym, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'leisure',
          type: 'gym',
          distance: 150
        },
        {
          place_id: 'gym3',
          display_name: 'Power Gym, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'leisure',
          type: 'gym',
          distance: 200
        }
      ],
      'cafe': [
        {
          place_id: 'cafe1',
          display_name: 'Cafe Coffee Day, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'cafe',
          distance: 100
        },
        {
          place_id: 'cafe2',
          display_name: 'Barista, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'cafe',
          distance: 150
        },
        {
          place_id: 'cafe3',
          display_name: 'Starbucks, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'cafe',
          distance: 200
        }
      ],
      'bar': [
        {
          place_id: 'bar1',
          display_name: 'The Irish House, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'bar',
          distance: 100
        },
        {
          place_id: 'bar2',
          display_name: 'Liquor Lounge, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'bar',
          distance: 150
        },
        {
          place_id: 'bar3',
          display_name: 'Wine Shop, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'bar',
          distance: 200
        }
      ],
      'police': [
        {
          place_id: 'police1',
          display_name: 'Civil Lines Police Station, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'police',
          distance: 100
        },
        {
          place_id: 'police2',
          display_name: 'Katra Police Chowki, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'police',
          distance: 150
        },
        {
          place_id: 'police3',
          display_name: 'MG Road Police Station, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'police',
          distance: 200
        }
      ],
      'fire_station': [
        {
          place_id: 'fire1',
          display_name: 'Civil Lines Fire Station, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'fire_station',
          distance: 100
        },
        {
          place_id: 'fire2',
          display_name: 'Katra Fire Station, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'fire_station',
          distance: 150
        },
        {
          place_id: 'fire3',
          display_name: 'MG Road Fire Station, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'fire_station',
          distance: 200
        }
      ],
      'post_office': [
        {
          place_id: 'post1',
          display_name: 'Civil Lines Post Office, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'post_office',
          distance: 100
        },
        {
          place_id: 'post2',
          display_name: 'Katra Post Office, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'post_office',
          distance: 150
        },
        {
          place_id: 'post3',
          display_name: 'MG Road Post Office, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'post_office',
          distance: 200
        }
      ],
      'library': [
        {
          place_id: 'lib1',
          display_name: 'Saraswati Library, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'library',
          distance: 100
        },
        {
          place_id: 'lib2',
          display_name: 'Public Library, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'library',
          distance: 150
        },
        {
          place_id: 'lib3',
          display_name: 'MG Road Library, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'library',
          distance: 200
        }
      ],
      'museum': [
        {
          place_id: 'museum1',
          display_name: 'Allahabad Museum, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'tourism',
          type: 'museum',
          distance: 100
        },
        {
          place_id: 'museum2',
          display_name: 'Archaeological Museum, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'tourism',
          type: 'museum',
          distance: 150
        },
        {
          place_id: 'museum3',
          display_name: 'Heritage Museum, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'tourism',
          type: 'museum',
          distance: 200
        }
      ],
      'temple': [
        {
          place_id: 'temple1',
          display_name: 'Hanuman Temple, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'temple',
          distance: 100
        },
        {
          place_id: 'temple2',
          display_name: 'Shiv Temple, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'temple',
          distance: 150
        },
        {
          place_id: 'temple3',
          display_name: 'Ram Temple, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'temple',
          distance: 200
        }
      ],
      'mosque': [
        {
          place_id: 'mosque1',
          display_name: 'Jama Masjid, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'mosque',
          distance: 100
        },
        {
          place_id: 'mosque2',
          display_name: 'Katra Mosque, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'mosque',
          distance: 150
        },
        {
          place_id: 'mosque3',
          display_name: 'MG Road Mosque, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'mosque',
          distance: 200
        }
      ],
      'church': [
        {
          place_id: 'church1',
          display_name: 'St. Joseph\'s Church, Civil Lines, Prayagraj',
          lat: lat + 0.001,
          lon: lng + 0.001,
          class: 'amenity',
          type: 'church',
          distance: 100
        },
        {
          place_id: 'church2',
          display_name: 'Holy Trinity Church, Katra, Prayagraj',
          lat: lat - 0.001,
          lon: lng - 0.001,
          class: 'amenity',
          type: 'church',
          distance: 150
        },
        {
          place_id: 'church3',
          display_name: 'St. Mary\'s Church, MG Road, Prayagraj',
          lat: lat + 0.002,
          lon: lng - 0.002,
          class: 'amenity',
          type: 'church',
          distance: 200
        }
      ]
    };

    // Return category-specific data or mixed data for "All Categories"
    if (!category) {
      const mixedData = [
        ...dummyData.hotel.slice(0, 2),
        ...dummyData.restaurant.slice(0, 2),
        ...dummyData.hospital.slice(0, 1),
        ...dummyData.school.slice(0, 1),
        ...dummyData.bank.slice(0, 1)
      ].sort((a, b) => a.distance - b.distance);
      console.log(`📊 Returning ${mixedData.length} mixed places for "All Categories"`);
      return mixedData;
    }

    const result = dummyData[category] || dummyData.restaurant; // Fallback to restaurants
    console.log(`📊 Returning ${result.length} places for category "${category}"`);
    console.log('📍 Sample results:');
    result.slice(0, 3).forEach((place, i) => {
      console.log(`  ${i+1}. ${place.display_name} - ${Math.round(place.distance)}m`);
    });
    
    return result;
  }

  // Add proximity information to display name
  static addProximityInfo(displayName, distance) {
    if (distance < 1000) {
      return `${displayName} (${Math.round(distance)}m away)`;
    } else if (distance < 50000) { // Within 50km
      return `${displayName} (${(distance / 1000).toFixed(1)}km away)`;
    }
    return displayName; // Don't add distance for very far places
  }

  // Calculate distance between two points (Haversine formula)
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Convert to meters
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}
