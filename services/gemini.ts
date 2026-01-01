
import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeFile = async (fileName: string, fileData: string, mimeType: string) => {
  try {
    const ai = getAI();
    
    // Fix: Explicitly type parts to avoid type inference issues when adding both text and inlineData parts.
    // Using any[] as a simple fix for the compiler error regarding Object literal properties.
    const parts: any[] = [
      { text: `Analyze this file named "${fileName}". If it's an image, describe what's in it. If it's text, summarize it. Provide a concise, professional note for a file drive application.` }
    ];

    if (mimeType.startsWith('image/')) {
      const base64Data = fileData.split(',')[1] || fileData;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts }
    });

    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Analysis failed to load.";
  }
};
