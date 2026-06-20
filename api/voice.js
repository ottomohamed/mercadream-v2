module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();
  if(req.method !== "POST") return res.status(405).json({error:"POST only"});

  var KEY = process.env.GOOGLE_TTS_KEY;
  var body = req.body || {};
  var text = body.text;
  var voiceName = body.voice || "en-US-Neural2-F";
  var languageCode = body.languageCode || (voiceName.split('-').slice(0,2).join('-')) || "en-US";
  var speakingRate = body.speakingRate || 1.0;
  var pitch = body.pitch || 0;

  if(!text) return res.status(400).json({error:"text required"});
  if(text.length > 5000) return res.status(400).json({error:"text too long (max 5000 chars)"});

  try {
    var r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: text },
        voice: { languageCode: languageCode, name: voiceName },
        audioConfig: { audioEncoding: "MP3", speakingRate: speakingRate, pitch: pitch }
      })
    });
    var data = await r.json();
    if(!data.audioContent) {
      return res.status(500).json({error: (data.error && data.error.message) || "TTS failed", raw: data});
    }
    // Return as data URL so client can play directly
    res.json({ audioContent: data.audioContent, mime: "audio/mp3" });
  } catch(e) {
    res.status(500).json({error: e.message});
  }
};
