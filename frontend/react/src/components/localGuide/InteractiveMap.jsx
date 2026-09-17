import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to center map on location
function MapCenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

// Component for live location tracking
function LiveLocationTracker({ userLocation, isTracking, onLocationUpdate, route }) {
  const map = useMap();
  const markerRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const updateIntervalRef = useRef(null);
  
  useEffect(() => {
    if (!isTracking || !userLocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        // Throttle updates to every 3 seconds minimum
        if (now - lastUpdateRef.current < 3000) {
          return;
        }
        
        lastUpdateRef.current = now;
        onLocationUpdate(newLocation);
        
        // Update marker position
        if (markerRef.current) {
          markerRef.current.setLatLng([newLocation.lat, newLocation.lng]);
        }
        
        // Only center map if user has moved significantly (more than 50 meters)
        if (userLocation) {
          const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            newLocation.lat, newLocation.lng
          );
          
          if (distance > 50) {
            map.flyTo([newLocation.lat, newLocation.lng], 16, {
              duration: 2
            });
          }
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000 // Allow slightly cached positions for stability
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [isTracking, userLocation, map, onLocationUpdate]);

  return null;
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Convert to meters
}

// Component for next turn popup
function NextTurnPopup({ route, userLocation }) {
  const [nextTurn, setNextTurn] = useState(null);
  
  useEffect(() => {
    if (!route || !route.routes || !route.routes[0] || !userLocation) {
      setNextTurn(null);
      return;
    }
    
    const routeCoords = route.routes[0].geometry.coordinates;
    if (routeCoords.length < 2) return;
    
    // Find the closest point on the route to user's current location
    let closestIndex = 0;
    let minDistance = Infinity;
    
    routeCoords.forEach((coord, index) => {
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        coord[1], coord[0]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // Look ahead for the next turn (check for direction changes)
    if (closestIndex < routeCoords.length - 2) {
      const current = routeCoords[closestIndex];
      const next = routeCoords[closestIndex + 1];
      const afterNext = routeCoords[Math.min(closestIndex + 2, routeCoords.length - 1)];
      
      // Calculate bearings
      const bearing1 = calculateBearing(current[1], current[0], next[1], next[0]);
      const bearing2 = calculateBearing(next[1], next[0], afterNext[1], afterNext[0]);
      
      // Calculate the turn angle
      const turnAngle = normalizeAngle(bearing2 - bearing1);
      
      // Determine turn type and instruction
      let instruction = 'Continue straight';
      let turnType = 'straight';
      
      if (Math.abs(turnAngle) > 30) { // Significant turn
        if (turnAngle > 0 && turnAngle <= 150) {
          instruction = 'Turn right';
          turnType = 'right';
        } else if (turnAngle < 0 && turnAngle >= -150) {
          instruction = 'Turn left';
          turnType = 'left';
        } else if (turnAngle > 150) {
          instruction = 'Sharp right';
          turnType = 'right';
        } else if (turnAngle < -150) {
          instruction = 'Sharp left';
          turnType = 'left';
        }
      }
      
      // Calculate distance to next turn
      const distanceToTurn = calculateDistance(
        userLocation.lat, userLocation.lng,
        next[1], next[0]
      );
      
      // Only show if turn is within 500m
      if (distanceToTurn < 500 && instruction !== 'Continue straight') {
        setNextTurn({
          instruction,
          distance: Math.round(distanceToTurn),
          type: turnType
        });
      } else {
        setNextTurn(null);
      }
    } else {
      // Near the end of route
      const distanceToEnd = calculateDistance(
        userLocation.lat, userLocation.lng,
        routeCoords[routeCoords.length - 1][1],
        routeCoords[routeCoords.length - 1][0]
      );
      
      if (distanceToEnd < 200) {
        setNextTurn({
          instruction: 'Arrive at destination',
          distance: Math.round(distanceToEnd),
          type: 'arrive'
        });
      } else {
        setNextTurn(null);
      }
    }
  }, [route, userLocation]);
  
  if (!nextTurn) return null;
  
  return (
    <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-[1000] bg-white rounded-lg shadow-lg p-3 max-w-sm">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0">
          {nextTurn.type === 'left' && <span className="text-2xl">←</span>}
          {nextTurn.type === 'right' && <span className="text-2xl">→</span>}
          {nextTurn.type === 'straight' && <span className="text-2xl">↑</span>}
          {nextTurn.type === 'arrive' && <span className="text-2xl">🎯</span>}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-900">
            {nextTurn.instruction}
          </div>
          <div className="text-xs text-gray-500">
            In {nextTurn.distance}m
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
           Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Helper function to normalize angle to -180 to 180
function normalizeAngle(angle) {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

// Component for map controls
function MapControls({ onReset, isTracking, toggleTracking }) {
  const map = useMap();
  
  const handleReset = () => {
    const mapPane = map.getPanes().mapPane;
    mapPane.style.transform = 'rotate(0deg)';
    map.setView([25.4358, 81.8463], 13);
    onReset();
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] space-y-2">
      <button
        onClick={toggleTracking}
        className={`px-3 py-2 rounded-lg text-white text-sm font-medium shadow-lg transition-colors ${
          isTracking 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-green-500 hover:bg-green-600'
        }`}
      >
        {isTracking ? '🛑 Stop Tracking' : '📍 Start Tracking'}
      </button>
      
      <button
        onClick={handleReset}
        className="px-3 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium shadow-lg hover:bg-gray-600 transition-colors block w-full"
      >
        🏠 Reset View
      </button>
    </div>
  );
}

// Component for compass
function Compass({ bearing }) {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-2">
      <div 
        className="w-12 h-12 relative"
        style={{ transform: `rotate(${bearing}deg)` }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
          N
        </div>
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-red-500"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 h-6 bg-gray-400"></div>
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-6 h-0.5 bg-gray-400"></div>
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-6 h-0.5 bg-gray-400"></div>
      </div>
    </div>
  );
}

export function InteractiveMap({ 
  userLocation = null, 
  places = [], 
  selectedPlace = null, 
  route = null,
  center = null,
  zoom = 13,
  onPlaceClick = null,
  showUserLocation = true 
}) {
  const [mapCenter, setMapCenter] = useState([25.4358, 81.8463]); // Default to Prayagraj
  const [mapZoom, setMapZoom] = useState(zoom);
  const [isTracking, setIsTracking] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [liveLocation, setLiveLocation] = useState(userLocation);

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setLiveLocation(userLocation);
    } else if (center) {
      setMapCenter(center);
    }
  }, [userLocation, center]);

  // Auto-adjust map view when route is available
  useEffect(() => {
    if (route && route.routes && route.routes[0] && liveLocation) {
      const coordinates = route.routes[0].geometry.coordinates;
      
      // Find the closest point on the route to user's current location
      let closestIndex = 0;
      let minDistance = Infinity;
      
      coordinates.forEach((coord, index) => {
        const distance = calculateDistance(
          liveLocation.lat, liveLocation.lng,
          coord[1], coord[0]
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      // Calculate bearing based on route direction
      if (closestIndex < coordinates.length - 1) {
        const current = coordinates[closestIndex];
        const next = coordinates[closestIndex + 1];
        
        const routeBearing = calculateBearing(current[1], current[0], next[1], next[0]);
        setBearing(routeBearing);
        
        // Apply rotation to map
        const mapPane = document.querySelector('.leaflet-map-pane');
        if (mapPane) {
          mapPane.style.transform = `rotate(${routeBearing}deg)`;
        }
        
        // Zoom in on current route segment
        const segmentCenter = [
          (current[1] + next[1]) / 2,
          (current[0] + next[0]) / 2
        ];
        
        setMapCenter(segmentCenter);
        setMapZoom(17); // Zoom in for better navigation
        
        // Center map with smooth animation
        const mapContainer = document.querySelector('.leaflet-container');
        if (mapContainer && mapContainer._leaflet_map) {
          mapContainer._leaflet_map.flyTo(segmentCenter, 17, {
            duration: 1
          });
        }
      }
    }
  }, [route, liveLocation]);

  const handlePlaceClick = (place) => {
    if (onPlaceClick) {
      onPlaceClick(place);
    }
    // Center map on clicked place
    setMapCenter([place.lat, place.lon]);
    setMapZoom(16);
  };

  const handleLocationUpdate = (newLocation) => {
    setLiveLocation(newLocation);
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
  };

  const handleReset = () => {
    setBearing(0);
    setMapCenter([25.4358, 81.8463]);
    setMapZoom(13);
    
    // Reset map rotation
    const mapPane = document.querySelector('.leaflet-map-pane');
    if (mapPane) {
      mapPane.style.transform = 'rotate(0deg)';
    }
  };

  // Create custom icons for route markers
  const createStartIcon = () => {
    return L.divIcon({
      html: '<div style="background-color: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">S</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
      className: 'custom-div-icon'
    });
  };

  const createEndIcon = () => {
    return L.divIcon({
      html: '<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">E</div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
      className: 'custom-div-icon'
    });
  };

  // Get route start and end points
  const getRoutePoints = () => {
    if (!route || !route.routes || !route.routes[0]) return { start: null, end: null };
    
    const coordinates = route.routes[0].geometry.coordinates;
    if (coordinates.length === 0) return { start: null, end: null };
    
    return {
      start: [coordinates[0][1], coordinates[0][0]], // [lat, lng]
      end: [coordinates[coordinates.length - 1][1], coordinates[coordinates.length - 1][0]] // [lat, lng]
    };
  };

  const routePoints = getRoutePoints();

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border border-gray-300 relative">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">HOT</a>'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        
        <MapCenter center={mapCenter} zoom={mapZoom} />
        
        {/* Live location tracking */}
        <LiveLocationTracker 
          userLocation={userLocation}
          isTracking={isTracking}
          onLocationUpdate={handleLocationUpdate}
          route={route}
        />

        {/* Next turn popup */}
        <NextTurnPopup 
          route={route}
          userLocation={liveLocation}
        />

        {/* Interactive controls */}
        <MapControls 
          onReset={handleReset}
          isTracking={isTracking}
          toggleTracking={toggleTracking}
        />

        {/* Compass */}
        <Compass bearing={bearing} />

        {/* User location marker */}
        {showUserLocation && liveLocation && (
          <Marker position={[liveLocation.lat, liveLocation.lng]}>
            <Popup>
              <div className="text-sm">
                <strong>{isTracking ? '📍 Live Location' : 'Your Location'}</strong>
                <br />
                Accuracy: {liveLocation.accuracy ? `${Math.round(liveLocation.accuracy)}m` : 'Unknown'}
                {isTracking && <><br /><span className="text-green-600">● Tracking</span></>}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Place markers */}
        {places.map((place, index) => (
          <Marker 
            key={index} 
            position={[place.lat, place.lon]}
            eventHandlers={{
              click: () => handlePlaceClick(place)
            }}
          >
            <Popup>
              <div className="text-sm max-w-xs">
                <strong>{place.display_name || place.name}</strong>
                {place.category && (
                  <><br /><span className="text-gray-600">{place.category}</span></>
                )}
                {place.distance && (
                  <><br /><span className="text-blue-600">{Math.round(place.distance)}m away</span></>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Selected place marker */}
        {selectedPlace && (
          <Marker position={[selectedPlace.lat, selectedPlace.lng]}>
            <Popup>
              <div className="text-sm max-w-xs">
                <strong>{selectedPlace.display_name || selectedPlace.name}</strong>
                <br />
                <button 
                  className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                  onClick={() => handlePlaceClick(selectedPlace)}
                >
                  Select Place
                </button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route polyline */}
        {route && route.routes && route.routes[0] && (
          <Polyline
            positions={route.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])}
            color="blue"
            weight={4}
            opacity={0.7}
          />
        )}

        {/* Route start marker */}
        {routePoints.start && (
          <Marker position={routePoints.start} icon={createStartIcon()}>
            <Popup>
              <div className="text-sm">
                <strong>🚀 Start Point</strong>
                <br />
                Route beginning
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route end marker */}
        {routePoints.end && (
          <Marker position={routePoints.end} icon={createEndIcon()}>
            <Popup>
              <div className="text-sm">
                <strong>🎯 Destination</strong>
                <br />
                Route ending
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
