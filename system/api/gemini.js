import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    const { prompt } = req.body;

    const client = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    const result = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            role: "user",
            parts: [{ text: prompt }]
        }]
    });

    res.status(200).json({
        text: result.text
    });
}