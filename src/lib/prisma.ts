import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, PoolConfig } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Optimized pool configuration for better performance
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool size settings
  min: parseInt(process.env.DATABASE_POOL_MIN || "2", 10),
  max: parseInt(process.env.DATABASE_POOL_MAX || "10", 10),
  // Connection timeouts (in milliseconds)
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || "10000", 10),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || "30000", 10),
  // Allow exit even if pool has active connections (for serverless)
  allowExitOnIdle: process.env.NODE_ENV === "production",
};

const pool = globalForPrisma.pool ?? new Pool(poolConfig);

// Handle pool errors gracefully
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

// Log pool connection stats in development
if (process.env.NODE_ENV === "development") {
  pool.on("connect", () => {
    console.log(`[DB Pool] New connection. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
  });
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

// Export pool for health checks if needed
export { pool };

export default prisma;
