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

    // Implement retry logic with exponential backoff for 429 errors
    let response;
    let retries = 3;
    let delay = 2000;
    
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            `You are a college admissions expert. Search the web for the most accurate and up-to-date admissions data for ${collegeName} for students applying to start college in Fall 2027 (this means application deadlines are typically in late 2026 or early 2027). Find their exact Need-Blind policy, whether they offer early admission, their application deadlines for the Fall 2027 cycle, and their average admitted student GPA.
            
            You MUST return ONLY a raw JSON object with the following exact keys and types, and nothing else. Do not use markdown code blocks like \`\`\`json.
            {
              "isNeedBlind": boolean or null (True if need-blind for domestic, false if need-aware. Use null if explicitly unknown/not published),
              "offersEarlyAdmission": boolean or null (True if Early Decision/Action is offered. Use null if unknown),
              "earlyDecision1": string or null (The exact ED1 deadline date including the year, e.g. "Nov 1, 2026". Return null if not offered),
              "earlyDecision2": string or null (The exact ED2 deadline date including the year, e.g. "Jan 1, 2027". Return null if not offered),
              "earlyAction": string or null (The exact EA deadline date including the year, e.g. "Nov 1, 2026". Return null if not offered),
              "regularDecision": string (The exact RD deadline date including the year, e.g. "Jan 1, 2027". Return "Not published" if explicitly unknown),
              "rolling": boolean or null (True if they offer rolling admissions, false otherwise),
              "averageGpa": number or null (e.g. 3.9, use null if not published)
            }`
          ],
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.1, // Keep it deterministic
          }
        });
        break; // Exit loop on success
      } catch (err: any) {
        if (err.status === 429 && retries > 1) {
          console.warn(`Rate limited (429). Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
          delay *= 2; // Exponential backoff
          retries--;
        } else {
          throw err;
        }
      }
    }

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
