import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SearchService } from '../../services/searchService';

// Fix Leaflet marker icons in React bundles
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom origin and destination icons
const startIcon = L.divIcon({
  html: '<div style="background-color: #10b981; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4);">A</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
  className: 'fare-start-marker'
});

const endIcon = L.divIcon({
  html: '<div style="background-color: #ef4444; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4);">B</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
  className: 'fare-end-marker'
});

// Component to dynamically adjust map viewport to fit route or points
function MapBoundsUpdater({ from, to, routeCoords }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (routeCoords && routeCoords.length > 0) {
      const bounds = L.latLngBounds(routeCoords);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (from && to) {
      const bounds = L.latLngBounds([
        [from.lat, from.lng],
        [to.lat, to.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else if (from) {
      map.setView([from.lat, from.lng], 14);
    } else if (to) {
      map.setView([to.lat, to.lng], 14);
    }
  }, [map, from, to, routeCoords]);

  return null;
}

// Invalidate Leaflet size when entering or exiting fullscreen
function MapResizeHandler({ isFullscreen }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map, isFullscreen]);
  return null;
}

// Live GPS tracker
function LiveGPSWatcher({ isTracking, onLocationFound }) {
  const map = useMap();
  useEffect(() => {
    if (!isTracking || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocationFound?.(coords);
        map.setView([coords.lat, coords.lng], 16);
      },
      (err) => console.warn('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking, map, onLocationFound]);
  return null;
}

const userGpsIcon = L.divIcon({
  html: '<div style="background-color: #3b82f6; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59,130,246,0.8); display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; border-radius: 50%; background-color: white;"></div></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: 'live-gps-marker'
});

export function FareMap({ fromLocation, toLocation, onSelectLocation = null, onRouteChange = null }) {
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeInfo, setRouteInfo] = useState({ distanceKm: null, durationMin: null });
  const [routeLoading, setRouteLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  // Default center Prayagraj
  const defaultCenter = [25.4600, 81.8400];

  // Exit fullscreen on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Fetch real road route via OSRM whenever origin or destination changes
  useEffect(() => {
    if (!fromLocation?.lat || !fromLocation?.lng || !toLocation?.lat || !toLocation?.lng) {
      setRouteCoordinates([]);
      setRouteInfo({ distanceKm: null, durationMin: null });
      return;
    }

    let isMounted = true;
    setRouteLoading(true);

    const loadRoute = async () => {
      try {
        const response = await SearchService.calculateRoute(
          fromLocation.lat,
          fromLocation.lng,
          toLocation.lat,
          toLocation.lng,
          'driving'
        );

        if (!isMounted) return;

        if (response?.routes?.[0]?.geometry?.coordinates) {
          // OSRM returns coordinates as [lon, lat], Leaflet needs [lat, lon]
          const coords = response.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setRouteCoordinates(coords);

          const distanceMeters = response.routes[0].distance || 0;
          const durationSeconds = response.routes[0].duration || 0;

          const distKm = (distanceMeters / 1000).toFixed(1);
          const durMin = Math.max(1, Math.round(durationSeconds / 60));

          setRouteInfo({
            distanceKm: distKm,
            durationMin: durMin
          });
          onRouteChange?.({ distanceKm: parseFloat(distKm), durationMin: durMin });
        }
      } catch (err) {
        console.warn('OSRM routing failed, falling back to direct line:', err.message);
        if (!isMounted) return;
        // Fallback straight line
        setRouteCoordinates([
          [fromLocation.lat, fromLocation.lng],
          [toLocation.lat, toLocation.lng]
        ]);
        // Haversine fallback distance
        const R = 6371;
        const dLat = ((toLocation.lat - fromLocation.lat) * Math.PI) / 180;
        const dLon = ((toLocation.lng - fromLocation.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((fromLocation.lat * Math.PI) / 180) *
            Math.cos((toLocation.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const estDist = parseFloat((R * c * 1.25).toFixed(1)); // 25% road winding factor
        const estDur = Math.round(estDist * 2.5);
        setRouteInfo({
          distanceKm: estDist,
          durationMin: estDur
        });
        onRouteChange?.({ distanceKm: estDist, durationMin: estDur });
      } finally {
        if (isMounted) setRouteLoading(false);
      }
    };

    loadRoute();

    return () => {
      isMounted = false;
    };
  }, [fromLocation, toLocation, onRouteChange]);

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[5000] w-screen h-screen rounded-none border-0'
          : 'relative z-10 w-full h-[360px] md:h-[440px] rounded-2xl border border-white/20 shadow-2xl'
      } overflow-hidden bg-card transition-all`}
    >
      <MapContainer
        center={fromLocation ? [fromLocation.lat, fromLocation.lng] : defaultCenter}
        zoom={13}
        className="w-full h-full z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/">HOT</a>'
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapBoundsUpdater
          from={fromLocation}
          to={toLocation}
          routeCoords={routeCoordinates}
        />

        <MapResizeHandler isFullscreen={isFullscreen} />

        <LiveGPSWatcher
          isTracking={isLiveTracking}
          onLocationFound={setUserCoords}
        />

        {/* Origin Marker */}
        {fromLocation?.lat && fromLocation?.lng && (
          <Marker position={[fromLocation.lat, fromLocation.lng]} icon={startIcon}>
            <Popup>
              <div className="text-sm font-sans p-1">
                <span className="font-bold text-emerald-600 block">🟢 Pickup Point (A)</span>
                <span className="text-gray-800 font-medium">{fromLocation.name || 'Origin'}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Marker */}
        {toLocation?.lat && toLocation?.lng && (
          <Marker position={[toLocation.lat, toLocation.lng]} icon={endIcon}>
            <Popup>
              <div className="text-sm font-sans p-1">
                <span className="font-bold text-red-600 block">🔴 Drop Point (B)</span>
                <span className="text-gray-800 font-medium">{toLocation.name || 'Destination'}</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Live User Location GPS Marker */}
        {userCoords && (
          <Marker position={[userCoords.lat, userCoords.lng]} icon={userGpsIcon}>
            <Popup>
              <div className="text-xs font-sans p-1 text-gray-800">
                <span className="font-bold text-blue-600 block">📍 Your Live Position</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#3b82f6',
              weight: isFullscreen ? 6 : 5,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}
      </MapContainer>

      {/* Top Left Navigation Action Buttons */}
      <div className="absolute top-3 left-3 z-[25] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsFullscreen(prev => !prev)}
          className={`px-3 py-2 rounded-xl backdrop-blur-md text-xs font-bold shadow-xl border flex items-center gap-1.5 transition-all ${
            isFullscreen
              ? 'bg-rose-600 text-white border-rose-500 hover:bg-rose-700'
              : 'bg-slate-900/90 text-white border-white/20 hover:bg-slate-800'
          }`}
          title={isFullscreen ? 'Exit Full Screen' : 'Toggle Live Navigation Full Screen'}
        >
          <span>{isFullscreen ? '✕' : '⛶'}</span>
          <span>{isFullscreen ? 'Exit Fullscreen (Esc)' : 'Live Navigation Mode'}</span>
        </button>

        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsLiveTracking(prev => !prev)}
            className={`px-3 py-2 rounded-xl backdrop-blur-md text-xs font-bold shadow-xl border flex items-center gap-1.5 transition-all ${
              isLiveTracking
                ? 'bg-blue-600 text-white border-blue-500 animate-pulse'
                : 'bg-slate-900/90 text-white border-white/20 hover:bg-slate-800'
            }`}
            title="Track my live GPS location on map"
          >
            <span>📍</span>
            <span>{isLiveTracking ? 'Tracking Live GPS...' : 'Follow My Location'}</span>
          </button>
        )}
      </div>

      {/* Fullscreen Route Header Bar */}
      {isFullscreen && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[25] hidden md:flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/15 text-xs text-white shadow-xl max-w-lg truncate">
          <span className="text-emerald-400 font-bold">{fromLocation?.shortName || fromLocation?.name || 'Origin'}</span>
          <span className="text-primary font-bold">→</span>
          <span className="text-rose-400 font-bold">{toLocation?.shortName || toLocation?.name || 'Destination'}</span>
        </div>
      )}

      {/* Floating Route Info Overlay */}
      {routeInfo.distanceKm && (
        <div className="absolute top-3 right-3 z-[20] bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl border border-white/15 shadow-xl flex items-center gap-4 text-xs md:text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🛣️</span>
            <div>
              <p className="text-[10px] text-white/60 uppercase font-semibold">Distance</p>
              <p className="font-bold text-blue-400">{routeInfo.distanceKm} km</p>
            </div>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-lg">⏱️</span>
            <div>
              <p className="text-[10px] text-white/60 uppercase font-semibold">Est. Time</p>
              <p className="font-bold text-amber-400">~{routeInfo.durationMin} mins</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator for routing */}
      {routeLoading && (
        <div className="absolute bottom-3 left-3 z-[20] bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Calculating road route...</span>
        </div>
      )}
    </div>
  );
}

