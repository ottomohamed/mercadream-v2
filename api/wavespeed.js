module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  var KEY = process.env.WAVESPEED_KEY;
  var body = req.body || {};
  var prompt = body.prompt || req.query.prompt || "cinematic scene";
  var duration = parseInt(body.duration || req.query.duration) || 5;
  var action = body.action || req.query.action || "generate";

  // Poll existing prediction
  if(action === "poll") {
    var pollId = body.id || req.query.id;
    if(!pollId) return res.status(400).json({error:"No prediction ID"});
    try {
      var pr = await fetch("https://api.wavespeed.ai/api/v2/predictions/"+pollId, {
        headers:{"Authorization":"Bearer "+KEY}
      });
      var pd = await pr.json();
      var status = pd.data && pd.data.status;
      var url = pd.data && pd.data.outputs && pd.data.outputs[0];
      return res.json({status, url, id:pollId});
    } catch(e) {
      return res.status(500).json({error:e.message});
    }
  }

  // Generate new video
  try {
    var r = await fetch("https://api.wavespeed.ai/api/v2/wavespeed-ai/wan-t2v-480p/predictions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer "+KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: duration,
        size: "480*832"
      })
    });
    var data = await r.json();
    if(!data.data || !data.data.id) {
      return res.json({error:"No prediction ID", raw:data});
    }
    res.json({id: data.data.id, status:"processing"});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
};
