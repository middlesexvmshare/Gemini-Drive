import { GoogleGenAI } from "@google/genai";

// Analyze a file using Gemini 3 Flash.
export const analyzeFile = async (fileName, fileData, mimeType) => {
  try {
    // Basic defensive checks
    if (!fileData || typeof fileData !== 'string') {
      return "Unable to analyze: Invalid or empty file data.";
    }
    const safeMimeType = String(mimeType || '');
    const safeFileName = String(fileName || 'unnamed_file');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Analyze this file named "${safeFileName}". 
    - If image: Describe elements, colors, and mood.
    - If text/pdf: Summarize key themes and intents.
    Keep it professional and concise (under 80 words).`;

    const parts = [{ text: prompt }];

    if (safeMimeType.startsWith('image/')) {
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: safeMimeType || 'image/png'
        }
      });
    } else {
      let content = fileData;
      if (fileData.startsWith('data:')) {
        const base64 = fileData.includes(',') ? fileData.split(',')[1] : '';
        try { 
          content = base64 ? atob(base64) : "Unreadable content."; 
        } catch (e) { 
          content = "Unreadable binary content."; 
        }
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
    return "Intelligence service currently offline or error occurred during analysis.";
  }
};