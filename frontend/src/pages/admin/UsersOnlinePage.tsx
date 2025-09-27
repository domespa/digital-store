import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { useRealTimeUsers } from "../../hooks/useRealTimeUsers";

export default function UsersOnlinePage() {
  const { onlineUsers, loading, error } = useRealTimeUsers();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsers = onlineUsers.filter(
    (user) =>
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.location?.country
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      user.location?.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const time = new Date(timestamp).getTime();
    const diff = now - time;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    return `${hours}h ago`;
  };

  const getUserDisplayName = (user: any) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.email) {
      return user.email;
    }
    return "Anonymous User";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center">
          <p className="text-red-600">Error loading online users: {error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users Online</h1>
          <p className="text-gray-600">
            {onlineUsers.length} users currently browsing
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {/* SEARCH */}
      <Card>
        <Input
          placeholder="Search users by name, email, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Card>

      {/* USERS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredUsers.map((user) => (
          <Card key={user.sessionId}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                    user.isAuthenticated ? "bg-blue-500" : "bg-gray-400"
                  }`}
                >
                  {user.isAuthenticated ? "👤" : "👤"}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    {getUserDisplayName(user)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    📍 {user.location?.city}, {user.location?.country}
                  </p>
                  <p className="text-sm text-gray-500">🌐 {user.currentPage}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge
                      variant={user.isAuthenticated ? "success" : "default"}
                    >
                      {user.isAuthenticated ? "Registered" : "Guest"}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Active {formatTimeAgo(user.lastActivity)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">
                  Connected {formatTimeAgo(user.connectedAt)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {user.ipAddress}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm
                ? "No users found matching your search."
                : "No users currently online."}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
