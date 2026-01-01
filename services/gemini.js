
import { GoogleGenAI } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeFile = async (fileName, fileData, mimeType) => {
  try {
    const ai = getAI();
    
    const parts = [
      { text: `Analyze this file named "${fileName}". If it's an image, describe what's in it. If it's a text document, summarize the key points. Provide a concise, professional note suitable for a file drive application.` }
    ];

    if (mimeType.startsWith('image/')) {
      const base64Data = fileData.split(',')[1] || fileData;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    } else if (mimeType.startsWith('text/') || mimeType.includes('pdf')) {
      let content = fileData;
      if (fileData.startsWith('data:')) {
        const base64 = fileData.split(',')[1];
        if (base64) {
          try {
            content = atob(base64);
          } catch (e) {
            console.error("Failed to decode text content from base64", e);
          }
        }
      }
      parts.push({ text: `File content for analysis:\n${content.substring(0, 15000)}` });
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
