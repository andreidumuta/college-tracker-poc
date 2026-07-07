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
    const queryStr = (searchParams.get("q") || "").toLowerCase().trim();

    const colleges = await getCachedColleges();

    let results = colleges;
    if (queryStr) {
      results = colleges.filter((c) =>
        (c.name || "").toLowerCase().includes(queryStr) ||
        (c.city || "").toLowerCase().includes(queryStr) ||
        (c.state || "").toLowerCase().includes(queryStr)
      );
    }

    // Return limited results to reduce payload (e.g. max 20)
    return NextResponse.json(results.slice(0, 20));
  } catch (error) {
    console.error("Error in search API route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
