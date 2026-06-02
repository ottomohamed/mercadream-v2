// ═══════════════════════════════════════════════════════
// MERCADREAM — api/index.js  
// UNIFIED ROUTER — All services, no duplicate declarations
// ═══════════════════════════════════════════════════════

const WAVESPEED_KEY   = process.env.WAVESPEED_API_KEY;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const STRIPE_KEY      = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET;
const FIREBASE_KEY    = process.env.FIREBASE_API_KEY;
const PEXELS_KEY      = process.env.PEXELS_API_KEY;
const GEMINI_KEY      = process.env.GEMINI_KEY;

const FIREBASE_PROJECT = 'mercadream-4b4b3';
const FIREBASE_URL     = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const BASE_URL         = 'https://www.mercadream.com';

// ── FIRESTORE HELPERS ─────────────────────────────────
async function firestoreWrite(collection, docId, fields) {
  const url = docId
    ? `${FIREBASE_URL}/${collection}/${docId}?key=${FIREBASE_KEY}`
    : `${FIREBASE_URL}/${collection}?key=${FIREBASE_KEY}`;
  const method = docId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  return res.json();
}

async function firestoreQuery(collection) {
  const url = `${FIREBASE_URL}/${collection}?key=${FIREBASE_KEY}&pageSize=500`;
  const res = await fetch(url);
  return res.json();
}

async function firestoreGet(collection, docId) {
  const url = `${FIREBASE_URL}/${collection}/${docId}?key=${FIREBASE_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function firestoreUpdate(collection, docId, fields) {
  const url = `${FIREBASE_URL}/${collection}/${docId}?key=${FIREBASE_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  return res.json();
}

// ── WAVESPEED HELPER ──────────────────────────────────
async function wavespeedGenerate(model, payload) {
  const res = await fetch(`https://api.wavespeed.ai/api/v3/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WAVESPEED_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function wavespeedPoll(requestId) {
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`, {
      headers: { 'Authorization': `Bearer ${WAVESPEED_KEY}` }
    });
    const data = await res.json();
    const status = data.data?.status;
    if (status === 'completed') return data.data?.outputs?.[0] || data.data?.output;
    if (status === 'failed') throw new Error(data.data?.error || 'Generation failed');
  }
  throw new Error('Timeout');
}

// ── FINGERPRINT (Genesis Vault) ───────────────────────
function generateGenesisId(uid) {
  const ts = Date.now().toString(36).toUpperCase();
  const u  = (uid || 'ANON').substring(0, 6).toUpperCase();
  const r  = Math.random().toString(36).substring(2, 6).toUpperCase();
  return \`GNS-\${ts}-\${u}-\${r}\`;
}

async function extractFrameHashes(videoData) {
  const hashes = [];
  if (!videoData) return hashes;
  const data = videoData.startsWith('data:') 
    ? videoData.substring(videoData.indexOf(',') + 1)
    : Buffer.from(videoData).toString('base64').substring(0, 64);
  const chunkSize = Math.floor(data.length / 30);
  for (let i = 0; i < 30; i++) {
    const chunk = data.substring(i * chunkSize, (i + 1) * chunkSize);
    let hash = 0;
    for (let j = 0; j < Math.min(chunk.length, 256); j++) {
      hash = ((hash << 5) - hash) + chunk.charCodeAt(j);
      hash |= 0;
    }
    hashes.push(Math.abs(hash).toString(36));
  }
  return hashes;
}

function computeMasterHash(hashes) { return hashes.join('-').substring(0, 64); }

function computeMatchScore(a, b) {
  if (!a?.length || !b?.length) return 0;
  const setA = new Set(a);
  let matches = 0;
  for (const h of b) { if (setA.has(h)) matches++; }
  return matches / Math.max(a.length, b.length);
}

async function findMatch(queryHashes, threshold) {
  try {
    const data = await firestoreQuery('genesis_vault');
    if (!data.documents) return null;
    let best = null, bestScore = 0;
    for (const doc of data.documents) {
      const stored = doc.fields?.frameHashes?.arrayValue?.values?.map(v => v.stringValue) || [];
      if (!stored.length) continue;
      const score = computeMatchScore(queryHashes, stored);
      if (score > bestScore) { bestScore = score; best = { doc, score }; }
    }
    return bestScore >= threshold ? best : null;
  } catch(e) { return null; }
}

async function handle_fingerprint(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const { action } = req.body || {};

  if (action === 'stats') {
    try {
      const data = await firestoreQuery('genesis_vault');
      return res.status(200).json({ total: data.documents?.length || 0 });
    } catch(e) { return res.status(200).json({ total: 0 }); }
  }

  if (action === 'register') {
    const { videoUrl, ownerId, ownerName, title, director, prompt } = req.body;
    if (!videoUrl || !ownerId) return res.status(400).json({ error: 'videoUrl and ownerId required.' });
    const frameHashes = await extractFrameHashes(videoUrl);
    const masterHash = computeMasterHash(frameHashes);
    const existing = await findMatch(frameHashes, 0.8);
    if (existing) {
      const f = existing.doc.fields;
      return res.status(200).json({ alreadyRegistered: true, matchScore: Math.round(existing.score * 100),
        genesisId: f.genesisId?.stringValue, owner: f.ownerName?.stringValue, title: f.title?.stringValue });
    }
    const genesisId = generateGenesisId(ownerId);
    await firestoreWrite('genesis_vault', null, {
      genesisId: { stringValue: genesisId }, masterHash: { stringValue: masterHash },
      frameHashes: { arrayValue: { values: frameHashes.map(h => ({ stringValue: h })) }},
      frameCount: { integerValue: frameHashes.length },
      videoUrl: { stringValue: videoUrl.substring(0, 500) },
      ownerId: { stringValue: ownerId }, ownerName: { stringValue: ownerName || 'Creator' },
      title: { stringValue: title || 'Untitled' }, director: { stringValue: director || '' },
      prompt: { stringValue: (prompt || '').substring(0, 200) },
      status: { stringValue: 'owned' }, price: { integerValue: 0 },
      createdAt: { stringValue: new Date().toISOString() },
    });
    return res.status(200).json({ genesisId, masterHash, frameCount: frameHashes.length,
      owner: ownerName || ownerId, title: title || 'Untitled', created: new Date().toISOString(), verified: true });
  }

  if (action === 'verify') {
    const { videoUrl, genesisId } = req.body;
    if (genesisId) {
      const data = await firestoreQuery('genesis_vault');
      const doc = data.documents?.find(d => d.fields?.genesisId?.stringValue === genesisId);
      if (!doc) return res.status(200).json({ verified: false, message: 'ID not found.' });
      const f = doc.fields;
      return res.status(200).json({ verified: true, genesisId: f.genesisId?.stringValue,
        owner: f.ownerName?.stringValue, title: f.title?.stringValue, created: f.createdAt?.stringValue,
        masterHash: f.masterHash?.stringValue, status: f.status?.stringValue });
    }
    if (videoUrl) {
      const queryHashes = await extractFrameHashes(videoUrl);
      const exact = await findMatch(queryHashes, 0.8);
      if (exact) {
        const f = exact.doc.fields;
        return res.status(200).json({ verified: true, matchType: 'exact', matchScore: Math.round(exact.score * 100),
          genesisId: f.genesisId?.stringValue, owner: f.ownerName?.stringValue, title: f.title?.stringValue });
      }
      const partial = await findMatch(queryHashes, 0.3);
      if (partial) {
        const f = partial.doc.fields;
        return res.status(200).json({ verified: true, matchType: 'partial', matchScore: Math.round(partial.score * 100),
          genesisId: f.genesisId?.stringValue, owner: f.ownerName?.stringValue });
      }
      return res.status(200).json({ verified: false, message: 'No match found.' });
    }
    return res.status(400).json({ error: 'Provide videoUrl or genesisId.' });
  }

  if (action === 'collection') {
    const { ownerId } = req.body;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required.' });
    const data = await firestoreQuery('genesis_vault');
    const docs = (data.documents || []).filter(d => d.fields?.ownerId?.stringValue === ownerId);
    const collection = docs.map(doc => ({
      genesisId: doc.fields.genesisId?.stringValue, title: doc.fields.title?.stringValue,
      masterHash: doc.fields.masterHash?.stringValue, status: doc.fields.status?.stringValue,
      price: doc.fields.price?.integerValue || 0, created: doc.fields.createdAt?.stringValue,
    }));
    return res.status(200).json({ collection, total: collection.length });
  }

  if (action === 'stats') {
    const data = await firestoreQuery('genesis_vault');
    return res.status(200).json({ total: data.documents?.length || 0 });
  }

  return res.status(400).json({ error: 'action required.' });
}

// ── PEXELS ────────────────────────────────────────────
async function handle_pexels(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { query, per_page, orientation } = req.body || {};
  if (!query) return res.status(400).json({ error: 'query required.' });
  if (!PEXELS_KEY) return res.status(500).json({ error: 'PEXELS_API_KEY not configured.' });
  try {
    const url = \`https://api.pexels.com/videos/search?query=\${encodeURIComponent(query)}&per_page=\${per_page||12}&orientation=\${orientation||'portrait'}\`;
    const r = await fetch(url, { headers: { 'Authorization': PEXELS_KEY } });
    const data = await r.json();
    return res.status(200).json(data);
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── WAVESPEED (Studio) ────────────────────────────────
async function handle_wavespeed(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  const { prompt, duration, model, image_url } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required.' });
  if (!WAVESPEED_KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });
  try {
    const modelId = model || 'wavespeed-ai/seedance-1-lite';
    const payload = { prompt, duration: duration || 5, size: '1280x720' };
    if (image_url) payload.image_url = image_url;
    const result = await wavespeedGenerate(modelId, payload);
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: result.error || 'No request ID' });
    const videoUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ videoUrl, requestId });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── AUDIOFORGE ────────────────────────────────────────
async function handle_audioforge(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { prompt, duration, genre } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt required.' });
  try {
    const result = await wavespeedGenerate('wavespeed-ai/mureka-o1', {
      prompt: \`\${genre ? genre + ' music: ' : ''}\${prompt}\`,
      duration: duration || 30
    });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const audioUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ audioUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── BG REMOVER ────────────────────────────────────────
async function handle_bgremover(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { imageUrl, videoUrl, mode } = req.body || {};
  try {
    const input = videoUrl || imageUrl;
    if (!input) return res.status(400).json({ error: 'imageUrl or videoUrl required.' });
    const model = videoUrl ? 'wavespeed-ai/birefnet-video' : 'wavespeed-ai/birefnet';
    const result = await wavespeedGenerate(model, { image_url: input, refine_foreground: true });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const outputUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ outputUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── FACESWAP ──────────────────────────────────────────
async function handle_faceswap(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { sourceImage, targetImage, targetVideo } = req.body || {};
  if (!sourceImage) return res.status(400).json({ error: 'sourceImage required.' });
  try {
    const target = targetVideo || targetImage;
    const model = targetVideo ? 'wavespeed-ai/facefusion-video' : 'wavespeed-ai/facefusion';
    const result = await wavespeedGenerate(model, {
      source_image: sourceImage, target_media: target, face_selector_mode: 'many'
    });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const outputUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ outputUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── ANIMATE ───────────────────────────────────────────
async function handle_animate(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { imageUrl, prompt, duration } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' });
  try {
    const result = await wavespeedGenerate('wavespeed-ai/wan-2.1-i2v-720p', {
      image_url: imageUrl, prompt: prompt || 'Smooth cinematic motion', duration: duration || 5
    });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const videoUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ videoUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── LIPSYNC ───────────────────────────────────────────
async function handle_lipsync(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { videoUrl, audioUrl } = req.body || {};
  if (!videoUrl || !audioUrl) return res.status(400).json({ error: 'videoUrl and audioUrl required.' });
  try {
    const result = await wavespeedGenerate('wavespeed-ai/lipsync-2-pro', {
      video_url: videoUrl, audio_url: audioUrl
    });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const outputUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ outputUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── DEAGING ───────────────────────────────────────────
async function handle_deaging(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { imageUrl, targetAge } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' });
  try {
    const result = await wavespeedGenerate('wavespeed-ai/age-transformation', {
      image_url: imageUrl, target_age: targetAge || 25
    });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const outputUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ outputUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── CONVERT (image to video) ──────────────────────────
async function handle_convert(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { imageUrl, prompt } = req.body || {};
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required.' });
  try {
    const result = await wavespeedGenerate('wavespeed-ai/wan-2.1-i2v-480p', {
      image_url: imageUrl, prompt: prompt || 'Cinematic motion', duration: 5
    });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const videoUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ videoUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── UPSCALE ───────────────────────────────────────────
async function handle_upscale(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { imageUrl, videoUrl, scale } = req.body || {};
  try {
    const input = videoUrl || imageUrl;
    if (!input) return res.status(400).json({ error: 'imageUrl or videoUrl required.' });
    const model = videoUrl ? 'wavespeed-ai/video-upscaler' : 'wavespeed-ai/clarity-upscaler';
    const result = await wavespeedGenerate(model, { image_url: input, scale: scale || 4 });
    const requestId = result.data?.id;
    if (!requestId) return res.status(500).json({ error: 'No request ID' });
    const outputUrl = await wavespeedPoll(requestId);
    return res.status(200).json({ outputUrl });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── SEMANTIC ──────────────────────────────────────────
async function handle_semantic(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { imageUrl, videoUrl, question } = req.body || {};
  try {
    const input = videoUrl || imageUrl;
    if (!input) return res.status(400).json({ error: 'imageUrl or videoUrl required.' });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: input } },
            { type: 'text', text: question || 'Analyze this visual content in detail. Describe subjects, mood, composition, and cinematic qualities.' }
          ]
        }]
      })
    });
    const data = await response.json();
    return res.status(200).json({ analysis: data.content?.[0]?.text || 'Analysis complete.' });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── DIRECTOR ──────────────────────────────────────────
async function handle_director(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { concept, director, genre, duration } = req.body || {};
  if (!concept) return res.status(400).json({ error: 'concept required.' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: \`You are \${director || 'a master film director'}. Generate \${duration || 3} cinematic video prompts for: "\${concept}". Genre: \${genre || 'cinematic'}. Each prompt: vivid, technical, specific. Return JSON array.\`
        }]
      })
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    const jsonMatch = text.match(/\[.*\]/s);
    const prompts = jsonMatch ? JSON.parse(jsonMatch[0]) : [text];
    return res.status(200).json({ prompts, director: director || 'AI Director' });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}

// ── CHECKOUT (Stripe) ─────────────────────────────────
async function handle_checkout(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  if (!STRIPE_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured.' });

  const { amount, userId, credits } = req.body || {};
  const creditAmount = parseInt(credits || amount) || 100;
  const priceInCents = creditAmount * 10; // $0.10 per GNS

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: \`MercaDream — \${creditAmount.toLocaleString()} GNS Credits\`,
            description: \`\${creditAmount} GNS · AI Cinema Credits · $0.10 per GNS\`,
            images: ['https://www.mercadream.com/media/og-image.png'],
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: \`\${BASE_URL}/pricing.html?status=success&credits=\${creditAmount}&uid=\${userId}\`,
      cancel_url: \`\${BASE_URL}/pricing.html?status=cancelled\`,
      metadata: { userId: userId || '', credits: creditAmount.toString() },
      client_reference_id: userId || '',
    });
    return res.status(200).json({ url: session.url });
  } catch(e) {
    console.error('Checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── WEBHOOK (Stripe → Firebase) ───────────────────────
async function handle_webhook(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!WEBHOOK_SECRET) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not configured.' });

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_KEY);

    // Get raw body for signature verification
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on('data', c => chunks.push(c));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const rawBody = Buffer.concat(chunks);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch(e) {
      return res.status(400).json({ error: 'Webhook signature failed: ' + e.message });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      const credits = parseInt(session.metadata?.credits) || 100;

      if (userId) {
        // Get current balance
        const userDoc = await firestoreGet('users', userId);
        const currentCredits = userDoc?.fields?.credits?.integerValue || 0;
        const newCredits = parseInt(currentCredits) + credits;

        // Update Firebase
        await firestoreUpdate('users', userId, {
          credits: { integerValue: newCredits },
          lastTopup: { stringValue: new Date().toISOString() }
        });

        // Log transaction
        await firestoreWrite('transactions', null, {
          userId: { stringValue: userId },
          type: { stringValue: 'topup' },
          credits: { integerValue: credits },
          amount: { integerValue: session.amount_total },
          sessionId: { stringValue: session.id },
          createdAt: { stringValue: new Date().toISOString() }
        });

        console.log(\`✅ Credited \${credits} GNS to user \${userId}\`);
      }
    }

    return res.status(200).json({ received: true });
  } catch(e) {
    console.error('Webhook error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ═══════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, stripe-signature');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const service = url.split('/').filter(Boolean).pop()?.split('?')[0];

  const routes = {
    fingerprint: handle_fingerprint,
    pexels:      handle_pexels,
    wavespeed:   handle_wavespeed,
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
  };

  const fn = routes[service];
  if (!fn) {
    return res.status(404).json({ error: 'Unknown service: ' + service, available: Object.keys(routes) });
  }

  try {
    await fn(req, res);
  } catch(e) {
    console.error('[' + service + ']', e.message);
    return res.status(500).json({ error: e.message });
  }
};
