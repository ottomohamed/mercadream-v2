module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if(req.method === "OPTIONS") return res.status(200).end();

  var KEY      = process.env.WAVESPEED_KEY;
  var IMGBB    = process.env.IMGBB_KEY;
  var BASE_URL = "https://api.wavespeed.ai/api/v3";
  var body     = req.body || {};

  // Poll
  if(body.action === "poll") {
    var id = body.id;
    if(!id) return res.status(400).json({error:"No ID"});
    try {
      var pr = await fetch(BASE_URL+"/predictions/"+id, {
        headers:{"Authorization":"Bearer "+KEY}
      });
      var pd = await pr.json();
      var status = pd.data && pd.data.status;
      var url = pd.data && pd.data.outputs && pd.data.outputs[0];
      return res.json({status, url, taskId:id});
    } catch(e) { return res.status(500).json({error:e.message}); }
  }

  // Upload base64 to ImgBB
  var imageBase64 = body.imageBase64;
  var imageUrl    = body.imageUrl;
  var isVideo     = !!body.videoUrl;

  if(imageBase64) {
    try {
      var form = new URLSearchParams();
      form.append("key", IMGBB);
      form.append("image", imageBase64);
      var up = await fetch("https://api.imgbb.com/1/upload", {
        method:"POST",
        body: form
      });
      var upd = await up.json();
      imageUrl = upd.data && upd.data.url;
      if(!imageUrl) return res.status(500).json({error:"ImgBB upload failed", raw:upd});
    } catch(e) {
      return res.status(500).json({error:"Upload error: "+e.message});
    }
  }

  if(!imageUrl) return res.status(400).json({error:"No image"});

  try {
    var model = isVideo ? "wavespeed-ai/birefnet-video" : "wavespeed-ai/birefnet";
    var r = await fetch(BASE_URL+"/predictions", {
      method:"POST",
      headers:{
        "Authorization":"Bearer "+KEY,
        "Content-Type":"application/json"
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
