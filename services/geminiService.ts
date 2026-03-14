import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isCorrect: {
      type: Type.BOOLEAN,
      description: "True if the text has no spelling or grammar errors.",
    },
    improvedText: {
      type: Type.STRING,
      description: "The complete corrected version of the text.",
    },
    summary: {
      type: Type.STRING,
      description: "A short summary of the linguistic feedback in Khmer.",
    },
    corrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          originalText: { type: Type.STRING },
          suggestedText: { type: Type.STRING },
          reason: { type: Type.STRING, description: "Why this correction is suggested (in Khmer)." },
          type: { 
            type: Type.STRING, 
            description: "spelling, grammar, or style" 
          }
        },
        required: ["originalText", "suggestedText", "reason", "type"]
      }
    }
  },
  required: ["isCorrect", "improvedText", "summary", "corrections"]
};

export const analyzeKhmerText = async (text: string): Promise<AnalysisResult> => {
  // Use the standard environment variable for Gemini API in this platform.
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.API_KEY;
  const genAI = new GoogleGenAI({ apiKey: apiKey || "" });
  
  if (!text.trim()) {
    throw new Error("EMPTY_TEXT");
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{
          text: `សូមពិនិត្យអក្ខរាវិរុទ្ធ និងវេយ្យាករណ៍អត្ថបទខ្មែរខាងក្រោម៖\n\n"${text}"`
        }]
      }],
      config: {
        systemInstruction: "You are a professional Khmer language editor. Analyze the input for spelling mistakes, grammatical errors, and stylistic improvements. Provide feedback in Khmer. Your output must strictly follow the provided JSON schema.",
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result as AnalysisResult;
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    // Throw standard error types for the UI to handle
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('API key')) {
      throw new Error("MISSING_API_KEY");
    }
    throw new Error("API_FAILURE");
  }
};