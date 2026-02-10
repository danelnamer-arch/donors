import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import IORedis from "ioredis";

/**
 * GET /api/health
 * Check that the database and Redis connections work.
 */
export async function GET() {
  const status: Record<string, string> = {};

  // Check database
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    status.database = "connected";
  } catch (error) {
    status.database = `error: ${error instanceof Error ? error.message : "unknown"}`;
  }

  // Check Redis
  try {
    if (process.env.REDIS_URL) {
      const redis = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      status.redis = "connected";
      await redis.quit();
    } else {
      status.redis = "not configured (REDIS_URL missing)";
    }
  } catch (error) {
    status.redis = `error: ${error instanceof Error ? error.message : "unknown"}`;
  }

  // Check API keys (just whether they're set, not whether they're valid)
  status.openai = process.env.OPENAI_API_KEY ? "configured" : "missing";
  status.tavily = process.env.TAVILY_API_KEY ? "configured" : "missing";
  status.perplexity = process.env.PERPLEXITY_API_KEY ? "configured" : "missing";
  status.firecrawl = process.env.FIRECRAWL_API_KEY ? "configured" : "missing";

  const allOk = status.database === "connected" && status.redis === "connected";

  return NextResponse.json(
    { status: allOk ? "healthy" : "issues found", services: status },
    { status: allOk ? 200 : 503 }
  );
}
