import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  console.warn('Missing GEMINI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

export function getGeminiModel(modelName = 'gemini-3.6-flash') {
  return genAI.getGenerativeModel({ model: modelName });
}
