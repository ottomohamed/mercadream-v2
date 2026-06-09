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
    var id = body.id;
    if(!id) return res.status(400).json({error:"No ID"});
    try {
      var pr = await fetch(BASE+"/predictions/"+id, {
        headers:{"Authorization":"Bearer "+KEY}
      });
      var pd = await pr.json();
      var status = pd.data && pd.data.status;
      var url = pd.data && pd.data.outputs && pd.data.outputs[0];
      return res.json({status, url, taskId:id});
    } catch(e) { return res.status(500).json({error:e.message}); }
  }

  // Generate
  var imageUrl = body.imageUrl || body.videoUrl;
  var isVideo  = !!body.videoUrl;
  if(!imageUrl) return res.status(400).json({error:"No image URL"});

  // If base64, we need a public URL - WaveSpeed doesn't accept base64 directly
  if(imageUrl.startsWith("data:")) {
    return res.status(400).json({error:"Base64 not supported. Please use a public image URL."});
  }

  try {
    var model = isVideo ? "wavespeed-ai/birefnet-video" : "wavespeed-ai/birefnet";
    var r = await fetch(BASE+"/predictions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer "+KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        input: { image_url: imageUrl, refine_foreground: true }
      })
    });
    var data = await r.json();
    var taskId = data.data && data.data.id;
    if(!taskId) return res.status(500).json({error:"No task ID", raw:data});
    res.json({taskId: taskId, status:"processing"});
  } catch(e) {
    res.status(500).json({error:e.message});
  }
};
