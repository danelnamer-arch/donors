import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connStr = process.env.DATABASE_URL ?? "";
  // Ensure sslmode=require is in the connection string for Neon
  const url = connStr.includes("sslmode=")
    ? connStr
    : connStr + (connStr.includes("?") ? "&sslmode=require" : "?sslmode=require");

  console.log("[prisma] Creating connection pool...");

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  pool.on("error", (err) => {
    console.error("[prisma] Pool error:", err.message);
  });

  pool.on("connect", () => {
    console.log("[prisma] Connected to database");
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
