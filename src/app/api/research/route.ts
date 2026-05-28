import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

// Helper function to query Gemini with retry logic and exponential backoff
async function queryGemini(ai: GoogleGenAI, prompt: string) {
  let response;
  let retries = 3;
  let delay = 2000;
  
  while (retries > 0) {
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [prompt],
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1, // Keep it deterministic
        }
      });
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
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "averageGpa": number or null (The average admitted student unweighted GPA on a 4.0 scale. Use null if not published/unavailable.)
  }`;
  return queryGemini(ai, prompt);
}

// 2. Research Weighted GPA
async function researchWeightedGpa(ai: GoogleGenAI, collegeName: string) {
  const prompt = `You are a college admissions expert. Search the web for the average admitted student weighted GPA (5.0 scale) for ${collegeName}.
  You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else.
  {
    "averageGpaWeighted": number or null (The average admitted student weighted GPA on a 5.0 scale. Use null if not published/unavailable.)
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

export async function POST(req: Request) {
  try {
    const { collegeName, target = "all" } = await req.json();

    if (!collegeName) {
      return NextResponse.json({ error: "collegeName is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    console.log(`Researching data for: ${collegeName} (target: ${target})`);

    if (target === "all") {
      // Execute all sub-prompts in parallel to decrease latency
      const [unweightedGpaRes, weightedGpaRes, policyRes, deadlinesRes] = await Promise.all([
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
        })
      ]);

      const data = {
        ...unweightedGpaRes,
        ...weightedGpaRes,
        ...policyRes,
        ...deadlinesRes
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
