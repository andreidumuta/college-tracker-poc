import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/api-auth";

// Helper function to query Gemini with retry logic, exponential backoff, and a timeout
async function queryGemini(ai: GoogleGenAI, prompt: string) {
  let response;
  let retries = 3;
  let delay = 2000;
  
  while (retries > 0) {
    try {
      const callPromise = ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [prompt],
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1, // Keep it deterministic
        }
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini request timed out")), 25000) // 25 seconds timeout
      );

      response = await Promise.race([callPromise, timeoutPromise]);
      break; // Exit loop on success
    } catch (err: unknown) {
      const errorStatus = (err as { status?: number }).status;
      if (errorStatus === 429 && retries > 1) {
        console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
        retries--;
      } else {
        throw err;
      }
    }
  }

  if (!response) {
    throw new Error("Failed to generate content after multiple retries");
  }

  let resultText = response.text;
  if (!resultText) {
    throw new Error("Empty response from Gemini");
  }

  // Clean up potential markdown formatting just in case
  resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

  // Robust JSON block extraction
  const startIdx = resultText.indexOf('{');
  const endIdx = resultText.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    resultText = resultText.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(resultText);
}

// 1. Research Unweighted GPA
async function researchUnweightedGpa(ai: GoogleGenAI, collegeName: string) {
  const prompt = `You are a college admissions expert. Search the web for the average admitted student unweighted GPA (4.0 scale) for ${collegeName}.
  If the official average unweighted GPA is not published by the college, you MUST look up and provide the commonly accepted average/estimate from reputable third-party sources (such as PrepScholar, CollegeSimply, or similar). Do NOT return null unless there is absolutely no estimate or data available online.
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "averageGpa": number or null (The average admitted student unweighted GPA on a 4.0 scale.)
  }`;
  return queryGemini(ai, prompt);
}

// 2. Research Weighted GPA
async function researchWeightedGpa(ai: GoogleGenAI, collegeName: string) {
  const prompt = `You are a college admissions expert. Search the web for the average admitted student weighted GPA (5.0 scale) for ${collegeName}.
  If the official average weighted GPA is not published by the college, you MUST look up and provide the commonly accepted average/estimate from reputable third-party sources (such as PrepScholar, CollegeSimply, or similar). Do NOT return null unless there is absolutely no estimate or data available online.
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "averageGpaWeighted": number or null (The average admitted student weighted GPA on a 5.0 scale.)
  }`;
  return queryGemini(ai, prompt);
}

// 3. Research Admissions Policy
async function researchPolicy(ai: GoogleGenAI, collegeName: string) {
  const prompt = `You are a college admissions expert. Search the web for the domestic need-blind admissions policy of ${collegeName} and whether they offer early admission (Early Action or Early Decision).
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "isNeedBlind": boolean or null (True if need-blind for domestic, false if need-aware. Use null if explicitly unknown/not published),
    "offersEarlyAdmission": boolean or null (True if Early Decision/Action is offered. Use null if unknown)
  }`;
  return queryGemini(ai, prompt);
}

// 4. Research Cycle Deadlines
async function researchDeadlines(ai: GoogleGenAI, collegeName: string) {
  const prompt = `You are a college admissions expert. Search the web for the application deadlines for ${collegeName} for the Fall 2027 admissions cycle (typically late 2026/early 2027 dates). Find Early Decision 1, Early Decision 2, Early Action, Regular Decision, and whether they offer Rolling admission.
  
  CRITICAL INSTRUCTION: Since Fall 2027 dates might not be officially published yet, you may need to project them based on historical Fall 2026 dates (e.g., if it is always Nov 1, project Nov 1, 2026). If you are projecting dates based on historical patterns rather than finding an explicitly announced Fall 2027 date, you MUST set "isEstimatedDeadlines" to true.
  
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "isEstimatedDeadlines": boolean (True if dates are projected from historical patterns, false if officially announced for Fall 2027),
    "earlyDecision1": string or null (The exact ED1 deadline date including the year, e.g. "Nov 1, 2026". Return null if not offered),
    "earlyDecision2": string or null (The exact ED2 deadline date including the year, e.g. "Jan 1, 2027". Return null if not offered),
    "earlyAction": string or null (The exact EA deadline date including the year, e.g. "Nov 1, 2026". Return null if not offered),
    "regularDecision": string (The exact RD deadline date including the year, e.g. "Jan 1, 2027". Return "Not published" if explicitly unknown),
    "rolling": boolean or null (True if they offer rolling admissions, false otherwise)
  }`;
  return queryGemini(ai, prompt);
}

// 5. Research ACT Score
async function researchAct(ai: GoogleGenAI, collegeName: string) {
  const prompt = `You are a college admissions expert. Search the web for the average admitted student ACT composite score (or the midpoint / 25th-75th percentile ACT composite score) for ${collegeName}.
  If the official average/midpoint ACT composite score is not published by the college, you MUST look up and provide the commonly accepted average/estimate from reputable third-party sources (such as PrepScholar, CollegeSimply, or similar). Do NOT return null unless there is absolutely no estimate or data available online.
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "actComposite": number or null (The average or midpoint admitted student ACT composite score as a number between 1 and 36.)
  }`;
  return queryGemini(ai, prompt);
}

export async function POST(req: Request) {
  try {
    const authResult = await verifyAuth(req, true); // Admin required
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const target = body.target || "all";
    let collegeName = body.collegeName;

    if (!collegeName) {
      return NextResponse.json({ error: "collegeName is required" }, { status: 400 });
    }

    if (typeof collegeName !== "string") {
      return NextResponse.json({ error: "collegeName must be a string" }, { status: 400 });
    }
    const sanitizedCollegeName = collegeName.trim();
    if (sanitizedCollegeName.length === 0 || sanitizedCollegeName.length > 100) {
      return NextResponse.json({ error: "collegeName length must be between 1 and 100 characters" }, { status: 400 });
    }
    // Allow alphanumeric, spaces, hyphens, periods, commas, single quotes/apostrophes, parentheses, and ampersands
    const validPattern = /^[a-zA-Z0-9\s\-\.\,\'\(\)\&]+$/;
    if (!validPattern.test(sanitizedCollegeName)) {
      return NextResponse.json({ error: "collegeName contains invalid characters" }, { status: 400 });
    }

    collegeName = sanitizedCollegeName;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log(`Researching data for: ${collegeName} (target: ${target})`);

    if (target === "all") {
      // Execute all sub-prompts in parallel to decrease latency
      const [unweightedGpaRes, weightedGpaRes, policyRes, deadlinesRes, actRes] = await Promise.all([
        researchUnweightedGpa(ai, collegeName).catch(err => {
          console.error("Error researching unweighted GPA:", err);
          return { averageGpa: null };
        }),
        researchWeightedGpa(ai, collegeName).catch(err => {
          console.error("Error researching weighted GPA:", err);
          return { averageGpaWeighted: null };
        }),
        researchPolicy(ai, collegeName).catch(err => {
          console.error("Error researching policy:", err);
          return { isNeedBlind: null, offersEarlyAdmission: null };
        }),
        researchDeadlines(ai, collegeName).catch(err => {
          console.error("Error researching deadlines:", err);
          return {
            isEstimatedDeadlines: false,
            earlyDecision1: null,
            earlyDecision2: null,
            earlyAction: null,
            regularDecision: "Not published",
            rolling: null
          };
        }),
        researchAct(ai, collegeName).catch(err => {
          console.error("Error researching ACT:", err);
          return { actComposite: null };
        })
      ]);

      const data = {
        ...unweightedGpaRes,
        ...weightedGpaRes,
        ...policyRes,
        ...deadlinesRes,
        ...actRes
      };
      
      return NextResponse.json(data);
    }

    // Single target execution
    let data = {};
    if (target === "unweightedGpa") {
      data = await researchUnweightedGpa(ai, collegeName);
    } else if (target === "weightedGpa") {
      data = await researchWeightedGpa(ai, collegeName);
    } else if (target === "policy") {
      data = await researchPolicy(ai, collegeName);
    } else if (target === "deadlines") {
      data = await researchDeadlines(ai, collegeName);
    } else if (target === "act") {
      data = await researchAct(ai, collegeName);
    } else {
      return NextResponse.json({ error: `Invalid target: ${target}` }, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (error: unknown) {
    console.error("Error researching college:", error);
    const message = error instanceof Error ? error.message : "Failed to research college";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
