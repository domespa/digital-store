import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useRealTimeUsers } from "../../hooks/useRealTimeUsers";

export default function UserMapPage() {
  const { onlineUsers, userSessions, loading } = useRealTimeUsers();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const countryData = [...onlineUsers, ...userSessions].reduce(
    (acc: any, user: any) => {
      const country = user.location.country;
      if (!acc[country]) {
        acc[country] = {
          country,
          onlineUsers: 0,
          totalSessions: 0,
          cities: new Set(),
        };
      }

      if (onlineUsers.includes(user)) {
        acc[country].onlineUsers++;
      }
      acc[country].totalSessions++;
      acc[country].cities.add(user.location.city);

      return acc;
    },
    {}
  );

  const countries = Object.values(countryData).sort(
    (a: any, b: any) =>
      b.onlineUsers - a.onlineUsers || b.totalSessions - a.totalSessions
  );

  // MAPPA
  const MapVisualization = () => (
    <div className="bg-gray-100 rounded-lg p-8 text-center relative overflow-hidden">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🗺️ World Map</h3>

      {/* PROVA */}
      <div className="relative h-64 bg-gradient-to-b from-blue-100 to-green-100 rounded-lg">
        {countries.map((country: any, index) => (
          <div
            key={country.country}
            className={`absolute w-4 h-4 rounded-full cursor-pointer transition-all ${
              selectedCountry === country.country
                ? "bg-red-500 scale-150"
                : "bg-blue-500 hover:bg-blue-600"
            }`}
            style={{
              left: `${20 + ((index * 15) % 60)}%`,
              top: `${30 + ((index * 10) % 40)}%`,
            }}
            onClick={() =>
              setSelectedCountry(
                selectedCountry === country.country ? null : country.country
              )
            }
            title={`${country.country}: ${country.onlineUsers} online, ${country.totalSessions} total`}
          >
            {country.onlineUsers > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-gray-600 mt-4">
        Click on dots to view country details • 🔴 = Selected • 🟢 = Online
        users
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          User Geographic Map
        </h1>
        <p className="text-gray-600">
          Real-time view of user locations and session history
        </p>
      </div>

      {/* MAPPA */}
      <Card padding={false}>
        <div className="p-6">
          <MapVisualization />
        </div>
      </Card>

      {/* LISTA NAZIONI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📊 Countries Overview
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {countries.map((country: any) => (
              <div
                key={country.country}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedCountry === country.country
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-gray-50 hover:bg-gray-100"
                }`}
                onClick={() =>
                  setSelectedCountry(
                    selectedCountry === country.country ? null : country.country
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {country.country}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {Array.from(country.cities).join(", ")}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Badge
                      variant={country.onlineUsers > 0 ? "success" : "default"}
                    >
                      {country.onlineUsers} online
                    </Badge>
                    <Badge variant="info">{country.totalSessions} total</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* DETTAGLI NAZIONI */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🔍{" "}
            {selectedCountry
              ? `${selectedCountry} Details`
              : "Select a Country"}
          </h3>

          {selectedCountry ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">
                  Online Users:
                </h4>
                <div className="space-y-2">
                  {onlineUsers
                    .filter((user) => user.location.country === selectedCountry)
                    .map((user) => (
                      <div
                        key={user.sessionId}
                        className="flex items-center justify-between p-2 bg-green-50 rounded"
                      >
                        <span className="text-sm">
                          {user.email || "Anonymous"} • {user.location.city}
                        </span>
                        <Badge variant="success">Online</Badge>
                      </div>
                    ))}
                </div>
              </div>

              {/* RECENTI */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">
                  Recent Sessions:
                </h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {userSessions
                    .filter(
                      (session) => session.location.country === selectedCountry
                    )
                    .slice(0, 5)
                    .map((session) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <span className="text-sm">
                          {session.location.city} •{" "}
                          {new Date(session.startTime).toLocaleString()}
                        </span>
                        <Badge
                          variant={session.isActive ? "success" : "default"}
                        >
                          {session.isActive ? "Active" : "Ended"}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">
              Click on a country in the map or list to view details.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
