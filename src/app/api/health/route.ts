import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/health
 * Check that the database and API connections work.
 * Redis is optional — the app works without it.
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

  // Check Redis (optional — only report status, don't block)
  if (process.env.REDIS_URL) {
    try {
      const IORedis = (await import("ioredis")).default;
      const redis = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        lazyConnect: true,
        tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
      });
      await redis.connect();
      await redis.ping();
      status.redis = "connected";
      await redis.quit();
    } catch (error) {
      status.redis = `error: ${error instanceof Error ? error.message : "unknown"} (optional — app works without it)`;
    }
  } else {
    status.redis = "not configured (optional)";
  }

  // Check API keys (just whether they're set, not whether they're valid)
  status.openai = process.env.OPENAI_API_KEY ? "configured" : "missing";
  status.tavily = process.env.TAVILY_API_KEY ? "configured" : "missing";
  status.perplexity = process.env.PERPLEXITY_API_KEY ? "configured" : "missing";
  status.firecrawl = process.env.FIRECRAWL_API_KEY ? "configured" : "missing";
  status.paddle = process.env.PADDLE_API_KEY ? "configured" : "not configured (optional for now)";

  const allOk = status.database === "connected";

  return NextResponse.json(
    { status: allOk ? "healthy" : "issues found", services: status },
    { status: allOk ? 200 : 503 }
  );
}
