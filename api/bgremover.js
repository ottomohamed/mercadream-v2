module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  var KEY = process.env.WAVESPEED_KEY;
  var body = req.body || {};
  var imageUrl = body.imageUrl || body.videoUrl;
  var action = body.action || "generate";

  // Poll
  if(action === "poll") {
    var id = body.id;
    if(!id) return res.status(400).json({error:"No ID"});
    try {
      var pr = await fetch("https://api.wavespeed.ai/api/v3/predictions/"+id, {
        headers:{"Authorization":"Bearer "+KEY}
      });
      var pd = await pr.json();
      var status = pd.data && pd.data.status;
      var url = pd.data && pd.data.outputs && pd.data.outputs[0];
      return res.json({status, url, taskId:id});
    } catch(e) {
      return res.status(500).json({error:e.message});
    }
  }

  if(!imageUrl) return res.status(400).json({error:"No image URL"});

  try {
    // Use WaveSpeed BiRefNet for background removal
    var r = await fetch("https://api.wavespeed.ai/api/v3/wavespeed-ai/birefnet/predictions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer "+KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: imageUrl,
        resolution: "1024x1024"
      })
    });
    var data = await r.json();

    if(!data.data || !data.data.id) {
      return res.json({error:"No task ID", raw:data});
    }
    res.json({taskId: data.data.id, status:"processing"});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
};

