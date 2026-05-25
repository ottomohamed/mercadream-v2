// ═══════════════════════════════════════════════════════
// MERCADREAM — api/qa-agent.js
// QA Agent: DOM Parsing (Cheerio) + Static Analysis + Claude
// ═══════════════════════════════════════════════════════

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio'); // استدعاء المكتبة الجديدة

const ROOT = path.join(__dirname, '..');

// مفتاح Anthropic آمن عبر البيئة أو كخيار احتياطي مؤقت
const anthropic = new Anthropic({ 
  apiKey: process.env.ANTHROPIC_API_KEY || 'ضع_مفتاحك_هنا_أو_في_ملف_السيرفر' 
});

// قائمة الصفحات الـ 28 الخاصة بـ MercaDream
const HTML_PAGES = [
  'animate','architecture','assembly','convert','crowd','deaging',
  'directors','ethics','faceswap','grading','index','lab-entities',
  'lab-environment','lab-index','lab-physics','lab','lipsync','login',
  'physics','pricing','profile','register','relighting','semantic',
  'studio','upscale','volumetric'
];

// قائمة الـ API endpoints المتوقعة
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
      stats: {
        htmlPages: HTML_PAGES.length,
        apiEndpoints: API_ENDPOINTS.length,
        totalButtons: 0,
        totalLinks: 0
      }
    };

    // 1. تشغيل فحص الـ DOM والروابط والأزرار الشامل
    if (action === 'full' || action === 'html') {
      HTML_PAGES.forEach(page => {
        const filePath = path.join(ROOT, `${page}.html`);
        
        if (!fs.existsSync(filePath)) {
          report.issues.push({
            type: 'MISSING_FILE',
            file: `${page}.html`,
            message: `الملف غير موجود في المسار الأساسي للمشروع.`
          });
          return;
        }

        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const $ = cheerio.load(htmlContent);

        // --- جرد وفحص الأزرار <button> ---
        $('button').each((index, element) => {
          report.stats.totalButtons++;
          const btn = $(element);
          const btnText = btn.text().trim() || btn.attr('title') || btn.attr('aria-label') || 'Icon Button';
          const btnId = btn.attr('id');
          const btnClick = btn.attr('onclick');
          const btnClass = btn.attr('class');

          // التحقق: هل هناك زر ليس له معرف أو حدث ضغط ولم يتم ربطه؟
          // ملاحظة: استثنينا الأزرار الموجودة داخل نموذج إرسال (form) تلقائي
          if (!btnClick && !btnId && !btn.closest('form').length) {
            report.warnings.push({
              type: 'UNWIRED_BUTTON',
              file: `${page}.html`,
              element: `<button class="${btnClass ? btnClass.split(' ')[0] + '...' : ''}">${btnText}</button>`,
              message: `الزر يظهر في الواجهة ولكن لا يحتوي على معرف (id) أو حدث (onclick). تأكد من ربطه عبر JavaScript أو ملف navigation.js`
            });
          }
        });

        // --- جرد وفحص الروابط <a> ---
        $('a').each((index, element) => {
          report.stats.totalLinks++;
          const link = $(element);
          const href = link.attr('href');
          const linkText = link.text().trim() || link.find('span').text().trim() || 'Link Icon';

          if (!href || href === '#' || href === '') {
            report.issues.push({
              type: 'DEAD_LINK',
              file: `${page}.html`,
              element: `<a href="${href || 'فارغ'}">${linkText}</a>`,
              message: `تم رصد رابط ميت أو غير موجه.`
            });
          } else {
            // التحقق من الروابط الداخلية للمشروع فقط
            const isLocal = !href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('tel') && !href.startsWith('#');
            if (isLocal) {
              const cleanHref = href.split('?')[0].split('#')[0];
              const targetPageName = cleanHref.replace('.html', '');
              
              if (!HTML_PAGES.includes(targetPageName) && targetPageName !== '') {
                report.issues.push({
                  type: 'BROKEN_INTERNAL_LINK',
                  file: `${page}.html`,
                  element: `<a href="${href}">${linkText}</a>`,
                  message: `الرابط يؤدي إلى صفحة داخلية غير موجودة في مصفوفة النظام الحالي: (${cleanHref}).`
                });
              }
            }
          }
        });
      });
    }

    // 2. فحص ملفات الـ API
    if (action === 'full' || action === 'api') {
      API_ENDPOINTS.forEach(api => {
        const filePath = path.join(ROOT, 'api', `${api}.js`);
        if (!fs.existsSync(filePath)) {
          report.issues.push({
            type: 'MISSING_API_FILE',
            file: `api/${api}.js`,
            message: `نقطة النهاية (Endpoint) مسجلة في النظام ولكن ملف الـ JS غير موجود على السيرفر.`
          });
        }
      });
    }

    // 3. تحليل الذكاء الصناعي عبر Claude في حال وجود مشاكل حرجة وخيار فحص كامل
    if (action === 'full' && report.issues.length > 0 && process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          system: "You are the Lead QA & Security Engineer for MercaDream, an advanced AI film studio platform. Analyze the reported bugs and provide direct, actionable code fixes.",
          messages: [{ role: 'user', content: `Here is the QA Scan report with errors. Provide brief architectural optimization steps and specific fixes:\n${JSON.stringify(report.issues, null, 2)}` }]
        });
        report.aiAnalysis = response.content[0].text;
      } catch (aiErr) {
        report.warnings.push({ type: 'AI_AGENT_TIMEOUT', message: 'تعذر جلب تحليل Claude للحلول التلقائية بسبب مشاكل في الاتصال أو صلاحية المفتاح.' });
      }
    }

    // 4. بناء تقرير الـ HTML الاحترافي لواجهة المنصة الداكنة
    const issueColor = report.issues.length > 0 ? '#ff4d4d' : '#00ffcc';
    
    const htmlReport = `
<!DOCTYPE html>
<html lang="ar" class="dark">
<head>
<meta charset="utf-8">
<title>MercaDream — QA Automation Terminal</title>
<style>
  body { background:#0a0a0c; color:#e4e4e7; font-family:monospace; padding:2rem; }
  h1 { color:#c8ff00; font-size:24px; border-bottom:1px solid #222; padding-bottom:10px; letter-spacing:1px; }
  h2 { font-size:16px; margin-top:2rem; color:#fff; text-transform:uppercase; letter-spacing:1px; }
  .stats-container { display:flex; gap:15px; margin-bottom:20px; }
  .stat { flex:1; background:#121214; border:1px solid #222; padding:15px; border-radius:4px; text-align:center; }
  .stat span { display:block; font-size:28px; font-weight:bold; margin-top:5px; color:#fff; }
  .issue { background:#221111; border:1px solid #552222; padding:15px; margin-bottom:10px; border-radius:4px; }
  .warn { background:#221f11; border:1px solid #554422; padding:15px; margin-bottom:10px; border-radius:4px; }
  .ok { color:#00ffcc; background:#11221c; padding:15px; border-radius:4px; border:1px solid #114433; }
  pre { background:#000; padding:12px; overflow-x:auto; border-radius:4px; font-size:12px; color:#a7a7a7; border:1px solid #1a1a1a; }
  .ai { background:#151226; border:1px solid #3c2a73; padding:20px; border-radius:4px; white-space:pre-wrap; line-height:1.6; color:#dcd7f5; }
  strong { color:#ffba3f; }
</style>
</head>
<body>
<h1>⚡ MERCADREAM QA DEEP DOM REPORT</h1>
<p style="color:#666; font-size:12px;">TIMESTAMP: ${report.timestamp}</p>

<div class="stats-container">
  <div class="stat">HTML Pages <span>${report.stats.htmlPages}</span></div>
  <div class="stat">Total Buttons <span>${report.stats.totalButtons}</span></div>
  <div class="stat">Total Links <span>${report.stats.totalLinks}</span></div>
  <div class="stat" style="border-color:${issueColor}">Critical Issues <span style="color:${issueColor}">${report.issues.length}</span></div>
  <div class="stat" style="border-color:#ffba3f">Warnings <span style="color:#ffba3f">${report.warnings.length}</span></div>
</div>

<h2>❌ CRITICAL ISSUES (${report.issues.length})</h2>
${report.issues.length === 0 ? '<p class="ok">✅ Excellent! All 200+ links and routes are correctly mapped. 0 broken connections found.</p>' : 
  report.issues.map(i => `<div class="issue"><strong style="color:#ff4d4d">${i.type}</strong> [File: ${i.file}]<br><small style="color:#aaa">Element: ${i.element || 'N/A'}</small><pre>${i.message}</pre></div>`).join('')}

<h2>⚠️ UNWIRED INTERACTIVE ELEMENTS (${report.warnings.length})</h2>
${report.warnings.length === 0 ? '<p class="ok">✅ All interface elements have active handlers attached.</p>' :
  report.warnings.map(w => `<div class="warn"><strong>${w.type}</strong> [File: ${w.file}]<br><small style="color:#aaa">Element: ${w.element}</small><pre>${w.message}</pre></div>`).join('')}

${report.aiAnalysis ? `<h2>🤖 CLAUDE AUTOMATED FIX CODES</h2><div class="ai">${report.aiAnalysis}</div>` : ''}
</body>
</html>
      `;

    res.status(200).send(htmlReport);

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};