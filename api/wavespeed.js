var KEY = process.env.WAVESPEED_KEY || process.env.WAVESPEED_API_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    var body = req.body || {};
    
    // ??? ??? ????? ????? ?? ??? ???? (Polling)
    if (body.action === 'poll' || body.id) {
        var pollId = body.id;
        try {
            var pr = await fetch("https://api.wavespeed.ai/api/v3/predictions/" + pollId, {
                headers: { "Authorization": "Bearer " + KEY }
            });
            var pd = await pr.json();
            return res.status(200).json({ status: pd.status, url: pd.output || pd.url });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    // ??? ??? ??? ????? ???? (Generation)
    var promptText = body.prompt || "Cinematic masterpiece sequence";
    try {
        var r = await fetch("https://api.wavespeed.ai/api/v3/vidu/q3/text-to-video", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: promptText,
                duration: body.duration || 5,
                resolution: "720p",
                aspect_ratio: "16:9"
            })
        });
        var d = await r.json();
        
        // ????? ?????? ???? ??? ??????? ?? ???????? ??????
        var jobId = d.id || d.task_id || (d.data ? d.data.id : null);
        if (!jobId) {
            return res.status(400).json({ error: "Failed to create generation task", details: d });
        }
        
        return res.status(200).json({ id: jobId, status: "processing" });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
