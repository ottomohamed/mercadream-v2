module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  var KEY  = process.env.WAVESPEED_KEY;
  var BASE = "https://api.wavespeed.ai/api/v3";
  var body = req.body || {};

  // Poll
  if(body.action === "poll") {
    var jobId = body.jobId;
    if(!jobId) return res.status(400).json({error:"No jobId"});
    try {
      var pr = await fetch(BASE+"/predictions/"+jobId, {
        headers:{"Authorization":"Bearer "+KEY}
      });
      var pd = await pr.json();
      var status = pd.data && pd.data.status;
      var audioUrl = pd.data && pd.data.outputs && pd.data.outputs[0];
      var duration = pd.data && pd.data.duration;
      return res.json({status, audioUrl, jobId, duration});
    } catch(e) {
      return res.status(500).json({error:e.message});
    }
  }

  // Generate
  var prompt   = body.prompt;
  var genre    = body.genre || "";
  var duration = parseInt(body.duration) || 30;

  if(!prompt) return res.status(400).json({error:"prompt required"});

  var fullPrompt = genre ? genre + " music: " + prompt : prompt;

  try {
    var r = await fetch(BASE+"/predictions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer "+KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "wavespeed-ai/mureka-o1",
        input: {
          prompt: fullPrompt,
          duration: duration
        }
      })
    });
    var data = await r.json();
    var jobId = data.data && data.data.id;
    if(!jobId) return res.status(500).json({error:"No job ID", raw:data});
    res.json({jobId: jobId, status:"processing"});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
};
