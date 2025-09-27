import { useState, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useRealTimeUsers } from "../../hooks/useRealTimeUsers";

import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface UserLocation {
  country: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  users: any[];
  sessionId: string;
}

interface CountryStats {
  country: string;
  totalUsers: number;
  cities: Set<string>;
  users: any[];
  avgLatitude: number;
  avgLongitude: number;
}

// Custom marker icons
const createCustomIcon = (count: number, isSelected: boolean = false) => {
  const size = Math.max(25, Math.min(45, 20 + count * 3));
  const color = isSelected
    ? "#ef4444"
    : count > 5
    ? "#f97316"
    : count > 1
    ? "#eab308"
    : "#22c55e";

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
      ">
        <!-- Pulse ring -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${size + 20}px;
          height: ${size + 20}px;
          background: ${color};
          border-radius: 50%;
          opacity: 0.3;
          transform: translate(-50%, -50%);
          animation: pulse 2s infinite;
        "></div>
        
        <!-- Main marker -->
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: ${Math.max(10, Math.min(16, 8 + count))}px;
          transform: translate(-50%, -50%);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s;
          cursor: pointer;
        ">
          ${count}
        </div>
      </div>
      
      <style>
        @keyframes pulse {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1); 
            opacity: 0.3; 
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.2); 
            opacity: 0.1; 
          }
        }
        .custom-marker:hover div:last-child {
          transform: translate(-50%, -50%) scale(1.1) !important;
        }
      </style>
    `,
    iconSize: [size + 20, size + 20],
    iconAnchor: [(size + 20) / 2, (size + 20) / 2],
  });
};

const mapStyles = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '© <a href="https://www.esri.com/">Esri</a>',
  },
};

export default function UserMapPage() {
  const { onlineUsers, loading, isWebSocketConnected, refreshData } =
    useRealTimeUsers();
  const [selectedLocation, setSelectedLocation] = useState<UserLocation | null>(
    null
  );
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mapStyle, setMapStyle] = useState<keyof typeof mapStyles>("dark");
  const mapRef = useRef<any>(null);

  // Process data
  const { userLocations, countryStats, totalOnline } = useMemo(() => {
    console.log("🔍 Processing onlineUsers:", onlineUsers);

    const locationMap: Record<string, UserLocation> = {};
    const countryMap: Record<string, CountryStats> = {};

    (onlineUsers || []).forEach((user, index) => {
      console.log(`👤 User ${index}:`, user);

      if (!user?.location?.country) {
        console.warn(
          `❌ User ${index} missing location country:`,
          user?.location
        );
        return;
      }

      const { country, city, region, latitude, longitude } = user.location;

      const realLatitude =
        latitude || (country === "Italy" ? 41.8719 : 40.7128);
      const realLongitude =
        longitude || (country === "Italy" ? 12.5674 : -74.006);

      const locationKey = `${city}-${country}-${realLatitude.toFixed(
        2
      )}-${realLongitude.toFixed(2)}`;

      console.log(
        `✅ Processing user location: ${locationKey} (coords: ${realLatitude}, ${realLongitude})`
      );

      if (!locationMap[locationKey]) {
        locationMap[locationKey] = {
          country,
          city: city || "Unknown",
          region: region || "Unknown",
          latitude: realLatitude,
          longitude: realLongitude,
          users: [],
          sessionId: user.sessionId,
        };
      }
      locationMap[locationKey].users.push(user);

      if (!countryMap[country]) {
        countryMap[country] = {
          country,
          totalUsers: 0,
          cities: new Set(),
          users: [],
          avgLatitude: 0,
          avgLongitude: 0,
        };
      }

      countryMap[country].totalUsers++;
      countryMap[country].users.push(user);
      countryMap[country].cities.add(city || "Unknown");
    });

    Object.values(countryMap).forEach((stat) => {
      const locations = stat.users.map((u) => u.location);
      stat.avgLatitude =
        locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length;
      stat.avgLongitude =
        locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length;
    });

    const result = {
      userLocations: Object.values(locationMap),
      countryStats: Object.values(countryMap).sort(
        (a, b) => b.totalUsers - a.totalUsers
      ),
      totalOnline: Object.values(locationMap).reduce(
        (sum, loc) => sum + loc.users.length,
        0
      ),
    };

    console.log("🎯 Processing result:", result);

    return result;
  }, [onlineUsers]);

  const flyToLocation = (lat: number, lng: number, zoom: number = 6) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], zoom, {
        animate: true,
        duration: 1.5,
      });
    }
  };

  const handleCountryClick = (country: CountryStats) => {
    setSelectedCountry(country.country);
    flyToLocation(country.avgLatitude, country.avgLongitude, 5);
  };

  const handleMarkerClick = (location: UserLocation) => {
    setSelectedLocation(location);
    flyToLocation(location.latitude, location.longitude, 8);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-gray-300 rounded mb-4"></div>
        <div className="h-[600px] bg-gray-300 rounded-xl"></div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-300 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            User Tracking
          </h1>
          <p className="text-gray-600 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isWebSocketConnected() ? "bg-green-500" : "bg-red-500"
              }`}
            ></span>
            {isWebSocketConnected() ? "Conection Active" : "Connection Lost"} -
            Last update: {new Date().toLocaleTimeString()}
          </p>
        </div>

        {/* Map Style Switcher */}
        <div className="flex gap-2 mt-4 md:mt-0">
          {/* Refresh button */}
          <button
            onClick={() => refreshData && refreshData()}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            disabled={loading}
          >
            {loading ? "🔄" : "↻"} Refresh
          </button>

          {/* Map Style Switcher */}
          {(Object.keys(mapStyles) as Array<keyof typeof mapStyles>).map(
            (style) => (
              <button
                key={style}
                onClick={() => setMapStyle(style)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mapStyle === style
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {style.charAt(0).toUpperCase() + style.slice(1)}
              </button>
            )
          )}
        </div>
      </div>
      {/* Main Map */}
      <Card padding={false} className="overflow-hidden shadow-2xl">
        <div className="h-[500px] w-full relative">
          <MapContainer
            ref={mapRef}
            center={[30, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            className="z-10"
            zoomControl={true}
            scrollWheelZoom={true}
            dragging={true}
            doubleClickZoom={true}
          >
            <TileLayer
              attribution={mapStyles[mapStyle].attribution}
              url={mapStyles[mapStyle].url}
              maxZoom={18}
              subdomains={["a", "b", "c"]}
            />

            {/* User markers */}
            {userLocations.map((location, index) => (
              <Marker
                key={`${location.sessionId}-${index}`}
                position={[location.latitude, location.longitude]}
                icon={createCustomIcon(
                  location.users.length,
                  selectedLocation?.sessionId === location.sessionId
                )}
                eventHandlers={{
                  click: () => handleMarkerClick(location),
                }}
              >
                <Popup maxWidth={300} className="custom-popup">
                  <div className="p-4 min-w-[250px]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{location.city}</h3>
                        <p className=" text-sm">
                          {location.country} - {location.region}
                        </p>
                      </div>
                      <Badge variant="success">LIVE</Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span className="font-medium">Active Users:</span>
                        <span className="font-bold text-green-600">
                          {location.users.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Country heatmap circles for high-traffic areas */}
            {countryStats
              .filter((stat) => stat.totalUsers > 3)
              .map((stat, index) => (
                <CircleMarker
                  key={`heat-${stat.country}-${index}`}
                  center={[stat.avgLatitude, stat.avgLongitude]}
                  radius={Math.min(30, stat.totalUsers * 3)}
                  pathOptions={{
                    fillColor: "#22c55e",
                    color: "#16a34a",
                    weight: 2,
                    opacity: 0.6,
                    fillOpacity: 0.2,
                  }}
                >
                  <Popup>
                    <div className="text-center p-2">
                      <h4 className="font-bold text-lg">{stat.country}</h4>
                      <p className="text-sm text-gray-600">
                        High Activity Zone
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        {stat.totalUsers} users
                      </p>
                      <p className="text-xs text-gray-500">
                        {stat.cities.size} cities active
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>

          {/* Map overlay controls */}
          <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2">
            <div className="text-xs text-gray-600 text-center mb-1">
              Zoom Level
            </div>
            <div className="flex flex-col space-y-1">
              <button
                onClick={() => flyToLocation(30, 0, 2)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                World
              </button>
              {countryStats[0] && (
                <button
                  onClick={() => handleCountryClick(countryStats[0])}
                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                >
                  Top Country
                </button>
              )}
            </div>
          </div>

          {/* Live indicator */}
          <div className="absolute top-3 left-15 z-[1000]">
            <div className="bg-white px-3 py-2 rounded-2xl shadow-lg">
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  <span className="absolute inline-flex w-3 h-3 rounded-full bg-green-500 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-green-600"></span>
                </div>
                <span className="font-semibold text-xs tracking-wide text-gray-700">
                  LIVE TRACKING
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white transform transition-transform hover:scale-101">
          <div className="p-2 text-center">
            <div className="text-green-100">👤Users Online</div>
            <div className="text-2xl font-bold mb-1">{totalOnline}</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white transform transition-transform hover:scale-101">
          <div className="p-2 text-center">
            <div className="text-blue-100">🌍 Countries Active</div>
            <div className="text-2xl font-bold mb-1">{countryStats.length}</div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white transform transition-transform hover:scale-101">
          <div className="p-2 text-center">
            <div className="text-purple-100">🏆 Top Location</div>
            <div className="text-2xl font-bold mb-1 truncate">
              {countryStats[0]?.country || "N/A"}
            </div>
          </div>
        </Card>
      </div>

      {/* Countries List & Activity */}
      {countryStats.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🌍 Active Locations
              <Badge variant="success">{totalOnline} LIVE</Badge>
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {countryStats.map((stat, index) => (
                <div
                  key={stat.country}
                  className={`p-4 rounded-lg transition-all cursor-pointer border-2 ${
                    selectedCountry === stat.country
                      ? "bg-blue-50 border-blue-300 shadow-md transform scale-[1.02]"
                      : "bg-gray-50 hover:bg-gray-100 border-transparent hover:border-gray-300 hover:shadow-sm"
                  }`}
                  onClick={() => handleCountryClick(stat)}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-gray-400">
                          #{index + 1}
                        </span>
                        <div>
                          <h3 className="font-bold text-lg">{stat.country}</h3>
                          <p className="text-sm text-gray-600">
                            {Array.from(stat.cities).slice(0, 2).join(", ")}
                            {stat.cities.size > 2 &&
                              ` +${stat.cities.size - 2} more`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          stat.totalUsers > 10
                            ? "success"
                            : stat.totalUsers > 5
                            ? "warning"
                            : "default"
                        }
                      >
                        {stat.totalUsers}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {stat.cities.size}{" "}
                        {stat.cities.size === 1 ? "city" : "cities"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Real-time Activity Feed */}
          <Card>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              ⚡ Live Activity
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            </h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {userLocations
                .slice(-10)
                .reverse()
                .map((location, index) => (
                  <div
                    key={`activity-${location.sessionId}-${index}`}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:from-blue-50 hover:to-blue-100 cursor-pointer transition-all transform hover:scale-[1.02]"
                    onClick={() => handleMarkerClick(location)}
                  >
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">
                        {location.city}, {location.country}
                      </p>
                      <p className="text-sm text-gray-600">
                        {location.users.length}{" "}
                        {location.users.length === 1 ? "visitor" : "visitors"}{" "}
                        active
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="success">LIVE</Badge>
                      <p className="text-xs text-gray-400 mt-1">Just now</p>
                    </div>
                  </div>
                ))}

              {userLocations.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">🌍</div>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">
                    Waiting for visitors...
                  </h3>
                  <p className="text-gray-500">
                    Users will appear on the map when they visit your site
                  </p>
                  <div className="mt-4 inline-flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>System ready for tracking</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
