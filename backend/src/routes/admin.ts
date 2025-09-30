import { Router, Request, Response } from "express";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsAdmin,
} from "../controllers/productController";
import {
  updateOrderStatus,
  getOrdersAdmin,
} from "../controllers/orderController";
import { requireAuthenticatedAdmin } from "../middleware/auth";
import WebSocketService from "../services/websocketService";
import { AnalyticsService } from "../services/analyticsService";
import { prisma } from "../utils/prisma";

const router = Router();

declare global {
  namespace NodeJS {
    interface Global {
      webSocketService: WebSocketService;
    }
  }

  interface GlobalThis {
    webSocketService: WebSocketService;
  }
}

// APPLICHIAMO IL MIDDLEWARE ADMIN A TUTTE LE ROTTE!
router.use(requireAuthenticatedAdmin);

// LISTA PRODOTTI CON PATH
// GET /api/admin/products
router.get("/products", getProductsAdmin);

// CREA PRODOTTO
// POST /api/admin/products
router.post("/products", createProduct);

// MODIFICA PRODOTTO
// PUT /api/admin/products/:id
router.put("/products/:id", updateProduct);

// ELIMINAZIONE SOFT
// DELETE /api/admin/products/:id
router.delete("/products/:id", deleteProduct);

// ORDINE
// GET /api/admin/orders
router.get("/orders", getOrdersAdmin);
// PUT /api/admin/orders/:id/status
router.put("/orders/:id/status", updateOrderStatus);

// ONLINE USERS
// GET /api/admin/users/online
router.get("/users/online", async (req, res) => {
  console.log("🔍 ADMIN ENDPOINT CHIAMATO");
  try {
    const webSocketService = (globalThis as any).webSocketService;
    const locationTrackingService = (globalThis as any).locationTrackingService;

    console.log("🔍 webSocketService disponibile:", !!webSocketService);
    console.log(
      "🔍 locationTrackingService disponibile:",
      !!locationTrackingService
    );

    if (!webSocketService) {
      console.error("❌ WebSocket service not available");
      return res.status(500).json({
        success: false,
        error: "WebSocket service not available",
      });
    }

    const stats = await webSocketService.getConnectionStats();
    const onlineCount = webSocketService.getOnlineUsersCount();

    interface LocationData {
      country: string;
      city: string;
      region: string;
      latitude: number;
      longitude: number;
      timestamp: Date;
      socketId: string;
    }

    const liveLocations: LocationData[] = locationTrackingService
      ? locationTrackingService.getOnlineUserLocations()
      : [];

    console.log(
      "📍 Live locations from tracking service:",
      liveLocations.length
    );

    const recentConnections = await prisma.webSocketConnection.findMany({
      where: {
        isActive: true,
        lastPing: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            lastActivity: true,
          },
        },
      },
      take: 100,
      orderBy: {
        lastPing: "desc",
      },
    });

    console.log("🔍 DETAILED DEBUG:");
    console.log("- locationTrackingService exists:", !!locationTrackingService);
    console.log("- liveLocations count:", liveLocations.length);
    console.log("- recentConnections count:", recentConnections.length);

    const getMostRecentLocation = (): LocationData | null => {
      if (liveLocations.length === 0) return null;

      const sortedLocations = liveLocations.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      console.log("🎯 Most recent location:", {
        city: sortedLocations[0].city,
        country: sortedLocations[0].country,
        coords: `${sortedLocations[0].latitude}, ${sortedLocations[0].longitude}`,
        timestamp: sortedLocations[0].timestamp,
      });

      return sortedLocations[0];
    };

    const mostRecentLocation = getMostRecentLocation();

    const onlineUsers = recentConnections
      .filter((conn) => conn.user)
      .map((conn) => {
        console.log(
          `🔍 Using most recent location data for user ${conn.user!.email}`
        );

        const location = mostRecentLocation
          ? {
              country: mostRecentLocation.country,
              city: mostRecentLocation.city,
              region: mostRecentLocation.region,
              latitude: mostRecentLocation.latitude,
              longitude: mostRecentLocation.longitude,
            }
          : {
              country: "Italy",
              city: "Catania",
              region: "Sicily",
              latitude: 37.5647,
              longitude: 15.0631,
            };

        console.log(
          `📍 User ${conn.user!.email} location:`,
          `${location.city}-${location.country}-${location.latitude}-${location.longitude}`
        );

        return {
          id: conn.user!.id,
          email: conn.user!.email,
          firstName: conn.user!.firstName,
          lastName: conn.user!.lastName,
          sessionId: conn.socketId,
          ipAddress: conn.ipAddress,
          userAgent: conn.userAgent,
          location,
          currentPage: "/dashboard",
          connectedAt: conn.connectedAt.toISOString(),
          lastActivity: conn.lastPing.toISOString(),
          isAuthenticated: true,
        };
      });

    const anonymousVisitors = liveLocations.map(
      (loc: LocationData, index: number) => ({
        id: `anonymous-${loc.socketId}`,
        email: "anonymous@visitor.com",
        firstName: "Anonymous",
        lastName: `Visitor ${index + 1}`,
        sessionId: loc.socketId,
        ipAddress: "unknown",
        userAgent: "unknown",
        location: {
          country: loc.country,
          city: loc.city,
          region: loc.region,
          latitude: loc.latitude,
          longitude: loc.longitude,
        },
        currentPage: "/",
        connectedAt: loc.timestamp.toISOString(),
        lastActivity: loc.timestamp.toISOString(),
        isAuthenticated: false,
      })
    );

    const allUsers = [...onlineUsers, ...anonymousVisitors];

    console.log(
      `✅ Returning ${allUsers.length} users (${onlineUsers.length} authenticated + ${anonymousVisitors.length} anonymous)`
    );
    console.log("🗺️ Location summary:", {
      mostRecentLocation: mostRecentLocation
        ? `${mostRecentLocation.city}, ${mostRecentLocation.country}`
        : "No location data",
      totalLocationData: liveLocations.length,
    });

    res.json({
      success: true,
      users: allUsers,
      total: allUsers.length,
      stats: {
        totalOnline: onlineCount,
        totalConnections: stats.totalConnections,
        averageConnectionsPerUser: stats.averageConnectionsPerUser,
        authenticated: onlineUsers.length,
        anonymous: anonymousVisitors.length,
        locationDataAvailable: liveLocations.length > 0,
      },
    });
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch online users",
    });
  }
});

// USERS SESSIONS
router.get("/users/sessions", async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId, isActive } = req.query;

    const sessions = await prisma.webSocketConnection.findMany({
      where: {
        ...(userId ? { userId: userId as string } : {}),
        ...(isActive === "true" ? { isActive: true } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            lastActivity: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: {
        connectedAt: "desc",
      },
      take: Number(limit),
      skip: Number(offset),
    });

    const formattedSessions = sessions
      .filter((session) => session.user)
      .map((session) => ({
        id: session.id,
        userId: session.userId,
        user: session.user!,
        sessionId: session.socketId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        isActive: session.isActive,
        connectedAt: session.connectedAt.toISOString(),
        disconnectedAt: session.disconnectedAt?.toISOString() || null,
        lastPing: session.lastPing.toISOString(),
        duration: session.disconnectedAt
          ? Math.floor(
              (session.disconnectedAt.getTime() -
                session.connectedAt.getTime()) /
                1000
            )
          : Math.floor((Date.now() - session.connectedAt.getTime()) / 1000),
      }));

    res.json({
      success: true,
      sessions: formattedSessions,
      total: formattedSessions.length,
    });
  } catch (error) {
    console.error("Error fetching user sessions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user sessions",
    });
  }
});

// WEBSOCKET STATS
// GET /api/admin/websocket/stats
router.get("/websocket/stats", async (req, res) => {
  try {
    const webSocketService = (globalThis as any).webSocketService;

    if (!webSocketService) {
      return res.status(500).json({
        success: false,
        error: "WebSocket service not available",
      });
    }

    const stats = await webSocketService.getConnectionStats();

    res.json({
      success: true,
      data: {
        onlineUsers: webSocketService.getOnlineUsersCount(),
        totalConnections: stats.totalConnections,
        averageConnectionsPerUser: stats.averageConnectionsPerUser,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching WebSocket stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch WebSocket stats",
    });
  }
});

// ================================
//   RECENT ACTIVITY
// ================================
// Ordini più recenti
// GET /api/admin/dashboard/recent-activity
router.get(
  "/dashboard/recent-activity",
  requireAuthenticatedAdmin,
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 15;

      const recentOrders = await AnalyticsService.getRecentOrders(limit);

      const activities = recentOrders.map((order) => {
        let statusEmoji = "📦";
        let actionText = "placed";

        if (order.status === "COMPLETED") {
          statusEmoji = "✅";
          actionText = "completed";
        } else if (order.status === "PAID") {
          statusEmoji = "💳";
          actionText = "paid for";
        } else if (order.status === "PENDING") {
          statusEmoji = "⏳";
          actionText = "placed";
        } else if (order.status === "FAILED") {
          statusEmoji = "❌";
          actionText = "failed";
        } else if (order.status === "REFUNDED") {
          statusEmoji = "↩️";
          actionText = "refunded";
        }

        const currencySymbol =
          order.currency === "EUR"
            ? "€"
            : order.currency === "USD"
            ? "$"
            : order.currency === "GBP"
            ? "£"
            : order.currency;

        const message = `${statusEmoji} ${
          order.customerName
        } ${actionText} an order of ${currencySymbol}${order.total.toFixed(
          2
        )} (${order.itemCount} item${order.itemCount !== 1 ? "s" : ""})`;

        return {
          id: order.id,
          type: "order" as const,
          message,
          timestamp: order.createdAt.toISOString(),
          metadata: {
            orderId: order.id,
            status: order.status,
            total: order.total,
            currency: order.currency,
            items: order.itemCount,
            customerName: order.customerName,
          },
        };
      });

      const summary = {
        total: activities.length,
        byStatus: {
          completed: activities.filter((a) => a.metadata.status === "COMPLETED")
            .length,
          paid: activities.filter((a) => a.metadata.status === "PAID").length,
          pending: activities.filter((a) => a.metadata.status === "PENDING")
            .length,
          failed: activities.filter((a) => a.metadata.status === "FAILED")
            .length,
          refunded: activities.filter((a) => a.metadata.status === "REFUNDED")
            .length,
        },
      };

      res.json({
        success: true,
        activities,
        summary,
      });
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch recent activity",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export default router;
