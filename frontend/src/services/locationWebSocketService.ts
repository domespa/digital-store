import { io, Socket } from "socket.io-client";

interface LocationData {
  country: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  countryCode?: string;
  timezone?: string;
}

class LocationWebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private locationData: LocationData | null = null;

  connect() {
    if (this.socket?.connected) {
      console.log("Location WebSocket already connected");
      return;
    }

    this.socket = io("http://localhost:3001", {
      path: "/location/socket.io/",
      transports: ["websocket", "polling"],
      autoConnect: true,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Connected to location tracking service");
      this.reconnectAttempts = 0;

      if (this.locationData) {
        console.log("Sending stored location data to backend");
        this.sendLocationData(this.locationData);
      } else {
        console.log("No location data available to send");
      }
    });

    this.socket.on(
      "location_received",
      (response: { success: boolean; error?: string }) => {
        if (response.success) {
          console.log("Location successfully sent to backend");
        } else {
          console.error("Failed to send location:", response.error);
        }
      }
    );

    this.socket.on("disconnect", (reason: string) => {
      console.log("Disconnected from location tracking:", reason);
    });

    this.socket.on("connect_error", (error: Error) => {
      console.error("Location WebSocket connection error:", error);
      this.handleReconnect();
    });

    this.socket.on("pong", () => {});

    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit("ping");
      }
    }, 25000);
  }

  setLocationData(locationData: LocationData) {
    console.log("Location data received from external source:", locationData);
    this.locationData = locationData;

    if (this.socket?.connected) {
      this.sendLocationData(locationData);
    }
  }

  private sendLocationData(locationData: LocationData) {
    try {
      if (!this.socket?.connected) {
        console.warn("Socket not connected, cannot send location");
        return;
      }

      console.log("Sending location data to backend:", locationData);
      this.socket.emit("send_location", locationData);
    } catch (error) {
      console.error("Failed to send location data:", error);
    }
  }

  async sendCurrentLocation(externalLocationData?: LocationData) {
    if (externalLocationData) {
      this.setLocationData(externalLocationData);
      return;
    }

    if (!this.locationData) {
      console.warn("No location data available and no external data provided");
      return;
    }

    this.sendLocationData(this.locationData);
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        if (!this.socket?.connected) {
          this.connect();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  disconnect() {
    if (this.socket) {
      console.log("Disconnecting from location tracking service");
      this.socket.disconnect();
      this.socket = null;
    }

    this.locationData = null;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getStatus() {
    return {
      connected: this.isConnected(),
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
      hasLocationData: !!this.locationData,
    };
  }

  getCurrentLocationData(): LocationData | null {
    return this.locationData;
  }
}

export default new LocationWebSocketService();
