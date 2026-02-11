import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/donors — List all donors with search, filter, pagination.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const type = url.searchParams.get("type") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { ein: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.researchStatus = status;
  }

  if (type) {
    where.type = type;
  }

  const [donors, total] = await Promise.all([
    prisma.donor.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: { select: { grants: true, publications: true, matches: true } },
      },
    }),
    prisma.donor.count({ where }),
  ]);

  return NextResponse.json({
    donors,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * DELETE /api/admin/donors — Bulk delete donors by IDs.
 */
export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  const deleted = await prisma.donor.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ deleted: deleted.count });
}
