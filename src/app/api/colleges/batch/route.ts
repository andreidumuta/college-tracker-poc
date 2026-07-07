import { NextResponse } from "next/server";
import { getCachedColleges } from "@/lib/colleges-cache";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authResult = await verifyAuth(req, false);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const idsStr = searchParams.get("ids") || "";
    const ids = idsStr ? idsStr.split(",").map(id => id.trim()).filter(Boolean) : [];

    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    // Limit batch size to prevent payload issues
    if (ids.length > 50) {
      return NextResponse.json({ error: "Batch size limit exceeded (max 50 IDs)" }, { status: 400 });
    }

    const colleges = await getCachedColleges();
    const idSet = new Set(ids);
    const results = colleges.filter(c => idSet.has(c.id));

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in batch API route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
