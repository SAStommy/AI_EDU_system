import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    // ❗只允許 POST
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { prompt } = req.body;

        // 🔥 防呆（你之前已經踩過）
        if (!prompt) {
            return res.status(400).json({ error: "Missing prompt" });
        }

        // 🔐 API KEY（一定用 env，不要寫死）
        const genAI = new GoogleGenAI({
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return res.status(200).json({
            text: result.text,
        });

    } catch (err) {
        console.error("Gemini error:", err);

        return res.status(500).json({
            error: err.message,
        });
    }
}