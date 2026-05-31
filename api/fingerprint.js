// ═══════════════════════════════════════════════════════
// MERCADREAM — api/fingerprint.js
// Video DNA System — Register & Verify Ownership
// ═══════════════════════════════════════════════════════

const KEY = process.env.WAVESPEED_API_KEY;
const FIREBASE_PROJECT = 'mercadream-4b4b3';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// Generate unique Genesis ID
function generateGenesisId(uid) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const userPart = uid.substring(0, 6).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GNS-${timestamp}-${userPart}-${random}`;
}

// Simple perceptual hash from video URL (fetch first frame metadata)
async function computeVideoHash(videoUrl) {
  // Use URL + timestamp as base hash (upgrade to real perceptual hash later)
  const urlHash = Buffer.from(videoUrl).toString('base64').substring(0, 32);
  const timeHash = Date.now().toString(36);
  return `${urlHash}-${timeHash}`;
}

// Save to Firestore
async function registerToFirestore(genesisId, data) {
  const url = `${FIREBASE_URL}/genesis_vault?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        genesisId:    { stringValue: genesisId },
        videoUrl:     { stringValue: data.videoUrl },
        videoHash:    { stringValue: data.videoHash },
        ownerId:      { stringValue: data.ownerId },
        ownerName:    { stringValue: data.ownerName || 'Anonymous' },
        title:        { stringValue: data.title || 'Untitled' },
        director:     { stringValue: data.director || 'Unknown' },
        prompt:       { stringValue: data.prompt || '' },
        duration:     { stringValue: data.duration || '15s' },
        status:       { stringValue: 'owned' }, // owned | for_sale | sold
        price:        { integerValue: 0 },
        createdAt:    { stringValue: new Date().toISOString() },
        transferLog:  { arrayValue: { values: [
          { stringValue: `Created by ${data.ownerId} on ${new Date().toISOString()}` }
        ]}}
      }
    })
  });
  return await res.json();
}

// Search by hash
async function findByHash(hash) {
  const url = `${FIREBASE_URL}/genesis_vault?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.documents) return null;
  return data.documents.find(doc => 
    doc.fields?.videoHash?.stringValue === hash
  ) || null;
}

// Search by Genesis ID
async function findById(genesisId) {
  const url = `${FIREBASE_URL}/genesis_vault?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.documents) return null;
  return data.documents.find(doc =>
    doc.fields?.genesisId?.stringValue === genesisId
  ) || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const body = req.body || {};
  const { action } = body;

  // ── REGISTER — after video generation ──────────────
  if (action === 'register') {
    const { videoUrl, ownerId, ownerName, title, director, prompt } = body;
    if (!videoUrl || !ownerId) {
      return res.status(400).json({ error: 'videoUrl and ownerId required.' });
    }

    const genesisId = generateGenesisId(ownerId);
    const videoHash = await computeVideoHash(videoUrl);

    await registerToFirestore(genesisId, {
      videoUrl, videoHash, ownerId, ownerName,
      title, director, prompt, duration: '15s'
    });

    console.log(`✅ Registered: ${genesisId} → ${ownerId}`);

    return res.status(200).json({
      genesisId,
      videoHash,
      message: 'Video DNA registered successfully.',
      certificate: {
        id: genesisId,
        owner: ownerName || ownerId,
        created: new Date().toISOString(),
        verified: true
      }
    });
  }

  // ── VERIFY — check ownership ────────────────────────
  if (action === 'verify') {
    const { videoUrl, genesisId } = body;

    if (genesisId) {
      const doc = await findById(genesisId);
      if (!doc) return res.status(200).json({ verified: false, message: 'ID not found.' });
      const f = doc.fields;
      return res.status(200).json({
        verified: true,
        genesisId: f.genesisId?.stringValue,
        owner: f.ownerName?.stringValue,
        ownerId: f.ownerId?.stringValue,
        title: f.title?.stringValue,
        director: f.director?.stringValue,
        created: f.createdAt?.stringValue,
        status: f.status?.stringValue,
        price: f.price?.integerValue || 0
      });
    }

    if (videoUrl) {
      const hash = await computeVideoHash(videoUrl);
      const doc = await findByHash(hash);
      if (!doc) return res.status(200).json({ verified: false, message: 'No match found.' });
      const f = doc.fields;
      return res.status(200).json({
        verified: true,
        genesisId: f.genesisId?.stringValue,
        owner: f.ownerName?.stringValue,
        title: f.title?.stringValue,
        status: f.status?.stringValue
      });
    }

    return res.status(400).json({ error: 'Provide videoUrl or genesisId.' });
  }

  // ── LIST — get user's collection ────────────────────
  if (action === 'collection') {
    const { ownerId } = body;
    if (!ownerId) return res.status(400).json({ error: 'ownerId required.' });

    const url = `${FIREBASE_URL}/genesis_vault?key=${FIREBASE_API_KEY}`;
    const r = await fetch(url);
    const data = await r.json();

    const docs = (data.documents || []).filter(doc =>
      doc.fields?.ownerId?.stringValue === ownerId
    );

    const collection = docs.map(doc => ({
      genesisId: doc.fields.genesisId?.stringValue,
      title:     doc.fields.title?.stringValue,
      director:  doc.fields.director?.stringValue,
      videoUrl:  doc.fields.videoUrl?.stringValue,
      status:    doc.fields.status?.stringValue,
      price:     doc.fields.price?.integerValue || 0,
      created:   doc.fields.createdAt?.stringValue
    }));

    return res.status(200).json({ collection, total: collection.length });
  }

  return res.status(400).json({ error: 'action required: register | verify | collection' });
};
