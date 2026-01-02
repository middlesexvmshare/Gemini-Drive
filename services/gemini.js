import { GoogleGenAI } from "@google/genai";

// Analyze a file using Gemini 3 Flash.
export const analyzeFile = async (fileName, fileData, mimeType) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Analyze this file named "${fileName}". 
    - If image: Describe elements, colors, and mood.
    - If text/pdf: Summarize key themes and intents.
    Keep it professional and concise (under 80 words).`;

    const parts = [{ text: prompt }];

    if (mimeType.startsWith('image/')) {
      const base64Data = fileData.split(',')[1] || fileData;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    } else {
      let content = fileData;
      if (fileData.startsWith('data:')) {
        const base64 = fileData.split(',')[1];
        try { content = atob(base64); } catch (e) { content = "Unreadable binary content."; }
      }
      parts.push({ text: `Content Sample:\n${content.substring(0, 10000)}` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts }
    });

    return response.text || "Analysis complete: No significant insights detected.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Intelligence service currently offline.";
  }
};