// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MERCADREAM â€” api/index.js
// UNIFIED ROUTER v3 â€” Clean, no duplicates
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
'use strict';

const WAVESPEED_KEY  = process.env.WAVESPEED_API_KEY;
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const STRIPE_KEY     = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const FIREBASE_KEY   = process.env.FIREBASE_API_KEY;
const PEXELS_KEY     = process.env.PEXELS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const FIREBASE_PROJECT = 'mercadream-4b4b3';
const FIREBASE_URL     = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const BASE_URL         = 'https://www.mercadream.com';
const WAVESPEED_BASE   = 'https://api.wavespeed.ai/api/v3';

// â”€â”€ FIRESTORE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fsWrite(col, docId, fields) {
  const url = docId
    ? `${FIREBASE_URL}/${col}/${docId}?key=${FIREBASE_KEY}`
    : `${FIREBASE_URL}/${col}?key=${FIREBASE_KEY}`;
  const r = await fetch(url, {
    method: docId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  return r.json();
}
async function fsQuery(col) {
  const r = await fetch(`${FIREBASE_URL}/${col}?key=${FIREBASE_KEY}&pageSize=500`);
  return r.json();
}
async function fsGet(col, docId) {
  const r = await fetch(`${FIREBASE_URL}/${col}/${docId}?key=${FIREBASE_KEY}`);
  if (!r.ok) return null;
  return r.json();
}

// â”€â”€ WAVESPEED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function wsPost(model, input) {
  const r = await fetch(`${WAVESPEED_BASE}/predictions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WAVESPEED_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input })
  });
  return r.json();
}
async function wsPoll(taskId) {
  const r = await fetch(`${WAVESPEED_BASE}/predictions/${taskId}`, {
    headers: { 'Authorization': `Bearer ${WAVESPEED_KEY}` }
  });
  return r.json();
}

// â”€â”€ GENESIS VAULT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeGenesisId(uid) {
  return `GNS-${Date.now().toString(36).toUpperCase()}-${(uid||'ANON').slice(0,6).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}
async function extractHashes(data) {
  const hashes = [];
  if (!data) return hashes;
  const str = data.startsWith('data:') ? data.slice(data.indexOf(',')+1) : Buffer.from(data).toString('base64').slice(0,64);
  const chunk = Math.floor(str.length/30);
  for (let i=0;i<30;i++) {
    let h=0, seg=str.slice(i*chunk,(i+1)*chunk);
    for (let j=0;j<Math.min(seg.length,256);j++) { h=((h<<5)-h)+seg.charCodeAt(j); h|=0; }
    hashes.push(Math.abs(h).toString(36));
  }
  return hashes;
}
function matchScore(a,b) {
  if (!a?.length||!b?.length) return 0;
  const s=new Set(a); let m=0;
  for (const h of b) if(s.has(h)) m++;
  return m/Math.max(a.length,b.length);
}
async function findMatch(hashes, threshold) {
  const data = await fsQuery('genesis_vault');
  if (!data.documents) return null;
  let best=null, bestScore=0;
  for (const doc of data.documents) {
    const stored = doc.fields?.frameHashes?.arrayValue?.values?.map(v=>v.stringValue)||[];
    const score = matchScore(hashes, stored);
    if (score > bestScore) { bestScore=score; best={doc,score}; }
  }
  return bestScore >= threshold ? best : null;
}

// â”€â”€ HANDLERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handle_fingerprint(req, res) {
  const { action } = req.body||{};

  if (action==='stats') {
    const d = await fsQuery('genesis_vault');
    return res.json({ total: d.documents?.length||0 });
  }

  if (action==='register') {
    const { videoUrl, ownerId, ownerName, title } = req.body;
    if (!videoUrl||!ownerId) return res.status(400).json({ error: 'videoUrl and ownerId required.' });
    const hashes = await extractHashes(videoUrl);
    const master = hashes.join('-').slice(0,64);
    const exists = await findMatch(hashes, 0.8);
    if (exists) {
      const f = exists.doc.fields;
      return res.json({ alreadyRegistered:true, matchScore:Math.round(exists.score*100),
        genesisId:f.genesisId?.stringValue, owner:f.ownerName?.stringValue, title:f.title?.stringValue });
    }
    const genesisId = makeGenesisId(ownerId);
    await fsWrite('genesis_vault', null, {
      genesisId:{stringValue:genesisId}, masterHash:{stringValue:master},
      frameHashes:{arrayValue:{values:hashes.map(h=>({stringValue:h}))}},
      frameCount:{integerValue:hashes.length},
      videoUrl:{stringValue:videoUrl.slice(0,500)},
      ownerId:{stringValue:ownerId}, ownerName:{stringValue:ownerName||'Creator'},
      title:{stringValue:title||'Untitled'}, status:{stringValue:'owned'},
      price:{integerValue:0}, createdAt:{stringValue:new Date().toISOString()}
    });
    return res.json({ genesisId, masterHash:master, frameCount:hashes.length,
      owner:ownerName||ownerId, title:title||'Untitled', created:new Date().toISOString(), verified:true });
  }

  if (action==='verify') {
    const { videoUrl, genesisId } = req.body;
    if (genesisId) {
      const d = await fsQuery('genesis_vault');
      const doc = d.documents?.find(x=>x.fields?.genesisId?.stringValue===genesisId);
      if (!doc) return res.json({ verified:false, message:'Not found.' });
      const f=doc.fields;
      return res.json({ verified:true, genesisId:f.genesisId?.stringValue,
        owner:f.ownerName?.stringValue, title:f.title?.stringValue,
        created:f.createdAt?.stringValue, masterHash:f.masterHash?.stringValue });
    }
    if (videoUrl) {
      const hashes = await extractHashes(videoUrl);
      const exact = await findMatch(hashes, 0.8);
      if (exact) {
        const f=exact.doc.fields;
        return res.json({ verified:true, matchType:'exact', matchScore:Math.round(exact.score*100),
          genesisId:f.genesisId?.stringValue, owner:f.ownerName?.stringValue });
      }
      const partial = await findMatch(hashes, 0.3);
      if (partial) {
        const f=partial.doc.fields;
        return res.json({ verified:true, matchType:'partial', matchScore:Math.round(partial.score*100),
          genesisId:f.genesisId?.stringValue, owner:f.ownerName?.stringValue });
      }
      return res.json({ verified:false, message:'No match found.' });
    }
    return res.status(400).json({ error: 'Provide videoUrl or genesisId.' });
  }

  if (action==='collection') {
    const { ownerId } = req.body;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required.' });
    const d = await fsQuery('genesis_vault');
    const docs = (d.documents||[]).filter(x=>x.fields?.ownerId?.stringValue===ownerId);
    return res.json({ collection: docs.map(x=>({
      genesisId:x.fields.genesisId?.stringValue, title:x.fields.title?.stringValue,
      masterHash:x.fields.masterHash?.stringValue, status:x.fields.status?.stringValue,
      price:x.fields.price?.integerValue||0, created:x.fields.createdAt?.stringValue
    })), total:docs.length });
  }

  return res.status(400).json({ error: 'Unknown action.' });
}

async function handle_pexels(req, res) {
  const { query, per_page, orientation } = req.body||{};
  if (!query) return res.status(400).json({ error: 'query required.' });
  if (!PEXELS_KEY) return res.status(500).json({ error: 'PEXELS_API_KEY not set.' });
  const r = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${per_page||12}&orientation=${orientation||'portrait'}`,
    { headers: { Authorization: PEXELS_KEY } });
  return res.json(await r.json());
}

async function handle_wavespeed(req, res) {
  const { prompt, duration, model, image_url } = req.body||{};
  if (!prompt) return res.status(400).json({ error: 'prompt required.' });
  if (!WAVESPEED_KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not set.' });
  const modelId = model||'wavespeed-ai/wan-2.1/t2v-480p';
  try {
    // WaveSpeed API v3 - model-specific endpoint
    const endpoint = 'https://api.wavespeed.ai/api/v3/' + modelId;
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + WAVESPEED_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        duration: duration||5,
        size: '1280x720',
        negative_prompt: 'blurry, low quality, distorted'
      })
    });
    const d = await r.json();
    const taskId = d?.data?.id;
    if (!taskId) return res.status(500).json({ error: d?.message || d?.error || 'No task ID', raw: d });
    return res.json({ taskId, status:'queued' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

async function handle_video(req, res) {
  // GET: Poll status
  if (req.method === 'GET') {
    const taskId = (req.query && req.query.id) || (req.url && req.url.split('id=')[1]?.split('&')[0]);
    if (!taskId) return res.status(400).json({ error: 'id required.' });
    if (!WAVESPEED_KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not set.' });
    try {
      const r = await fetch('https://api.wavespeed.ai/api/v3/predictions/' + taskId + '/result', {
        headers: { 'Authorization': 'Bearer ' + WAVESPEED_KEY }
      });
      const d = await r.json();
      const status = d?.data?.status;
      const outputs = d?.data?.outputs;
      const videoUrl = Array.isArray(outputs) ? outputs[0] : (outputs || null);
      return res.json({
        status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'generating',
        taskId,
        videoUrl: videoUrl || null
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }
  // POST: Submit generation
  const { prompt, duration, model } = req.body||{};
  if (!prompt) return res.status(400).json({ error: 'prompt required.' });
  if (!WAVESPEED_KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not set.' });
  try {
    const modelId = model || 'bytedance/seedance-2.0-fast/text-to-video';
    const r = await fetch('https://api.wavespeed.ai/api/v3/' + modelId, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + WAVESPEED_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, duration: duration||5, size: '480*832' })
    });
    const d = await r.json();
    const taskId = d?.data?.id;
    if (!taskId) return res.status(500).json({ error: d?.message || 'No task ID', raw: d });
    return res.json({ taskId, status: 'queued' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}


async function handle_audioforge(req, res) {
  const { prompt, duration, genre } = req.body||{};
  if (!prompt) return res.status(400).json({ error: 'prompt required.' });
  const d = await wsPost('wavespeed-ai/mureka-o1', {
    prompt: `${genre?genre+' music: ':''}${prompt}`, duration:duration||30
  });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_bgremover(req, res) {
  const { imageUrl, videoUrl } = req.body||{};
  const input = videoUrl||imageUrl;
  if (!input) return res.status(400).json({ error: 'imageUrl or videoUrl required.' });
  const model = videoUrl?'wavespeed-ai/birefnet-video':'wavespeed-ai/birefnet';
  const d = await wsPost(model, { image_url:input, refine_foreground:true });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_faceswap(req, res) {
  const { sourceImage, targetImage, targetVideo } = req.body||{};
  if (!sourceImage) return res.status(400).json({ error: 'sourceImage required.' });
  const model = targetVideo?'wavespeed-ai/facefusion-video':'wavespeed-ai/facefusion';
  const d = await wsPost(model, { source_image:sourceImage, target_media:targetVideo||targetImage, face_selector_mode:'many' });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_animate(req, res) {
  const { imageUrl, prompt, duration } = req.body||{};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' });
  const d = await wsPost('wavespeed-ai/wan-2.1-i2v-720p', { image_url:imageUrl, prompt:prompt||'Smooth cinematic motion', duration:duration||5 });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_lipsync(req, res) {
  const { videoUrl, audioUrl } = req.body||{};
  if (!videoUrl||!audioUrl) return res.status(400).json({ error: 'videoUrl and audioUrl required.' });
  const d = await wsPost('wavespeed-ai/lipsync-2-pro', { video_url:videoUrl, audio_url:audioUrl });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_deaging(req, res) {
  const { imageUrl, targetAge } = req.body||{};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' });
  const d = await wsPost('wavespeed-ai/age-transformation', { image_url:imageUrl, target_age:targetAge||25 });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_convert(req, res) {
  const { imageUrl, prompt } = req.body||{};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' });
  const d = await wsPost('wavespeed-ai/wan-2.1-i2v-480p', { image_url:imageUrl, prompt:prompt||'Cinematic motion', duration:5 });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_upscale(req, res) {
  const { imageUrl, videoUrl, scale } = req.body||{};
  const input = videoUrl||imageUrl;
  if (!input) return res.status(400).json({ error: 'imageUrl or videoUrl required.' });
  const model = videoUrl?'wavespeed-ai/video-upscaler':'wavespeed-ai/clarity-upscaler';
  const d = await wsPost(model, { image_url:input, scale:scale||4 });
  const taskId = d.data?.id;
  if (!taskId) return res.status(500).json({ error: 'No task ID' });
  return res.json({ taskId });
}

async function handle_semantic(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  const { text, params } = req.body||{};
  if (!text) return res.status(400).json({ error: 'text required.' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });

  const selectedParams = params || ['SCENE PACING','CHARACTER ARC','DIALOGUE STRENGTH','EMOTIONAL BEATS','PLOT STRUCTURE'];

  const system = 'You are a professional screenplay analyst. Analyze the given script and return ONLY a valid JSON object with scores from 1-10 for each metric. No text before or after the JSON.';

  const prompt = 'Analyze this screenplay/script and score it from 1-10 for each metric:\n\n' +
    'Script:\n' + text.slice(0, 4000) + '\n\n' +
    'Return ONLY this JSON (no other text):\n' +
    '{\n' +
    '  "pacing": <score 1-10>,\n' +
    '  "arc": <score 1-10>,\n' +
    '  "dialogue": <score 1-10>,\n' +
    '  "emotion": <score 1-10>,\n' +
    '  "plot": <score 1-10>,\n' +
    '  "summary": "<2 sentences about the script strengths and weaknesses>",\n' +
    '  "suggestions": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]\n' +
    '}';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const d = await r.json();
    const replyText = d.content?.[0]?.text?.trim() || '';

    const match = replyText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const scores = JSON.parse(match[0]);
        return res.json(scores);
      } catch(e) {
        return res.status(500).json({ error: 'Parse error: ' + e.message, raw: replyText.slice(0,200) });
      }
    }

    return res.status(500).json({ error: 'No JSON in response', raw: replyText.slice(0,200) });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}


async function handle_director(req, res) {
  const { concept, director, genre, duration } = req.body||{};
  if (!concept) return res.status(400).json({ error: 'concept required.' });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'x-api-key':ANTHROPIC_KEY, 'anthropic-version':'2023-06-01', 'content-type':'application/json' },
    body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:4096,
      messages:[{ role:'user', content:`You are ${director||'a master film director'}. Generate EXACTLY ${duration||3} cinematic video prompts for: "${concept}". Return ONLY a valid JSON array with exactly ${duration||3} objects. Each object: {"scene": number, "title": "string", "prompt": "detailed 80+ word English video prompt"}. No markdown, no explanation, ONLY the JSON array.` }]
    })
  });
  const d = await r.json();
  const text = d.content?.[0]?.text||'[]';
  const match = text.match(/\[.*\]/s);
  const prompts = match ? JSON.parse(match[0]) : [text];
  return res.json({ prompts, director:director||'AI Director' });
}

async function handle_checkout(req, res) {
  if (req.method!=='POST') return res.status(405).json({ error:'POST only.' });
  if (!STRIPE_KEY) return res.status(500).json({ error:'STRIPE_SECRET_KEY not configured.' });
  const { credits, userId } = req.body||{};
  const creditAmount = parseInt(credits)||100;
  const priceInCents = creditAmount * 10;
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      line_items:[{ price_data:{
        currency:'usd',
        product_data:{ name:`MercaDream â€” ${creditAmount.toLocaleString()} GNS Credits`, description:`${creditAmount} GNS Â· AI Cinema Credits` },
        unit_amount: priceInCents
      }, quantity:1 }],
      mode:'payment',
      success_url:`${BASE_URL}/pricing.html?status=success&credits=${creditAmount}&uid=${userId}`,
      cancel_url:`${BASE_URL}/pricing.html?status=cancelled`,
      metadata:{ userId:userId||'', credits:creditAmount.toString() },
      client_reference_id: userId||''
    });
    return res.json({ url: session.url });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

async function handle_webhook(req, res) {
  if (!WEBHOOK_SECRET) return res.status(500).json({ error:'STRIPE_WEBHOOK_SECRET not configured.' });
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_KEY);
    const chunks = [];
    await new Promise((resolve,reject) => { req.on('data',c=>chunks.push(c)); req.on('end',resolve); req.on('error',reject); });
    const rawBody = Buffer.concat(chunks);
    const sig = req.headers['stripe-signature'];
    let event;
    try { event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET); }
    catch(e) { return res.status(400).json({ error:'Webhook signature failed.' }); }
    if (event.type==='checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId||session.client_reference_id;
      const credits = parseInt(session.metadata?.credits)||100;
      if (userId) {
        const userDoc = await fsGet('users', userId);
        const current = parseInt(userDoc?.fields?.credits?.integerValue)||0;
        await fsWrite('users', userId, { credits:{integerValue:current+credits}, lastTopup:{stringValue:new Date().toISOString()} });
        await fsWrite('transactions', null, { userId:{stringValue:userId}, type:{stringValue:'topup'},
          credits:{integerValue:credits}, sessionId:{stringValue:session.id}, createdAt:{stringValue:new Date().toISOString()} });
      }
    }
    return res.json({ received:true });
  } catch(e) { return res.status(500).json({ error:e.message }); }
}


async function handle_chat(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  const { message, director='Drama', sceneCount=3, dreamBrief=null } = req.body||{};
  if (!message) return res.status(400).json({ error: 'message required.' });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });

  const count = Math.min(parseInt(sceneCount)||3, 6);
  const idea = dreamBrief || message;

  const system = 'You are a professional screenplay writer and ' + director + ' film director at MercaDream. ' +
    'The user gives you a story idea. Write a complete cinematic screenplay divided into exactly ' + count + ' scenes. ' +
    'Each scene must be UNIQUE, different, and advance the story. ' +
    'Respond ONLY with a valid JSON array, no text before or after: ' +
    '[{"scene":1,"title":"Scene title","description":"What happens (in user language)","prompt":"Detailed 80+ word English video prompt: SHOT TYPE + subject + environment + camera movement + lighting + color palette + action + atmosphere"}] ' +
    'CRITICAL: prompt field must be in English only. Each scene must have completely different visual style. Director style: ' + director + '.';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: idea }]
      })
    });

    const data = await r.json();
    const text = data.content?.[0]?.text?.trim() || '';

    // Parse JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const scenes = JSON.parse(match[0]);
        return res.json({ scenes, total: scenes.length });
      } catch(e) {
        return res.status(500).json({ error: 'Scene parsing failed: ' + e.message, raw: text.slice(0,200) });
      }
    }

    return res.status(500).json({ error: 'No JSON array in response', raw: text.slice(0,200) });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}

// â”€â”€ ROUTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handle_analyze(req, res) {
  const analyzeApi = require('./analyze');
  return await analyzeApi(req, res);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');
  if (req.method==='OPTIONS') return res.status(200).end();

  const url = req.url||'';
  const service = url.split('/').filter(Boolean).pop()?.split('?')[0];

  const routes = {
    chat:        handle_chat,
    fingerprint: handle_fingerprint,
    pexels:      handle_pexels,
    wavespeed:   handle_wavespeed,
    video:       handle_video,
    audioforge:  handle_audioforge,
    bgremover:   handle_bgremover,
    faceswap:    handle_faceswap,
    animate:     handle_animate,
    lipsync:     handle_lipsync,
    deaging:     handle_deaging,
    convert:     handle_convert,
    upscale:     handle_upscale,
    semantic:    handle_semantic,
    director:    handle_director,
    checkout:    handle_checkout,
    webhook:     handle_webhook,
    analyze:     handle_analyze,
  };

  const fn = routes[service];
  if (!fn) return res.status(404).json({ error:'Unknown service: '+service, available:Object.keys(routes) });

  try { await fn(req, res); }
  catch(e) { console.error('['+service+']', e.message); return res.status(500).json({ error:e.message }); }
};



