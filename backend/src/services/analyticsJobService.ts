import { PrismaClient, BusinessModel } from "../generated/prisma";
import { SupportAnalyticsService } from "./supportAnalyticsService";

export class AnalyticsJobService {
  constructor(
    private prisma: PrismaClient,
    private analyticsService: SupportAnalyticsService
  ) {}

  // ===== SCHEDULED JOBS =====
  async runHourlyAggregation(): Promise<void> {
    console.log("Starting hourly analytics aggregation...");
    const startTime = Date.now();

    try {
      const businessModels = await this.prisma.supportConfig.findMany({
        select: {
          businessModel: true,
          tenantId: true,
        },
      });

      const hour = new Date();
      hour.setMinutes(0, 0, 0);

      const results = [];
      for (const config of businessModels) {
        try {
          await this.analyticsService.aggregateHourlyData(
            config.businessModel,
            config.tenantId || null,
            hour
          );
          results.push({
            businessModel: config.businessModel,
            tenantId: config.tenantId,
            status: "success",
          });
        } catch (error) {
          console.error(
            `Failed to aggregate hourly data for ${config.businessModel}:${config.tenantId}`,
            error
          );
          results.push({
            businessModel: config.businessModel,
            tenantId: config.tenantId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter((r) => r.status === "success").length;

      console.log(`Hourly aggregation completed in ${duration}ms`);
      console.log(`Successful: ${successCount}/${results.length}`);
    } catch (error) {
      console.error("Hourly aggregation job failed:", error);
      throw error;
    }
  }

  /**
   * Job che gira ogni giorno per aggregare i dati giornalieri
   * Configurabile con cron job: "0 1 * * *" (1 AM ogni giorno)
   */
  async runDailyAggregation(): Promise<void> {
    console.log("Starting daily analytics aggregation...");
    const startTime = Date.now();

    try {
      const businessModels = await this.prisma.supportConfig.findMany({
        select: {
          businessModel: true,
          tenantId: true,
        },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const results = [];
      for (const config of businessModels) {
        try {
          await this.analyticsService.aggregateDailyData(
            config.businessModel,
            config.tenantId || null,
            yesterday
          );
          results.push({
            businessModel: config.businessModel,
            tenantId: config.tenantId,
            status: "success",
          });
        } catch (error) {
          console.error(
            `Failed to aggregate daily data for ${config.businessModel}:${config.tenantId}`,
            error
          );
          results.push({
            businessModel: config.businessModel,
            tenantId: config.tenantId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter((r) => r.status === "success").length;

      console.log(`Daily aggregation completed in ${duration}ms`);
      console.log(`Successful: ${successCount}/${results.length}`);
    } catch (error) {
      console.error("Daily aggregation job failed:", error);
      throw error;
    }
  }

  /**
   * Job di cleanup per eliminare dati analytics vecchi
   * Configurabile con cron job: "0 2 1 * *" (2 AM del primo giorno di ogni mese)
   */
  async runDataCleanup(retentionDays: number = 365): Promise<void> {
    console.log(
      `Starting analytics data cleanup (retention: ${retentionDays} days)...`
    );
    const startTime = Date.now();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleteResult = await this.prisma.supportAnalytics.deleteMany({
        where: {
          date: {
            lt: cutoffDate,
          },
        },
      });

      const duration = Date.now() - startTime;
      console.log(`Data cleanup completed in ${duration}ms`);
      console.log(`Deleted ${deleteResult.count} old analytics records`);
    } catch (error) {
      console.error("Data cleanup job failed:", error);
      throw error;
    }
  }

  /**
   * Backfill dei dati mancanti per un range di date
   */
  async backfillData(
    businessModel: BusinessModel,
    tenantId: string | null,
    fromDate: Date,
    toDate: Date
  ): Promise<void> {
    console.log(
      `Backfilling analytics data for ${businessModel}:${tenantId} from ${fromDate.toISOString()} to ${toDate.toISOString()}`
    );

    const currentDate = new Date(fromDate);
    const results = [];

    while (currentDate <= toDate) {
      try {
        // Check if data already exists
        const existing = await this.prisma.supportAnalytics.findUnique({
          where: {
            businessModel_tenantId_date_hour: {
              businessModel,
              tenantId: tenantId ?? "",
              date: currentDate,
              hour: null as any,
            },
          },
        });

        if (!existing) {
          await this.analyticsService.aggregateDailyData(
            businessModel,
            tenantId,
            new Date(currentDate)
          );
          results.push({ date: new Date(currentDate), status: "success" });
        } else {
          results.push({ date: new Date(currentDate), status: "skipped" });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      } catch (error) {
        console.error(
          `Failed to backfill data for ${currentDate.toISOString()}:`,
          error
        );
        results.push({
          date: new Date(currentDate),
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    console.log(
      `Backfill completed: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed`
    );
  }

  /**
   * Health check per verificare lo stato dei dati analytics
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    details: {
      latestHourlyData: Date | null;
      latestDailyData: Date | null;
      missingHours: number;
      missingDays: number;
      totalRecords: number;
    };
  }> {
    try {
      // Get latest data timestamps
      const [latestHourly, latestDaily, totalRecords] = await Promise.all([
        this.prisma.supportAnalytics.findFirst({
          where: { hour: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { date: true, hour: true },
        }),
        this.prisma.supportAnalytics.findFirst({
          where: { hour: null },
          orderBy: { createdAt: "desc" },
          select: { date: true },
        }),
        this.prisma.supportAnalytics.count(),
      ]);

      // Check for missing recent data
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const latestHourlyDate = latestHourly
        ? new Date(
            latestHourly.date.getTime() + latestHourly.hour! * 60 * 60 * 1000
          )
        : null;

      const missingHours = latestHourlyDate
        ? Math.max(
            0,
            Math.floor(
              (oneHourAgo.getTime() - latestHourlyDate.getTime()) /
                (60 * 60 * 1000)
            )
          )
        : 24; // Assume 24 hours missing if no data

      const missingDays = latestDaily
        ? Math.max(
            0,
            Math.floor(
              (oneDayAgo.getTime() - latestDaily.date.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : 7; // Assume 7 days missing if no data

      let status: "healthy" | "degraded" | "unhealthy";
      if (missingHours <= 2 && missingDays <= 1) {
        status = "healthy";
      } else if (missingHours <= 6 && missingDays <= 3) {
        status = "degraded";
      } else {
        status = "unhealthy";
      }

      return {
        status,
        details: {
          latestHourlyData: latestHourlyDate,
          latestDailyData: latestDaily?.date || null,
          missingHours,
          missingDays,
          totalRecords,
        },
      };
    } catch (error) {
      console.error("Analytics health check failed:", error);
      return {
        status: "unhealthy",
        details: {
          latestHourlyData: null,
          latestDailyData: null,
          missingHours: -1,
          missingDays: -1,
          totalRecords: -1,
        },
      };
    }
  }
}
