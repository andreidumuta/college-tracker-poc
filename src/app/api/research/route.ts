import { GoogleGenAI, Type, Schema } from "@google/genai";
import { NextResponse } from "next/server";

// Initialize the Google Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { collegeName } = await req.json();

    if (!collegeName) {
      return NextResponse.json({ error: "collegeName is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    // Define the schema we want Gemini to return
    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        isNeedBlind: {
          type: Type.BOOLEAN,
          description: "True if the college is need-blind for domestic applicants, false if they are need-aware.",
        },
        offersEarlyAdmission: {
          type: Type.BOOLEAN,
          description: "True if the college offers Early Decision or Early Action.",
        },
        earlyDecisionDeadline: {
          type: Type.STRING,
          description: "The calendar date for Early Decision/Action deadline (e.g., 'Nov 1'). Null if not offered.",
          nullable: true,
        },
        regularDecisionDeadline: {
          type: Type.STRING,
          description: "The calendar date for the Regular Decision deadline (e.g., 'Jan 1').",
        },
        averageGpa: {
          type: Type.NUMBER,
          description: "The average unweighted GPA of admitted students (e.g., 3.9).",
        }
      },
      required: ["isNeedBlind", "offersEarlyAdmission", "regularDecisionDeadline", "averageGpa"],
    };

    console.log(`Researching data for: ${collegeName}`);

    // Call Gemini with Google Search Grounding enabled
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        `You are a college admissions expert. Search the web for the most accurate and up-to-date admissions data for ${collegeName} for students applying to start college in Fall 2026 (this means application deadlines are typically in late 2025 or early 2026). Find their exact Need-Blind policy, whether they offer early admission, their application deadlines for the Fall 2026 cycle, and their average admitted student GPA.
        
        You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else. Do not use markdown code blocks like \`\`\`json.
        {
          "isNeedBlind": boolean or null (True if need-blind for domestic, false if need-aware. Use null if explicitly unknown/not published),
          "offersEarlyAdmission": boolean or null (True if Early Decision/Action is offered. Use null if unknown),
          "earlyDecisionDeadline": string or null (The exact deadline date including the year, e.g. "Nov 1, 2025". Return "Not published" if the college has explicitly not released it yet.),
          "regularDecisionDeadline": string (The exact deadline date including the year, e.g. "Jan 1, 2026". Return "Not published" if the college has explicitly not released it yet.),
          "averageGpa": number or null (e.g. 3.9, use null if not published)
        }`
      ],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1, // Keep it deterministic
      }
    });

    let resultText = response.text;
    
    if (!resultText) {
      throw new Error("Empty response from Gemini");
    }

    // Clean up potential markdown formatting just in case
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(resultText);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error researching college:", error);
    return NextResponse.json({ error: error.message || "Failed to research college" }, { status: 500 });
  }
}
