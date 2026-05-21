export default async function handler(req, res) {
    const data = req.body;

    await fetch(process.env.GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain"
        },
        body: JSON.stringify(data)
    });

    res.json({ ok: true });
}