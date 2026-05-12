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
      model: "gemini-2.5-flash",
      contents: [
        `You are a college admissions expert. Search the web for the most accurate and up-to-date admissions data for ${collegeName}. Find their exact Need-Blind policy, whether they offer early admission, their application deadlines, and their average admitted student GPA.`
      ],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Keep it deterministic
      }
    });

    const resultText = response.text;
    
    if (!resultText) {
      throw new Error("Empty response from Gemini");
    }

    const data = JSON.parse(resultText);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error researching college:", error);
    return NextResponse.json({ error: error.message || "Failed to research college" }, { status: 500 });
  }
}
