'use strict';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_URL = \https://firestore.googleapis.com/v1/projects/mercadream-4b4b3/databases/(default)/documents/genesis_vault\;

// الدالة المركزية لاستدعاء Gemini لكل وكيل
async function callGemini(analystType, videoData) {
  const url = \https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\\;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: \Role: \. Analyze the provided video data/frames and extract specific technical features as a structured JSON object. Focus on technical accuracy for video fingerprinting.\ }, { text: videoData }]
      }]
    })
  });
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const { videoData, videoId } = req.body;
    const analysts = [
      'PIXEL_DECODER', 'MOTION_VECTORIZER', 'GEOMETRY_MASTER',
      'PHYSICS_CALCULATOR', 'PATTERN_RECOGNIZER', 'MATH_ENCODER'
    ];

    // تشغيل الـ 6 وكلاء بالتوازي
    const results = await Promise.all(analysts.map(a => callGemini(a, videoData)));
    
    const fingerprint = {};
    analysts.forEach((a, i) => { fingerprint[a] = results[i]; });

    // تسجيل البصمة في Firebase
    await fetch(\\/\?key=\\, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fields: { 
          fingerprint: { stringValue: JSON.stringify(fingerprint) },
          status: { stringValue: 'REGISTERED' },
          timestamp: { timestampValue: new Date().toISOString() }
        } 
      })
    });

    res.status(200).json({ success: true, fingerprint });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
