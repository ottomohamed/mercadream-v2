// ═══════════════════════════════════════════════════════
// MERCADREAM — api/qa-agent.js
// QA Agent: Static Analysis + Runtime Check + Claude Fix
// ═══════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// كل الـ HTML pages المتوقعة
const HTML_PAGES = [
  'animate','api','architecture','assembly','convert','crowd','deaging',
  'directors','ethics','faceswap','grading','index','lab-entities',
  'lab-environment','lab-index','lab-physics','lab','lipsync','login',
  'physics','pricing','profile','register','relighting','semantic',
  'studio','upscale','volumetric'
];

// كل الـ API endpoints المتوقعة
const API_ENDPOINTS = [
  'animate','chat','checkout','convert','credits','deaging','director',
  'faceswap','grading','lipsync','pexels','semantic','upscale','video',
  'wavespeed','webhook'
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.body?.action || req.query?.action || 'full';

  try {
    const report = {
      timestamp: new Date().toISOString(),
      issues: [],
      warnings: [],
      stats: {}
    };

    // ══════════════════════════════════════════
    // 1. فحص وجود الملفات
    // ══════════════════════════════════════════
    const missingHTML = HTML_PAGES.filter(p => 
      !fs.existsSync(path.join(ROOT, p + '.html'))
    );
    const missingAPI = API_ENDPOINTS.filter(e => 
      !fs.existsSync(path.join(ROOT, 'api', e + '.js'))
    );

    if (missingHTML.length) report.issues.push({ type: 'MISSING_FILE', files: missingHTML.map(p => p+'.html') });
    if (missingAPI.length) report.issues.push({ type: 'MISSING_API', files: missingAPI.map(e => 'api/'+e+'.js') });

    report.stats.htmlPages = HTML_PAGES.length - missingHTML.length;
    report.stats.apiEndpoints = API_ENDPOINTS.length - missingAPI.length;

    // ══════════════════════════════════════════
    // 2. Static Analysis على كل HTML
    // ══════════════════════════════════════════
    const htmlFiles = HTML_PAGES
      .filter(p => fs.existsSync(path.join(ROOT, p + '.html')))
      .map(p => ({ name: p+'.html', content: fs.readFileSync(path.join(ROOT, p+'.html'), 'utf8') }));

    let totalButtons = 0;
    let brokenLinks = [];
    let undefinedFunctions = [];
    let missingAPIcalls = [];
    let localStorage_keys = {};

    for (const file of htmlFiles) {
      const content = file.content;

      // عدّ الأزرار
      const buttons = (content.match(/<button/gi) || []).length;
      totalButtons += buttons;

      // فحص onclick بدون دالة
      const onclicks = [...content.matchAll(/onclick="([^"]+)"/g)];
      for (const match of onclicks) {
        const fn = match[1].split('(')[0].trim();
        if (fn && !content.includes('function ' + fn) && 
            !['sendMessage','startGeneration','toggleVoice','switchPhase','setMode',
              'cycleLang','rechargeCredits','handleSceneGenerated','generateScene',
              'downloadFinal','exportToStudio','setGradingPreset','switchTab',
              'location.href','window.open','history.back'].some(k => match[1].includes(k))) {
          undefinedFunctions.push({ file: file.name, fn, onclick: match[1].substring(0,50) });
        }
      }

      // فحص href لصفحات غير موجودة
      const hrefs = [...content.matchAll(/href="([^"#]+\.html)"/g)];
      for (const match of hrefs) {
        const target = match[1].replace(/^\//, '');
        if (!fs.existsSync(path.join(ROOT, target))) {
          brokenLinks.push({ file: file.name, href: match[1] });
        }
      }

      // فحص fetch لـ API endpoints غير موجودة
      const fetches = [...content.matchAll(/fetch\(['"]\/api\/([^'"\/]+)/g)];
      for (const match of fetches) {
        const endpoint = match[1];
        if (!fs.existsSync(path.join(ROOT, 'api', endpoint + '.js'))) {
          missingAPIcalls.push({ file: file.name, endpoint: '/api/'+endpoint });
        }
      }

      // تتبع localStorage keys
      const lsKeys = [...content.matchAll(/localStorage\.\w+\(['"]([^'"]+)['"]/g)];
      for (const match of lsKeys) {
        const key = match[1];
        if (!localStorage_keys[key]) localStorage_keys[key] = [];
        localStorage_keys[key].push(file.name);
      }
    }

    report.stats.totalButtons = totalButtons;
    
    if (undefinedFunctions.length) {
      report.issues.push({ 
        type: 'UNDEFINED_FUNCTIONS', 
        count: undefinedFunctions.length,
        samples: undefinedFunctions.slice(0,10)
      });
    }
    if (brokenLinks.length) {
      report.issues.push({ type: 'BROKEN_LINKS', count: brokenLinks.length, items: brokenLinks });
    }
    if (missingAPIcalls.length) {
      report.warnings.push({ type: 'MISSING_API_CALLS', items: missingAPIcalls });
    }

    // localStorage keys المستخدمة في صفحة واحدة فقط (قد تكون منفصلة)
    const isolatedKeys = Object.entries(localStorage_keys)
      .filter(([k,v]) => v.length === 1 && ['md_','NEURA_'].some(p => k.startsWith(p)));
    if (isolatedKeys.length) {
      report.warnings.push({ 
        type: 'ISOLATED_STORAGE_KEYS', 
        note: 'Keys used in only 1 page — may not sync between pages',
        keys: isolatedKeys.map(([k,v]) => ({ key: k, onlyIn: v[0] }))
      });
    }

    // ══════════════════════════════════════════
    // 3. فحص API files للـ syntax
    // ══════════════════════════════════════════
    const apiFiles = API_ENDPOINTS
      .filter(e => fs.existsSync(path.join(ROOT, 'api', e + '.js')))
      .map(e => ({ name: 'api/'+e+'.js', content: fs.readFileSync(path.join(ROOT, 'api', e+'.js'), 'utf8') }));

    const mixedExports = apiFiles.filter(f => 
      f.content.includes('export default') && f.content.includes('module.exports')
    );
    if (mixedExports.length) {
      report.issues.push({ 
        type: 'MIXED_EXPORTS', 
        note: 'Files mixing export default and module.exports — will fail in Vercel Node',
        files: mixedExports.map(f => f.name)
      });
    }

    const exportDefaultFiles = apiFiles.filter(f => 
      f.content.includes('export default') && !f.content.includes('module.exports')
    );
    if (exportDefaultFiles.length) {
      report.warnings.push({
        type: 'ES_MODULE_EXPORTS',
        note: 'Using export default — may need module.exports for Vercel Node.js',
        files: exportDefaultFiles.map(f => f.name)
      });
    }

    // ══════════════════════════════════════════
    // 4. Claude Analysis (إذا طُلب)
    // ══════════════════════════════════════════
    if (action === 'full' && report.issues.length > 0) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      
      const analysisPrompt = `You are a senior full-stack developer reviewing a large web project called MercaDream (AI video production platform).

Project stats:
- ${report.stats.htmlPages} HTML pages
- ${report.stats.apiEndpoints} API endpoints  
- ${report.stats.totalButtons} total buttons

Issues found by static analysis:
${JSON.stringify(report.issues, null, 2)}

Warnings:
${JSON.stringify(report.warnings, null, 2)}

For each issue, provide:
1. Severity (CRITICAL/HIGH/MEDIUM/LOW)
2. Root cause in 1 sentence
3. Exact fix (code snippet if applicable)

Respond in the same language as the project context (Arabic/English mix is fine).
Be concise — max 3 sentences per issue.`;

      const aiResponse = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: analysisPrompt }]
      });

      report.aiAnalysis = aiResponse.content[0].text;
    }

    // ══════════════════════════════════════════
    // 5. HTML Report
    // ══════════════════════════════════════════
    if (req.query?.format === 'html') {
      const issueColor = report.issues.length > 0 ? '#ff4444' : '#c3f432';
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>MercaDream QA Report</title>
<style>
  body { background:#0a0a0a; color:#e2e4d1; font-family:IBM Plex Mono,monospace; padding:2rem; }
  h1 { color:#c3f432; font-size:1.5rem; }
  h2 { color:#a8d700; font-size:1rem; margin-top:2rem; }
  .stat { display:inline-block; margin:0.5rem; padding:0.5rem 1rem; background:#1a1a1a; border:1px solid #333; }
  .stat span { color:#c3f432; font-size:1.5rem; display:block; }
  .issue { background:#1a0a0a; border-left:3px solid #ff4444; padding:1rem; margin:0.5rem 0; }
  .warn { background:#1a1500; border-left:3px solid #ffba3f; padding:1rem; margin:0.5rem 0; }
  .ok { color:#c3f432; }
  pre { background:#111; padding:1rem; overflow-x:auto; font-size:0.8rem; }
  .ai { background:#0a1a0a; border:1px solid #2a4a2a; padding:1rem; white-space:pre-wrap; }
</style>
</head><body>
<h1>⚡ MERCADREAM QA REPORT</h1>
<p style="color:#666">${report.timestamp}</p>

<div>
  <div class="stat">HTML Pages<span>${report.stats.htmlPages}</span></div>
  <div class="stat">API Endpoints<span>${report.stats.apiEndpoints}</span></div>
  <div class="stat">Total Buttons<span>${report.stats.totalButtons}</span></div>
  <div class="stat" style="border-color:${issueColor}">Issues<span style="color:${issueColor}">${report.issues.length}</span></div>
  <div class="stat" style="border-color:#ffba3f">Warnings<span style="color:#ffba3f">${report.warnings.length}</span></div>
</div>

<h2>❌ ISSUES (${report.issues.length})</h2>
${report.issues.length === 0 ? '<p class="ok">✅ No critical issues found</p>' : 
  report.issues.map(i => `<div class="issue"><strong>${i.type}</strong><pre>${JSON.stringify(i, null, 2)}</pre></div>`).join('')}

<h2>⚠️ WARNINGS (${report.warnings.length})</h2>
${report.warnings.length === 0 ? '<p class="ok">✅ No warnings</p>' :
  report.warnings.map(w => `<div class="warn"><strong>${w.type}</strong><pre>${JSON.stringify(w, null, 2)}</pre></div>`).join('')}

${report.aiAnalysis ? `<h2>🤖 AI ANALYSIS</h2><div class="ai">${report.aiAnalysis}</div>` : ''}

</body></html>`;
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    return res.status(200).json(report);

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
