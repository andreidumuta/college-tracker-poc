import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const gemini = process.env.GEMINI_API_KEY;
  const scorecard = process.env.COLLEGE_SCORECARD_API_KEY;

  return NextResponse.json({
    gemini_exists: !!gemini,
    gemini_length: gemini ? gemini.length : 0,
    scorecard_exists: !!scorecard,
    scorecard_length: scorecard ? scorecard.length : 0,
    scorecard_value_is_empty_string: scorecard === "",
  });
}
