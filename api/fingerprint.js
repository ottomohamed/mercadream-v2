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
module.exports = async function handler(req, res) {
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
