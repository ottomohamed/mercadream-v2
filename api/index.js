// ═══════════════════════════════════════════════════════
// MERCADREAM — api/index.js
// UNIFIED API ROUTER — All services in one function
// Route: /api/{service}
// ═══════════════════════════════════════════════════════


// ── FINGERPRINT ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/fingerprint.js v2
// Video DNA System with Frame-Level Fingerprinting
// Works like YouTube Content ID + Shazam
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;
const FIREBASE_PROJECT = 'mercadream-4b4b3';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// ── GENESIS ID GENERATOR ──────────────────────────────
function generateGenesisId(uid) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const userPart = uid.substring(0, 6).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GNS-${timestamp}-${userPart}-${random}`;
}

// ── FRAME-LEVEL FINGERPRINTING ────────────────────────
// Simulates perceptual hashing by sampling video data
// In production: use ffmpeg to extract actual frames
async function extractFrameHashes(videoDataOrUrl) {
  const hashes = [];
  
  // For base64 data URLs — sample at intervals
  if (videoDataOrUrl && videoDataOrUrl.startsWith('data:')) {
    const data = videoDataOrUrl.substring(videoDataOrUrl.indexOf(',') + 1);
    const chunkSize = Math.floor(data.length / 30); // 30 sample points
    
    for (let i = 0; i < 30; i++) {
      const chunk = data.substring(i * chunkSize, (i + 1) * chunkSize);
      // Simple hash of chunk (in production: perceptual hash of decoded frame)
      let hash = 0;
      for (let j = 0; j < Math.min(chunk.length, 256); j++) {
        hash = ((hash << 5) - hash) + chunk.charCodeAt(j);
        hash |= 0;
      }
      hashes.push(Math.abs(hash).toString(36));
    }
  } else if (videoDataOrUrl) {
    // For URL-based videos — hash the URL + segments
    const base = Buffer.from(videoDataOrUrl).toString('base64').substring(0, 64);
    for (let i = 0; i < 30; i++) {
      const segment = base.substring(i * 2, (i + 1) * 2) + i.toString(36);
      let hash = 0;
      for (let j = 0; j < segment.length; j++) {
        hash = ((hash << 5) - hash) + segment.charCodeAt(j);
        hash |= 0;
      }
      hashes.push(Math.abs(hash).toString(36));
    }
  }
  
  return hashes;
}

// ── MASTER HASH (full video fingerprint) ─────────────
function computeMasterHash(frameHashes) {
  return frameHashes.join('-').substring(0, 64);
}

// ── MATCH SCORE (how similar two fingerprints are) ───
function computeMatchScore(hashesA, hashesB) {
  if (!hashesA || !hashesB || !hashesA.length || !hashesB.length) return 0;
  let matches = 0;
  const setA = new Set(hashesA);
  for (const h of hashesB) {
    if (setA.has(h)) matches++;
  }
  return matches / Math.max(hashesA.length, hashesB.length);
}

// ── FIRESTORE HELPERS ─────────────────────────────────
async function firestoreWrite(collection, docId, fields) {
  const url = docId
    ? `${FIREBASE_URL}/${collection}/${docId}?key=${FIREBASE_API_KEY}`
    : `${FIREBASE_URL}/${collection}?key=${FIREBASE_API_KEY}`;
  const method = docId ? 'PATCH' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
  return res.json();
}

async function firestoreQuery(collection) {
  const url = `${FIREBASE_URL}/${collection}?key=${FIREBASE_API_KEY}&pageSize=500`;
  const res = await fetch(url);
  return res.json();
}

async function firestoreGet(collection, docId) {
  const url = `${FIREBASE_URL}/${collection}/${docId}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// ── SEARCH DATABASE FOR MATCHES ───────────────────────
async function findMatchInDatabase(queryHashes, threshold = 0.3) {
  try {
    const data = await firestoreQuery('genesis_vault');
    if (!data.documents) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const doc of data.documents) {
      const f = doc.fields;
      const storedHashes = f.frameHashes?.arrayValue?.values?.map(v => v.stringValue) || [];
      
      if (!storedHashes.length) continue;

      const score = computeMatchScore(queryHashes, storedHashes);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { doc, score };
      }
    }

    // If score > threshold → match found
    if (bestScore >= threshold) {
      console.log(`🎯 Match found! Score: ${(bestScore * 100).toFixed(1)}%`);
      return bestMatch;
    }
    return null;
  } catch(e) {
    console.error('Search error:', e.message);
    return null;
  }
}

// ── MAIN HANDLER ──────────────────────────────────────
async function handle_fingerprint(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const body = req.body || {};
  const { action } = body;

  // ── STATS ─────────────────────────────────────────────
  if (action === 'stats') {
    try {
      const data = await firestoreQuery('genesis_vault');
      return res.status(200).json({ total: data.documents?.length || 0 });
    } catch(e) {
      return res.status(200).json({ total: 0 });
    }
  }

  // ── REGISTER ──────────────────────────────────────────
  if (action === 'register') {
    const { videoUrl, ownerId, ownerName, title, director, prompt } = body;
    if (!videoUrl || !ownerId) {
      return res.status(400).json({ error: 'videoUrl and ownerId required.' });
    }

    console.log('=== REGISTER ===', ownerId, title);

    // Extract frame fingerprints
    const frameHashes = await extractFrameHashes(videoUrl);
    const masterHash = computeMasterHash(frameHashes);

    // Check if already registered (score > 80%)
    const existing = await findMatchInDatabase(frameHashes, 0.8);
    if (existing) {
      const f = existing.doc.fields;
      console.log(`❌ Already registered: ${f.genesisId?.stringValue} (${(existing.score * 100).toFixed(1)}% match)`);
      return res.status(200).json({
        alreadyRegistered: true,
        matchScore: Math.round(existing.score * 100),
        genesisId: f.genesisId?.stringValue,
        owner: f.ownerName?.stringValue,
        ownerId: f.ownerId?.stringValue,
        title: f.title?.stringValue,
        created: f.createdAt?.stringValue,
      });
    }

    // Register new video
    const genesisId = generateGenesisId(ownerId);

    await firestoreWrite('genesis_vault', null, {
      genesisId:    { stringValue: genesisId },
      masterHash:   { stringValue: masterHash },
      frameHashes:  { arrayValue: { values: frameHashes.map(h => ({ stringValue: h })) }},
      frameCount:   { integerValue: frameHashes.length },
      videoUrl:     { stringValue: videoUrl.substring(0, 500) }, // truncate base64
      ownerId:      { stringValue: ownerId },
      ownerName:    { stringValue: ownerName || 'Creator' },
      title:        { stringValue: title || 'Untitled' },
      director:     { stringValue: director || '' },
      prompt:       { stringValue: (prompt || '').substring(0, 200) },
      status:       { stringValue: 'owned' },
      price:        { integerValue: 0 },
      createdAt:    { stringValue: new Date().toISOString() },
    });

    console.log(`✅ Registered: ${genesisId} (${frameHashes.length} frames)`);

    return res.status(200).json({
      genesisId,
      masterHash,
      frameCount: frameHashes.length,
      owner: ownerName || ownerId,
      title: title || 'Untitled',
      created: new Date().toISOString(),
      verified: true,
    });
  }

  // ── VERIFY ────────────────────────────────────────────
  if (action === 'verify') {
    const { videoUrl, genesisId } = body;

    // Verify by Genesis ID
    if (genesisId) {
      try {
        const data = await firestoreQuery('genesis_vault');
        const doc = data.documents?.find(d => 
          d.fields?.genesisId?.stringValue === genesisId
        );
        if (!doc) return res.status(200).json({ verified: false, message: 'ID not found.' });
        const f = doc.fields;
        return res.status(200).json({
          verified: true,
          genesisId: f.genesisId?.stringValue,
          owner: f.ownerName?.stringValue,
          ownerId: f.ownerId?.stringValue,
          title: f.title?.stringValue,
          created: f.createdAt?.stringValue,
          masterHash: f.masterHash?.stringValue,
          frameCount: f.frameCount?.integerValue,
          status: f.status?.stringValue,
        });
      } catch(e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Verify by video content (frame matching)
    if (videoUrl) {
      const queryHashes = await extractFrameHashes(videoUrl);
      
      // Try exact match first (80%+)
      const exactMatch = await findMatchInDatabase(queryHashes, 0.8);
      if (exactMatch) {
        const f = exactMatch.doc.fields;
        return res.status(200).json({
          verified: true,
          matchType: 'exact',
          matchScore: Math.round(exactMatch.score * 100),
          genesisId: f.genesisId?.stringValue,
          owner: f.ownerName?.stringValue,
          title: f.title?.stringValue,
          created: f.createdAt?.stringValue,
          status: f.status?.stringValue,
        });
      }

      // Try partial match (clip detection — 30%+)
      const partialMatch = await findMatchInDatabase(queryHashes, 0.3);
      if (partialMatch) {
        const f = partialMatch.doc.fields;
        return res.status(200).json({
          verified: true,
          matchType: 'partial',
          matchScore: Math.round(partialMatch.score * 100),
          message: `This appears to be a clip from a registered video (${Math.round(partialMatch.score * 100)}% match)`,
          genesisId: f.genesisId?.stringValue,
          owner: f.ownerName?.stringValue,
          title: f.title?.stringValue,
          created: f.createdAt?.stringValue,
        });
      }

      return res.status(200).json({ verified: false, message: 'No match found in Genesis Vault.' });
    }

    return res.status(400).json({ error: 'Provide videoUrl or genesisId.' });
  }

  // ── COLLECTION ────────────────────────────────────────
  if (action === 'collection') {
    const { ownerId } = body;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required.' });

    try {
      const data = await firestoreQuery('genesis_vault');
      const docs = (data.documents || []).filter(doc =>
        doc.fields?.ownerId?.stringValue === ownerId
      );

      const collection = docs.map(doc => ({
        genesisId: doc.fields.genesisId?.stringValue,
        title:     doc.fields.title?.stringValue,
        director:  doc.fields.director?.stringValue,
        masterHash: doc.fields.masterHash?.stringValue,
        frameCount: doc.fields.frameCount?.integerValue,
        status:    doc.fields.status?.stringValue,
        price:     doc.fields.price?.integerValue || 0,
        created:   doc.fields.createdAt?.stringValue,
      }));

      return res.status(200).json({ collection, total: collection.length });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'action required: register | verify | collection | stats' });
};



// ── PEXELS ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/pexels.js
// Pexels Stock Video Search
// ═══════════════════════════════════════════════════════

const PEXELS_KEY = process.env.PEXELS_API_KEY;

async function handle_pexels(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!PEXELS_KEY) return res.status(500).json({ error: 'PEXELS_API_KEY not configured.' });

  const { query = 'sunset', per_page = 12, orientation = 'portrait' } = req.body || req.query || {};

  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${per_page}&orientation=${orientation}&size=medium`;
    
    const r = await fetch(url, {
      headers: { 'Authorization': PEXELS_KEY }
    });

    const data = await r.json();
    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};



// ── WAVESPEED ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/wavespeed.js
// Seedance v1.5 Pro — Text-to-Video with native audio
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_wavespeed(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── POLL ──────────────────────────────────────────────
  if (body.action === 'poll' || (body.id && !body.prompt)) {
    const pollId = body.id;
    if (!pollId) return res.status(400).json({ error: 'No prediction ID' });

    try {
      const pollUrl = 'https://api.wavespeed.ai/api/v3/predictions/' + pollId + '/result';
      const pr = await fetch(pollUrl, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status || 'processing';
      const url = (data.outputs && data.outputs.length > 0 && data.outputs[0])
        || data.url || data.output || null;

      console.log('POLL:', JSON.stringify({ status, url: url ? url.substring(0, 60) : 'NULL' }));

      const normalizedStatus = (status === 'succeeded') ? 'completed' : status;
      return res.status(200).json({ status: normalizedStatus, url, id: pollId });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE ──────────────────────────────────────────
  const prompt = body.prompt || '';
  const duration = Math.min(parseInt(body.duration) || 10, 12);

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Prompt too short' });
  }

  console.log('=== SEEDANCE 1.5 PRO GENERATE ===');
  console.log('Prompt:', prompt.substring(0, 100));
  console.log('Duration:', duration);

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/bytedance/seedance-v1.5-pro/text-to-video', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        duration: duration,
        aspect_ratio: '16:9',
        resolution: '720p',
        generate_audio: true,
        camera_fixed: false,
        seed: -1
      })
    });

    const d = await r.json();
    console.log('HTTP status:', r.status);
    console.log('Response:', JSON.stringify(d).substring(0, 300));

    const jobId = (d.data && d.data.id) || d.id || null;
    const pollUrl = jobId
      ? 'https://api.wavespeed.ai/api/v3/predictions/' + jobId + '/result'
      : null;

    if (!jobId) {
      return res.status(400).json({ error: 'No job ID returned', raw: d });
    }

    return res.status(200).json({ id: jobId, pollUrl, status: 'processing' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};



// ── AUDIOFORGE ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/audioforge.js
// Neural Audio Generation using WaveSpeed Mureka
// Cost: 25 GNS per track
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_audioforge(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
  if (body.action === 'poll') {
    const { jobId } = body;
    if (!jobId) return res.status(400).json({ error: 'jobId required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${jobId}/result`, {
        method: 'GET', headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const audioUrl = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ 
        status, audioUrl, jobId,
        duration: '03:00',
        terminalLog: status === 'completed' ? ['NEURAL_SYNTHESIS_COMPLETE', 'AUDIO_READY_FOR_PLAYBACK'] : ['PROCESSING_AUDIO_LAYERS...']
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE ─────────────────────────────────────────
  const { prompt = '', action } = body;
  if (action !== 'generate' && !prompt) return res.status(400).json({ error: 'prompt required.' });

  console.log('=== AUDIOFORGE ===', prompt.substring(0, 80));

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/mureka-v6', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.trim(), duration: 30 })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ jobId, status: 'processing' });

  } catch (e) {
    console.error('AudioForge error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── BGREMOVER ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/bgremover.js
// Image/Video Background Remover & Replacer
// Image: 5 GNS ($0.01 cost) | Video: 15 GNS
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_bgremover(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET', headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ status, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PROCESS ───────────────────────────────────────────
  const { input_url, mode = 'image', action = 'remove', bg_url } = body;
  if (!input_url) return res.status(400).json({ error: 'input_url required.' });

  let endpoint, requestBody;

  if (mode === 'image') {
    if (action === 'remove') {
      // Remove background → transparent PNG
      endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/image-background-remover';
      requestBody = { image: input_url };
    } else {
      // Replace background
      endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/image-background-remover';
      requestBody = { image: input_url };
      // After removal we'll composite with bg (simple approach)
    }
  } else {
    // Video background remover
    endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/video-background-remover';
    requestBody = { video: input_url };
    if (action === 'replace' && bg_url) {
      requestBody.background_image = bg_url;
    }
  }

  console.log('=== BGREMOVER ===', mode, action);

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    // Check for instant result
    const outputs = d.data?.outputs || d.outputs;
    if (outputs && outputs[0]) {
      return res.status(200).json({ url: outputs[0], status: 'completed' });
    }

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    console.error('BGRemover error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── FACESWAP ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/faceswap.js
// AI Face Swap using WaveSpeed
// Cost: 20 CR per swap
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_faceswap(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ status, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── FACESWAP ─────────────────────────────────────────
  const { source_face_url, target_url, target_type = 'image' } = body;

  if (!source_face_url) return res.status(400).json({ error: 'source_face_url required.' });
  if (!target_url) return res.status(400).json({ error: 'target_url required.' });

  console.log('=== FACESWAP ===');
  console.log('Target type:', target_type);

  // Choose endpoint based on target type
  const endpoint = target_type === 'video'
    ? 'https://api.wavespeed.ai/api/v3/wavespeed-ai/faceswap-video'
    : 'https://api.wavespeed.ai/api/v3/wavespeed-ai/faceswap';

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_image: source_face_url,
        target_image: target_type === 'image' ? target_url : undefined,
        target_video: target_type === 'video' ? target_url : undefined,
        face_restore: true,
        face_upsample: true
      })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    console.error('Faceswap error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── ANIMATE ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — /api/animate.js
// Video Animation: Static Image → Animated Video
// Using WaveSpeed AI (Wan 2.1 i2v)
// Cost: 25 CR per animation
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;
const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3';

async function handle_animate(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const { action, prompt, image_url, duration = 5, id, pollUrl } = req.body || {};

  // ── POLL STATUS ──────────────────────────────────────
  if (action === 'poll' || (id && !prompt)) {
    if (!id) return res.status(400).json({ error: 'id required for polling.' });

    try {
      const url = `${WAVESPEED_BASE}/predictions/${id}/result`;
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${KEY}` }
      });
      const pd = await r.json();
      const data = pd.data || pd;
      const status = data.status || 'processing';
      const videoUrl = (data.outputs && data.outputs[0]) || data.url || null;

      return res.status(200).json({
        status: status === 'succeeded' ? 'completed' : status,
        url: videoUrl,
        id
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── GENERATE: Image → Video ──────────────────────────
  if (!image_url) return res.status(400).json({ error: 'image_url required.' });
  if (!prompt || prompt.trim().length < 5) return res.status(400).json({ error: 'prompt required (min 5 chars).' });

  const safeDuration = Math.min(parseInt(duration) || 5, 10);

  console.log('=== ANIMATE: Image → Video ===');
  console.log('Prompt:', prompt.substring(0, 100));
  console.log('Duration:', safeDuration);

  try {
    const r = await fetch(`${WAVESPEED_BASE}/wavespeed-ai/wan2.1-i2v-480p`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt.trim(),
        image: image_url,
        duration: safeDuration,
        aspect_ratio: '16:9',
        negative_prompt: 'blurry, distorted, low quality, static, no movement'
      })
    });

    const d = await r.json();
    console.log('WaveSpeed response status:', r.status);

    const jobId = (d.data && d.data.id) || d.id || null;
    const poll = (d.data && d.data.urls && d.data.urls.get)
      || (jobId ? `${WAVESPEED_BASE}/predictions/${jobId}/result` : null);

    if (!jobId) {
      return res.status(400).json({ error: 'No job ID returned.', raw: d });
    }

    return res.status(200).json({
      id: jobId,
      pollUrl: poll,
      status: 'processing',
      estimatedSeconds: 45
    });

  } catch (e) {
    console.error('Animate error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── LIPSYNC ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/lipsync.js
// AI Lip Sync using WaveSpeed Sync Lipsync-2-Pro
// Cost: 30 CR per sync (covers ~30s audio)
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_lipsync(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ status, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── LIPSYNC ──────────────────────────────────────────
  const { video_url, audio_url, image_url, mode = 'video', sync_mode = 'cut_off' } = body;

  if (!audio_url) return res.status(400).json({ error: 'audio_url required.' });

  console.log('=== LIPSYNC ===');
  console.log('Mode:', mode, '| Sync mode:', sync_mode);

  try {
    let endpoint, requestBody;

    if (mode === 'image') {
      // Image + audio → talking video (InfiniteTalk)
      if (!image_url) return res.status(400).json({ error: 'image_url required for image mode.' });
      endpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
      requestBody = { image: image_url, audio: audio_url };
    } else {
      // Video + audio → lipsync (Lipsync-2-Pro)
      if (!video_url) return res.status(400).json({ error: 'video_url required for video mode.' });
      endpoint = 'https://api.wavespeed.ai/api/v3/sync/lipsync-2-pro';
      requestBody = { video: video_url, audio: audio_url, sync_mode };
    }

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing', mode });

  } catch (e) {
    console.error('Lipsync error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── DEAGING ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/deaging.js
// AI Age Filter using WaveSpeed
// Cost: 30 CR per transformation
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_deaging(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ status, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DEAGING ──────────────────────────────────────────
  const { image_url, target_age = 25 } = body;

  if (!image_url) return res.status(400).json({ error: 'image_url required.' });

  const safeAge = Math.min(Math.max(parseInt(target_age) || 25, 1), 90);

  console.log('=== DEAGING ===');
  console.log('Target age:', safeAge);

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/ai-age-filter', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: image_url,
        target_age: safeAge
      })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    console.error('Deaging error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── CONVERT ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/convert.js
// Video Format Conversion using WaveSpeed FFmpeg
// Cost: 8 CR per conversion
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_convert(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!KEY) return res.status(500).json({ error: 'WAVESPEED_API_KEY not configured.' });

  const body = req.body || {};

  // ── POLL ─────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });
    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status === 'succeeded' ? 'completed' : (data.status || 'processing');
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      return res.status(200).json({ status, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── CONVERT ──────────────────────────────────────────
  const { video_url, format = 'mp4', quality = 'high' } = body;

  if (!video_url) return res.status(400).json({ error: 'video_url required.' });

  // Map quality to CRF value
  const crfMap = { low: 32, medium: 24, high: 18, ultra: 12 };
  const crf = crfMap[quality.toLowerCase()] || 18;

  // Supported formats
  const supportedFormats = ['mp4', 'webm', 'mov', 'avi', 'gif', 'mkv'];
  const targetFormat = supportedFormats.includes(format.toLowerCase()) ? format.toLowerCase() : 'mp4';

  console.log('=== CONVERT ===');
  console.log('Format:', targetFormat, '| Quality:', quality, '| CRF:', crf);
  console.log('Input:', video_url.substring(0, 80));

  try {
    const r = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/video-converter', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video: video_url,
        output_format: targetFormat,
        crf: crf
      })
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;

    if (!jobId) {
      // Fallback: if conversion API not available, return original
      console.warn('No job ID - returning original URL as fallback');
      return res.status(200).json({
        status: 'completed',
        url: video_url,
        fallback: true,
        message: 'Conversion service unavailable. Original file returned.'
      });
    }

    return res.status(200).json({ id: jobId, status: 'processing', format: targetFormat });

  } catch (e) {
    console.error('Convert error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── UPSCALE ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/upscale.js
// Video/Image Upscaler using WaveSpeed
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;

async function handle_upscale(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const body = req.body || {};

  // ── POLL ──────────────────────────────────────────────
  if (body.action === 'poll') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required.' });

    try {
      const pr = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${id}/result`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + KEY }
      });
      const pd = await pr.json();
      const data = pd.data || pd;
      const status = data.status || 'processing';
      const url = (data.outputs && data.outputs[0]) || data.url || null;
      const normalizedStatus = status === 'succeeded' ? 'completed' : status;
      return res.status(200).json({ status: normalizedStatus, url, id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── UPSCALE ───────────────────────────────────────────
  const { input_url, type = 'video', scale = 4 } = body;

  if (!input_url) return res.status(400).json({ error: 'input_url required.' });

  // Choose endpoint based on type
  const endpoint = type === 'image'
    ? 'https://api.wavespeed.ai/api/v3/wavespeed-ai/image-upscaler'
    : 'https://api.wavespeed.ai/api/v3/wavespeed-ai/video-upscaler-pro';

  console.log('=== UPSCALE ===');
  console.log('Type:', type, '| Scale:', scale);
  console.log('Input:', input_url.substring(0, 80));

  try {
    const requestBody = type === 'image'
      ? { image: input_url, scale: Math.min(parseInt(scale) || 4, 4) }
      : { video: input_url, scale: Math.min(parseInt(scale) || 4, 4) };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const d = await r.json();
    console.log('Response:', JSON.stringify(d).substring(0, 200));

    const jobId = (d.data && d.data.id) || d.id || null;
    if (!jobId) return res.status(400).json({ error: 'No job ID returned', raw: d });

    return res.status(200).json({ id: jobId, status: 'processing' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};



// ── SEMANTIC ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/semantic.js
// Screenplay Semantic Analysis using Claude
// ═══════════════════════════════════════════════════════

const KEY = process.env.ANTHROPIC_API_KEY;

async function handle_semantic(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const { text = '', params = [] } = req.body || {};

  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: 'Text too short. Minimum 50 characters.' });
  }
  if (!KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });

  const system = `You are a professional screenplay analyst at MercaDream.
Analyze the provided screenplay or creative text and return scores for these metrics.
Return ONLY a valid JSON object with scores from 1-10. No explanation, no markdown.

{
  "pacing": <1-10>,
  "arc": <1-10>,
  "dialogue": <1-10>,
  "emotion": <1-10>,
  "plot": <1-10>,
  "summary": "<one sentence analysis>",
  "strongest": "<the strongest element>",
  "weakest": "<the element that needs most work>"
}`;

  const userMsg = `Analyze this text:\n\n${text.substring(0, 8000)}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: userMsg }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || 'Claude API error' });
    }

    const data = await response.json();
    const text_response = data.content?.[0]?.text || '';

    // Parse JSON
    const clean = text_response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const scores = JSON.parse(clean);

    return res.status(200).json({ scores, usage: data.usage });

  } catch (err) {
    console.error('Semantic error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};



// ── DIRECTOR ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/director.js
// Scriptwriter + Director System
// ═══════════════════════════════════════════════════════

// ── SCRIPTWRITER ─────────────────────────────────────
const SCRIPTWRITER = `You are Alex Mercer — Chief Scriptwriter at MercaDream.

YOUR ROLE:
You are NOT a director. You write screenplays.
You think in dialogue, story beats, and narrative structure.
The director will handle visuals AFTER you finish.

YOUR RULES:
1. Every scene has a CLEAR PURPOSE — no filler, no decoration
2. Every spoken word serves the goal of the brief
3. You write in English ONLY — all dialogue must be in English
4. No Chinese, Arabic, French, or any other language in dialogue
5. Keep dialogue natural and concise — humans speak in short sentences
6. Each scene = one clear idea, one clear action, one clear line

SCENE COUNT: You will receive the exact number of scenes to write.
DURATION: Each scene is 10 seconds.

OUTPUT FORMAT: Valid JSON array ONLY. No markdown. No backticks. No explanation.

[
  {
    "scene": 1,
    "title": "Scene Title",
    "dialogue": "The exact words spoken in this scene. In English only. Maximum 2 sentences.",
    "action": "What physically happens in this scene. One clear action.",
    "purpose": "Why this scene exists in the film. One sentence.",
    "location": "Where this scene takes place.",
    "mood": "The emotional tone of this scene in one word."
  }
]`;

// ── DIRECTORS ─────────────────────────────────────────
const DIRECTORS = {

  drama: `You are Marco Visconti — Drama Director at MercaDream.

VISUAL PHILOSOPHY:
Tarkovsky: Slow down to reveal what fast cinema hides.
Wong Kar-Wai: The space between people carries more emotion than contact.
Bergman: The face is the landscape of the soul.
Lighting: Side light = moral complexity. Chiaroscuro = truth at the edge of shadow.

YOUR ROLE:
You receive a screenplay from the scriptwriter.
You translate each scene into precise visual language for AI video generation.
You describe WHAT THE CAMERA SEES — not what the story means.

CRITICAL RULES:
- ALL dialogue and text in videos must be in ENGLISH ONLY
- No Chinese, Arabic, or any other language in your prompts
- Write prompts that AI video generators can execute precisely
- Maximum 100 words per prompt — be precise, not poetic

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Subject description. Environment. Camera movement. Lighting. Color. Action. Audio cue. English dialogue only.",
  "visual": "One sentence: the defining image.",
  "camera": "Shot type + movement",
  "lighting": "Light source + mood",
  "emotional_beat": "What viewer feels"
}`,

  comedy: `You are Elena Bright — Comedy Director at MercaDream.

VISUAL PHILOSOPHY:
Timing is everything. A beat too late = dead silence.
Wide shots reveal absurdity. Close-ups reveal reaction.
Contrast is the engine: expect X, get Y.

YOUR ROLE:
You receive a screenplay. You translate it into visual comedy beats.
Every prompt must make the AI generate something that makes people laugh.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Write prompts that emphasize comic timing and reaction shots
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title", 
  "prompt": "SHOT TYPE. Comic setup description. Reaction beat. Timing note. English dialogue only.",
  "visual": "The comic image in one sentence.",
  "camera": "Shot type",
  "lighting": "Light mood",
  "emotional_beat": "The laugh moment"
}`,

  action: `You are Rex Storm — Action Director at MercaDream.

VISUAL PHILOSOPHY:
Geography, stakes, escalation.
The audience always knows: who is winning, where they are, why it matters.

YOUR ROLE:
You receive a screenplay. You translate it into high-energy visual sequences.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Every prompt must convey speed, danger, or power
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Action description. Energy level. Camera movement. Impact moment. English dialogue only.",
  "visual": "The power image in one sentence.",
  "camera": "Shot + movement",
  "lighting": "Contrast and drama",
  "emotional_beat": "The adrenaline peak"
}`,

  doc: `You are Sara Truth — Documentary Director at MercaDream.

VISUAL PHILOSOPHY:
Reality is the material. The edit is the argument.
Handheld = intimacy = trust.

YOUR ROLE:
You receive a screenplay. You translate it into authentic documentary visuals.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Prompts must feel real, not staged
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "HANDHELD SHOT. Real environment. Natural light. Authentic moment. Subject behavior. English dialogue only.",
  "visual": "The truth moment in one sentence.",
  "camera": "Handheld + movement",
  "lighting": "Natural light description",
  "emotional_beat": "The human truth"
}`,

  music: `You are Kai Neon — Music Video Director at MercaDream.

VISUAL PHILOSOPHY:
Every cut lands on the beat. Every frame IS music.
Color is emotion. Neon is energy.

YOUR ROLE:
You receive a screenplay. You translate it into music video visuals.

CRITICAL RULES:
- ALL dialogue/lyrics must be in ENGLISH ONLY
- Prompts must be visually spectacular
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Artist description. Neon environment. Beat-sync moment. Color explosion. English lyrics only.",
  "visual": "The iconic frame in one sentence.",
  "camera": "Shot + rhythm",
  "lighting": "Neon and color",
  "emotional_beat": "The musical peak"
}`,

  ads: `You are Nova Brand — Commercial Director at MercaDream.

VISUAL PHILOSOPHY:
Hook in 3 seconds or lose them forever.
One idea. Executed perfectly. The product is the hero.

YOUR ROLE:
You receive a screenplay. You translate it into high-impact commercial visuals.

CRITICAL RULES:
- ALL dialogue must be in ENGLISH ONLY
- Every frame must sell — clarity over beauty
- Maximum 100 words per prompt

SCENE FORMAT:
{
  "scene": 1,
  "title": "Scene Title",
  "prompt": "SHOT TYPE. Product hero shot. Clean environment. Brand colors. Clear action. English tagline only.",
  "visual": "The selling image in one sentence.",
  "camera": "Clean shot + movement",
  "lighting": "Brand-appropriate light",
  "emotional_beat": "The desire created"
}`

};

// ── SCENE FORMAT FOR DIRECTORS ─────────────────────────
const DIRECTOR_OUTPUT_FORMAT = `
OUTPUT: Valid JSON array ONLY. No text before or after. No markdown backticks.
Return exactly the number of scenes requested.
All dialogue and text elements must be in ENGLISH ONLY — never Chinese, Arabic, or any other language.
`;

async function handle_director(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const {
    type = 'drama',
    brief = '',
    conversation = '',
    scene_count = 6,
    mode = 'full', // 'screenplay' = scriptwriter only, 'full' = scriptwriter + director
    screenplay = null, // pre-written screenplay to send directly to director
    model = 'claude-haiku-4-5-20251001'
  } = req.body || {};

  if (!brief && !conversation && !screenplay) {
    return res.status(400).json({ error: 'brief, conversation, or screenplay required.' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
  }

  // ── STEP 1: SCRIPTWRITER ─────────────────────────────
  let scriptwriterScenes = screenplay;

  if (!scriptwriterScenes) {
    const scriptwriterPrompt = `${SCRIPTWRITER}

IMPORTANT: Generate EXACTLY ${scene_count} scenes. Each scene is 10 seconds.
All dialogue MUST be in English only.`;

    const scriptwriterContent = [
      conversation ? `CONTEXT:\n${conversation}` : '',
      brief ? `BRIEF:\n${brief}` : '',
      `Generate exactly ${scene_count} scenes. Return JSON array only. English dialogue only.`
    ].filter(Boolean).join('\n\n---\n\n');

    try {
      const swResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 3000,
          system: scriptwriterPrompt,
          messages: [{ role: 'user', content: scriptwriterContent }]
        })
      });

      if (!swResponse.ok) {
        const err = await swResponse.json().catch(() => ({}));
        return res.status(500).json({ error: 'Scriptwriter failed: ' + (err.error?.message || swResponse.status) });
      }

      const swData = await swResponse.json();
      const swText = swData.content?.[0]?.text || '';
      console.log('SCRIPTWRITER RAW:', swText.substring(0, 300));

      const swClean = swText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const swMatch = swClean.match(/\[\s*\{[\s\S]*\}\s*\]/);

      if (!swMatch) {
        return res.status(500).json({ error: 'Scriptwriter returned no valid screenplay.', raw: swText.substring(0, 300) });
      }

      scriptwriterScenes = JSON.parse(swMatch[0]);
      console.log('SCRIPTWRITER: Generated', scriptwriterScenes.length, 'scenes');

      // If mode is screenplay only — return here
      if (mode === 'screenplay') {
        return res.status(200).json({
          screenplay: scriptwriterScenes,
          scene_count: scriptwriterScenes.length,
          mode: 'screenplay'
        });
      }

    } catch (err) {
      return res.status(500).json({ error: 'Scriptwriter error: ' + err.message });
    }
  }

  // ── STEP 2: DIRECTOR ─────────────────────────────────
  const directorPrompt = DIRECTORS[type];
  if (!directorPrompt) {
    return res.status(400).json({
      error: `Unknown director type: "${type}"`,
      available: Object.keys(DIRECTORS)
    });
  }

  const system = `${directorPrompt}\n\n${DIRECTOR_OUTPUT_FORMAT}`;

  const directorContent = `SCREENPLAY FROM SCRIPTWRITER:
${JSON.stringify(scriptwriterScenes, null, 2)}

---
Translate this screenplay into ${scriptwriterScenes.length} visual prompts for AI video generation.
All dialogue and text must be in ENGLISH ONLY.
Return JSON array only.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: directorContent }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `Anthropic HTTP ${response.status}`;
      if (response.status === 401) return res.status(500).json({ error: 'Invalid API key.' });
      if (response.status === 429) return res.status(429).json({ error: 'Rate limit — retry.' });
      return res.status(response.status).json({ error: msg });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    console.log('DIRECTOR RAW:', text.substring(0, 500));
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (!jsonMatch) {
      console.error('No JSON in director response:', text.substring(0, 300));
      return res.status(500).json({ error: 'Director returned no valid scenes.', raw: text.substring(0, 300) });
    }

    let scenes;
    try {
      scenes = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse failed.', raw: jsonMatch[0].substring(0, 300) });
    }

    return res.status(200).json({
      scenes,
      screenplay: scriptwriterScenes,
      director: type,
      director_name: getDirectorName(type),
      model,
      scene_count: scenes.length,
      usage: data.usage
    });

  } catch (err) {
    console.error('Director API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function getDirectorName(type) {
  const names = {
    drama:   'Marco Visconti',
    comedy:  'Elena Bright',
    music:   'Kai Neon',
    ads:     'Nova Brand',
    action:  'Rex Storm',
    doc:     'Sara Truth'
  };
  return names[type] || type;
}



// ── CHECKOUT ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/checkout.js
// Stripe Checkout — Credits Purchase
// $0.10 per credit — flat rate, no discounts
// ═══════════════════════════════════════════════════════

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const BASE_URL = 'https://www.mercadream.com';

async function handle_checkout(req, res) {
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const BASE_URL = 'https://www.mercadream.com';
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  if (!STRIPE_KEY) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured.' });

  const { amount, userId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'userId required.' });

  const creditAmount = parseInt(amount) || 100;
  if (creditAmount < 10) return res.status(400).json({ error: 'Minimum 10 credits.' });

  // $0.10 per credit — flat, no discounts
  const priceInCents = creditAmount * 10; // 10 cents per credit

  console.log('=== CHECKOUT ===');
  console.log('Credits:', creditAmount, '| Price: $' + (priceInCents/100).toFixed(2));
  console.log('User:', userId);

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `MercaDream — ${creditAmount.toLocaleString()} Credits`,
            description: 'AI Cinema Credits · $0.10 per credit',
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${BASE_URL}/pricing.html?status=success&credits=${creditAmount}&uid=${userId}`,
      cancel_url: `${BASE_URL}/pricing.html?status=cancelled`,
      metadata: {
        userId,
        credits: creditAmount.toString(),
      },
      client_reference_id: userId,
    });

    return res.status(200).json({ url: session.url });

  } catch (e) {
    console.error('Checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};



// ── WEBHOOK ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════
// MERCADREAM — api/webhook.js
// Stripe → Firebase Firestore
// ═══════════════════════════════════════════════════════

const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── FIRESTORE REST API ────────────────────────────────
const FIREBASE_PROJECT = 'mercadream-4b4b3';
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

async function getFirestoreToken() {
  // Use service account or API key
  return process.env.FIREBASE_API_KEY || '';
}

async function getUser(uid) {
  const apiKey = process.env.FIREBASE_API_KEY;
  const url = `${FIREBASE_URL}/users/${uid}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.fields || null;
}

async function updateUserCredits(uid, newCredits) {
  const apiKey = process.env.FIREBASE_API_KEY;
  const url = `${FIREBASE_URL}/users/${uid}?key=${apiKey}&updateMask.fieldPaths=credits&updateMask.fieldPaths=recharges`;
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        credits:  { integerValue: newCredits },
        recharges: { integerValue: Date.now() }
      }
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error('Firestore update failed: ' + JSON.stringify(err));
  }
  return await res.json();
}

// ── MAIN HANDLER ─────────────────────────────────────
async function handle_webhook(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const buf = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId  = session.client_reference_id;
    const credits = parseInt(session.metadata?.credits || '0');

    console.log(`[Webhook] User: ${userId} | Credits: ${credits}`);

    if (!userId || credits < 1) {
      console.warn('[Webhook] Missing userId or credits in metadata');
      return res.status(200).json({ received: true });
    }

    try {
      // Get current balance
      const user = await getUser(userId);
      const currentCredits = user?.credits?.integerValue
        ? parseInt(user.credits.integerValue)
        : 0;

      const newCredits = currentCredits + credits;
      await updateUserCredits(userId, newCredits);

      console.log(`[Webhook] ✅ Credits updated: ${currentCredits} + ${credits} = ${newCredits}`);
    } catch (err) {
      console.error('[Webhook] Firestore error:', err.message);
      // Return 200 to prevent Stripe retries, log the error
    }
  }

  return res.status(200).json({ received: true });
};



// ═══════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract service name from URL
  // /api/fingerprint → fingerprint
  // /api/wavespeed   → wavespeed
  const url = req.url || '';
  const parts = url.split('/').filter(Boolean);
  const service = parts[parts.length - 1]?.split('?')[0];

  const routes = {
    'fingerprint': handle_fingerprint,
    'pexels':      handle_pexels,
    'wavespeed':   handle_wavespeed,
    'audioforge':  handle_audioforge,
    'bgremover':   handle_bgremover,
    'faceswap':    handle_faceswap,
    'animate':     handle_animate,
    'lipsync':     handle_lipsync,
    'deaging':     handle_deaging,
    'convert':     handle_convert,
    'upscale':     handle_upscale,
    'semantic':    handle_semantic,
    'director':    handle_director,
    'checkout':    handle_checkout,
    'webhook':     handle_webhook,
  };

  const fn = routes[service];
  if (!fn) {
    return res.status(404).json({ 
      error: 'Unknown service: ' + service,
      available: Object.keys(routes)
    });
  }

  try {
    await fn(req, res);
  } catch(e) {
    console.error('[' + service + '] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
