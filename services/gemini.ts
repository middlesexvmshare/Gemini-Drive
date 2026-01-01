
// Use the recommended import for GoogleGenAI and GenerateContentResponse
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize AI client with API key from environment variable
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a file using Gemini 3 Flash.
 * @param fileName The name of the file to analyze.
 * @param fileData The data URL (for images) or plain text content.
 * @param mimeType The IANA standard MIME type of the file.
 */
export const analyzeFile = async (fileName: string, fileData: string, mimeType: string) => {
  try {
    const ai = getAI();
    
    // Construct parts array for multimodal understanding
    const parts: any[] = [
      { text: `Analyze this file named "${fileName}". If it's an image, describe what's in it. If it's a text document, summarize the key points. Provide a concise, professional note suitable for a file drive application.` }
    ];

    if (mimeType.startsWith('image/')) {
      // Extract base64 data from data URL
      const base64Data = fileData.split(',')[1] || fileData;
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    } else if (mimeType.startsWith('text/') || mimeType.includes('pdf')) {
      // If it's a text file passed as a data URL, decode it. Otherwise use it directly.
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
      // Add the file content as a text part (limited to first 15000 characters for prompt efficiency)
      parts.push({ text: `File content for analysis:\n${content.substring(0, 15000)}` });
    }

    // Call generateContent with model name and contents object containing the parts
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts }
    });

    // Access the text property directly (it's a getter, not a method)
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return "Analysis failed to load.";
  }
};
