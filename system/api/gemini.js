export default async function handler(req, res) {
    try {
        const { prompt } = req.body || {};

        if (!prompt) {
            return res.status(400).json({ error: "Missing prompt" });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: prompt }]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return res.status(200).json({ text });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: err.message
        });
    }
}