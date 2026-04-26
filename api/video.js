// ═══════════════════════════════════════════════════
// MERCADREAM — /api/video.js
// Vercel Serverless Function → Alibaba DashScope Wan
// ═══════════════════════════════════════════════════
// SETUP in Vercel Environment Variables:
//   ALIBABA_API_KEY = sk-...   (from Alibaba Model Studio)
//   ANTHROPIC_API_KEY = sk-ant-... (already set)
// ═══════════════════════════════════════════════════
//
// ENDPOINTS:
//   POST /api/video          → submit generation task → returns { taskId }
//   GET  /api/video?id=xxx   → poll status            → returns { status, videoUrl }
// ═══════════════════════════════════════════════════

const DASHSCOPE_BASE = 'https://dashscope-intl.aliyuncs.com/api/v1';

// Wan model options — choose based on plan
const MODELS = {
  regular:      'wan2.1-t2v-turbo',   // fastest, cheapest — 720p
  advanced:     'wan2.6-t2v',         // better quality — 1080p
  professional: 'wan2.6-t2v'          // best quality — 1080p (+ upscale to 4K)
};

export default async function handler(req, res) {

  // CORS
  const origin = req.headers.origin || '';
  const allowed = [
    'https://www.mercadream.com',
    'https://mercadream.com',
    'https://mercadream.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.ALIBABA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ALIBABA_API_KEY not configured in Vercel.' });
  }

  // ── GET: Poll task status ──
  if (req.method === 'GET') {
    const taskId = req.query.id;
    if (!taskId) return res.status(400).json({ error: 'Missing task id.' });

    try {
      const response = await fetch(
        `${DASHSCOPE_BASE}/tasks/${taskId}`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: e.message || `Alibaba HTTP ${response.status}` });
      }

      const data = await response.json();
      const output = data?.output || {};
      const status = output.task_status || 'UNKNOWN';

      // Map Alibaba status → simple status
      const statusMap = {
        'PENDING':   'queued',
        'RUNNING':   'generating',
        'SUCCEEDED': 'completed',
        'FAILED':    'failed',
        'CANCELED':  'failed'
      };

      return res.status(200).json({
        status: statusMap[status] || 'generating',
        taskId,
        videoUrl: output.video_url || null,
        raw_status: status
      });

    } catch (err) {
      console.error('Poll error:', err.message);
      return res.status(500).json({ error: 'Failed to poll task.', details: err.message });
    }
  }

  // ── POST: Submit generation task ──
  if (req.method === 'POST') {
    const {
      prompt,
      plan = 'regular',
      resolution = '720P',
      aspect_ratio = '16:9',
      duration = 5
    } = req.body || {};

    if (!prompt || prompt.trim().length < 10) {
      return res.status(400).json({ error: 'Prompt is required and must be at least 10 characters.' });
    }

    const model = MODELS[plan] || MODELS.regular;

    // Cap duration: 5s for regular, 10s for advanced+
    const safeDuration = plan === 'regular'
      ? Math.min(parseInt(duration) || 5, 5)
      : Math.min(parseInt(duration) || 10, 10);

    try {
      const body = {
        model,
        input: {
          prompt: prompt.trim()
        },
        parameters: {
          size: resolution === '720P' ? '1280*720' : '1920*1080',
          duration: safeDuration,
          watermark: false,
          prompt_extend: true     // Alibaba's built-in prompt enhancement
        }
      };

      console.log(`[video] Submitting: model=${model} res=${resolution} dur=${safeDuration}s`);

      const response = await fetch(`${DASHSCOPE_BASE}/services/aigc/video-generation/video-synthesis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable'  // async mode — returns task_id immediately
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        console.error('Alibaba submission error:', response.status, e);

        if (response.status === 401) {
          return res.status(500).json({ error: 'Invalid ALIBABA_API_KEY — check Vercel env vars.' });
        }
        if (response.status === 429) {
          return res.status(429).json({ error: 'Rate limit reached. Please wait and try again.' });
        }
        return res.status(response.status).json({
          error: e?.message || `Alibaba returned HTTP ${response.status}`,
          code: e?.code
        });
      }

      const data = await response.json();
      const taskId = data?.output?.task_id;

      if (!taskId) {
        console.error('No task_id in response:', data);
        return res.status(500).json({ error: 'No task ID returned by Alibaba.', raw: data });
      }

      return res.status(200).json({
        taskId,
        status: 'queued',
        model,
        resolution,
        duration: safeDuration,
        estimatedSeconds: model.includes('turbo') ? 90 : 180
      });

    } catch (err) {
      console.error('Submit error:', err.message);
      return res.status(500).json({ error: 'Failed to submit video task.', details: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
