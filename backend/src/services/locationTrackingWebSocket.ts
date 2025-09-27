import { Server, Socket } from "socket.io";
import { Server as HTTPServer } from "http";

interface LocationData {
  country: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  socketId: string;
}

class LocationTrackingWebSocket {
  private io: Server;
  private userLocations = new Map<string, LocationData>();
  private mainWebSocketService: any; // ANY PER ADESSO

  constructor(httpServer: HTTPServer, path: string = "/location") {
    this.io = new Server(httpServer, {
      path,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    this.setupEventHandlers();

    this.mainWebSocketService = (globalThis as any).webSocketService;

    // **DEBUG: Log initialization**
    console.log("🗺️ LocationTrackingWebSocket initialized");
    console.log(
      "🔗 Main WebSocket service available:",
      !!this.mainWebSocketService
    );
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`📍 Location tracking client connected: ${socket.id}`);

      socket.on("send_location", (locationData: any) => {
        try {
          console.log(`📍 Location received from ${socket.id}:`, locationData);

          const storedData: LocationData = {
            ...locationData,
            timestamp: new Date(),
            socketId: socket.id,
          };

          this.userLocations.set(socket.id, storedData);

          socket.emit("location_received", { success: true });

          if (this.mainWebSocketService) {
            console.log(
              `📡 Notifying admin dashboard of new user: ${socket.id}`
            );
            this.mainWebSocketService.broadcastToAdmins("user_connected", {
              user: {
                sessionId: socket.id,
                location: {
                  country: locationData.country,
                  city: locationData.city,
                  region: locationData.region,
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                  countryCode: locationData.countryCode,
                  timezone: locationData.timezone,
                },
                connectedAt: new Date().toISOString(),
                currentPage: "homepage",
                lastActivity: new Date().toISOString(),
                userAgent: socket.handshake.headers["user-agent"] || "Unknown",
                ip: socket.handshake.address || "Unknown",
              },
            });
          } else {
            console.warn(
              "⚠️ Main WebSocket service not available for admin notifications"
            );
          }
        } catch (error) {
          console.error("❌ Error handling location:", error);
          socket.emit("location_received", {
            success: false,
            error: "Failed to save location",
          });
        }
      });

      socket.on("disconnect", (reason: string) => {
        if (this.userLocations.has(socket.id)) {
          const location = this.userLocations.get(socket.id);
          console.log(
            `🔄 Removing location for ${socket.id}: ${location?.city}, ${location?.country}`
          );
          this.userLocations.delete(socket.id);
          console.log(`🗺️ Remaining locations: ${this.userLocations.size}`);
        }

        console.log(
          `📍 Location tracking client disconnected: ${socket.id}, reason: ${reason}`
        );

        if (this.mainWebSocketService) {
          console.log(
            `📡 Notifying admin dashboard of user disconnect: ${socket.id}`
          );
          this.mainWebSocketService.broadcastToAdmins("user_disconnected", {
            sessionId: socket.id,
            disconnectReason: reason,
            disconnectedAt: new Date().toISOString(),
          });
        }
      });

      socket.on("user_activity", (data: any) => {
        if (this.userLocations.has(socket.id)) {
          const locationData = this.userLocations.get(socket.id);
          if (locationData) {
            locationData.timestamp = new Date();
            this.userLocations.set(socket.id, locationData);
            console.log(
              `🔄 Updated activity for ${socket.id}: ${data.page || "unknown"}`
            );
          }

          if (this.mainWebSocketService) {
            this.mainWebSocketService.broadcastToAdmins("user_activity", {
              sessionId: socket.id,
              page: data.page || "unknown",
              timestamp: new Date().toISOString(),
              action: data.action || "page_view",
            });
          }
        }
      });

      socket.on("ping", () => {
        socket.emit("pong");

        if (this.userLocations.has(socket.id)) {
          const locationData = this.userLocations.get(socket.id);
          if (locationData) {
            locationData.timestamp = new Date();
            this.userLocations.set(socket.id, locationData);
          }
        }
      });
    });
  }

  getOnlineUserLocations(): LocationData[] {
    const locations = Array.from(this.userLocations.values());
    console.log(
      `🔍 getOnlineUserLocations called - returning ${locations.length} locations`
    );
    return locations;
  }

  getUserLocation(socketId: string): LocationData | null {
    const location = this.userLocations.get(socketId) || null;
    console.log(
      `🔍 getUserLocation called for ${socketId}:`,
      location ? `${location.city}, ${location.country}` : "NOT FOUND"
    );
    return location;
  }

  getLocationStats() {
    const locations = Array.from(this.userLocations.values());
    const countries = new Set(locations.map((l) => l.country));
    const cities = new Set(locations.map((l) => `${l.city}, ${l.country}`));

    const stats = {
      totalOnlineUsers: locations.length,
      uniqueCountries: countries.size,
      uniqueCities: cities.size,
      countries: Array.from(countries),
      cities: Array.from(cities),
      locations: locations,
      lastUpdate: new Date(),
    };

    console.log(`📊 getLocationStats called:`, {
      totalOnlineUsers: stats.totalOnlineUsers,
      uniqueCountries: stats.uniqueCountries,
      uniqueCities: stats.uniqueCities,
    });

    return stats;
  }

  testAdminNotification() {
    if (this.mainWebSocketService) {
      this.mainWebSocketService.broadcastToAdmins("system", {
        message: "Location tracking system test",
        timestamp: new Date().toISOString(),
        connectedUsers: this.userLocations.size,
      });
      console.log("📡 Admin notification test sent");
      return true;
    }
    console.log(
      "❌ Cannot send admin notification - main service not available"
    );
    return false;
  }

  // CLEAN
  cleanup(): void {
    if (this.mainWebSocketService) {
      this.mainWebSocketService.broadcastToAdmins("system", {
        message: "Location tracking system shutting down",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      "🧹 LocationTrackingWebSocket cleanup - clearing",
      this.userLocations.size,
      "locations"
    );
    this.userLocations.clear();
    this.io.close();
  }

  getConnectedCount(): number {
    return this.userLocations.size;
  }

  isMainWebSocketAvailable(): boolean {
    return !!this.mainWebSocketService;
  }
}

export default LocationTrackingWebSocket;
