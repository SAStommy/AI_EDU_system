import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const body = req.body || {};

        const prompt =
            typeof body === "string"
                ? body
                : body.prompt;

        if (!prompt) {
            return res.status(400).json({ error: "Missing prompt" });
        }

        const result = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        return res.status(200).json({
            text: result.text
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            error: err.message
        });
    }
}