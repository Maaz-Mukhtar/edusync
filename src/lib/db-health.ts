import { pool } from "./prisma";

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

export interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  latencyMs: number;
  poolStats: PoolStats;
  error?: string;
}

/**
 * Check database connection health and pool status
 * Useful for health checks and debugging connection issues
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Test connection with a simple query
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    return {
      status: "healthy",
      latencyMs: Date.now() - start,
      poolStats: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      poolStats: {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount,
      },
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current pool statistics without performing a health check
 */
export function getPoolStats(): PoolStats {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}
