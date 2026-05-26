module.exports = async function(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if(req.method === "OPTIONS") return res.status(200).end();

  var KEY = process.env.PEXELS_KEY;
  var query = (req.query.q || "cinematic scene").trim();
  var perPage = parseInt(req.query.per_page) || 6;

  try {
    var r = await fetch(
      "https://api.pexels.com/videos/search?query="+encodeURIComponent(query)+"&per_page="+perPage+"&orientation=landscape",
      { headers: { Authorization: KEY } }
    );
    var data = await r.json();
    var videos = (data.videos||[]).map(function(v){
      var file = v.video_files.find(function(f){return f.quality==="hd";})||v.video_files[0];
      return { id:v.id, url:file?file.link:"", thumb:v.image, duration:v.duration };
    });
    res.json({ videos: videos, total: data.total_results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
