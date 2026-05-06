# fix-assembly.ps1
# Script لحقن التعديلات في studio.html و assembly.html

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MERCADREAM - FIX ASSEMBLY CONNECTION" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# المسارات
$studioPath = ".\studio.html"
$assemblyPath = ".\assembly.html"

# ============================================
# 1. تعديل studio.html
# ============================================
if (Test-Path $studioPath) {
    Write-Host "[1] تعديل studio.html..." -ForegroundColor Green
    
    $studioContent = Get-Content $studioPath -Raw -Encoding UTF8
    
    # إضافة دالة saveVideoToAssembly بعد showVideoGen
    $saveFunction = @'
function saveVideoToAssembly(videoUrl, prompt) {
    let videos = JSON.parse(localStorage.getItem('md_assembly_videos') || '[]');
    videos.push({
        id: Date.now(),
        url: videoUrl,
        prompt: prompt.substring(0, 200),
        timestamp: new Date().toISOString(),
        duration: 10,
        title: prompt.split(' ').slice(0, 6).join(' ') + '...'
    });
    localStorage.setItem('md_assembly_videos', JSON.stringify(videos));
    log('✓ Video saved to Assembly Room', 'ok');
    const toast = document.createElement('div');
    toast.textContent = '✓ Video saved! Go to Assembly Room to edit.';
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--acid);color:#000;padding:12px 20px;font-family:var(--mono);font-size:10px;z-index:9999;border-radius:4px';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

'@

    # التحقق إذا كانت الدالة موجودة مسبقاً
    if ($studioContent -notmatch 'function saveVideoToAssembly') {
        # إضافة الدالة بعد showVideoGen
        $studioContent = $studioContent -replace '(function showVideoGen\(promptText\)\{.*?\n  \})', "`$1`n`n$saveFunction"
        
        # تعديل دالة pollVideo لإضافة saveVideoToAssembly
        $studioContent = $studioContent -replace '(if\(data\.status === '\''completed'\'' && data\.videoUrl\)\{.*?localStorage\.setItem\('\''md_last_video'\'', data\.videoUrl\);)', "`$1`n`n      saveVideoToAssembly(data.videoUrl, currentPromptText);`n`n      const goToAssemblyBtn = document.createElement('button');`n      goToAssemblyBtn.textContent = '🎬 GO TO ASSEMBLY ROOM →';`n      goToAssemblyBtn.style.cssText = 'display:block;width:100%;margin-top:8px;padding:9px;font-family:var(--mono);font-size:9px;letter-spacing:2px;cursor:pointer;border:none;background:var(--acid);color:#000;font-weight:700;transition:all .2s;text-align:center';`n      goToAssemblyBtn.onclick = () => { window.location.href = 'assembly.html'; };`n      statusEl.parentElement.appendChild(goToAssemblyBtn);"
        
        # حفظ التعديلات
        Set-Content -Path $studioPath -Value $studioContent -Encoding UTF8 -NoNewline
        Write-Host "  ✓ studio.html تم التعديل" -ForegroundColor Green
    } else {
        Write-Host "  ℹ studio.html تم تعديله مسبقاً" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ studio.html غير موجود!" -ForegroundColor Red
}

# ============================================
# 2. تعديل assembly.html
# ============================================
if (Test-Path $assemblyPath) {
    Write-Host "[2] تعديل assembly.html..." -ForegroundColor Green
    
    $assemblyContent = Get-Content $assemblyPath -Raw -Encoding UTF8
    
    # إضافة دالة loadVideosFromStudio بعد loadFromStudio
    $loadFunction = @'
function loadVideosFromStudio() {
    const savedVideos = localStorage.getItem('md_assembly_videos');
    if(savedVideos) {
        const videos = JSON.parse(savedVideos);
        if(videos.length > 0) {
            videos.forEach(video => {
                const clip = createClip(video.prompt);
                clip.videoUrl = video.url;
                clip.id = video.id;
                clip.title = video.title || `Video ${clips.length + 1}`;
                clip.emoji = '🎬';
                clips.push(clip);
            });
            renderTimeline();
            updateStats();
            if(clips.length > 0) selectClip(0);
            toast(`📹 ${videos.length} video(s) loaded from Studio!`, 3000);
        }
    }
}

'@

    # إضافة الدالة في بداية القسم
    if ($assemblyContent -notmatch 'function loadVideosFromStudio') {
        $assemblyContent = $assemblyContent -replace '(function loadFromStudio\(\)\{.*?\n\})', "$loadFunction`n`n`$1"
        Write-Host "  ✓ loadVideosFromStudio() تمت الإضافة" -ForegroundColor Green
    }

    # تعديل دالة renderPreview لدعم الفيديو
    $newRenderPreview = @'
function renderPreview(idx){
    const clip = clips[idx];
    const screen = document.getElementById('previewScreen');
    const def = document.getElementById('psDefault');
    if(def) def.style.display = 'none';
    const old = document.getElementById('clipPreviewActive');
    if(old) old.remove();
    const div = document.createElement('div');
    div.className = 'clip-preview-active';
    div.id = 'clipPreviewActive';
    if(clip.videoUrl) {
        div.innerHTML = `<video style="width:100%;height:100%;object-fit:contain" id="previewVideo" src="${clip.videoUrl}" controls autoplay muted onended="onPreviewVideoEnded()"></video><div class="cpa-dur" style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.7);padding:4px 8px;border-radius:4px">⏱ ${clip.duration}s &nbsp;|&nbsp; ${formatTransition(clip.transition)}</div>`;
    } else {
        div.innerHTML = `<div class="cpa-num">CLIP ${String(clip.num).padStart(2,'0')} / ${String(clips.length).padStart(2,'0')}</div><div class="cpa-title">${clip.title}</div><div class="cpa-desc">${clip.prompt || '—'}</div><div class="cpa-dur">⏱ ${clip.duration}s &nbsp;|&nbsp; ${formatTransition(clip.transition)}</div>`;
    }
    screen.appendChild(div);
    playProgress = 0;
    updatePlaybar();
    document.getElementById('hudStatus').textContent = 'PREVIEW';
    document.getElementById('hudTC').textContent = `00:00:${String(clip.num).padStart(2,'0')}`;
    updateTransportInfo();
}

'@

    # استبدال دالة renderPreview القديمة
    $assemblyContent = $assemblyContent -replace '(function renderPreview\(idx\)\{.*?\n\})', $newRenderPreview -replace '(?ms)function renderPreview\(idx\)\{.*?\n\}', $newRenderPreview
    Write-Host "  ✓ renderPreview() تم التعديل" -ForegroundColor Green

    # إضافة دالة onPreviewVideoEnded
    $onEndedFunction = @'
function onPreviewVideoEnded() {
    if(activeClipIdx < clips.length - 1) {
        selectClip(activeClipIdx + 1);
    }
}

'@
    if ($assemblyContent -notmatch 'function onPreviewVideoEnded') {
        $assemblyContent = $assemblyContent -replace '(function updateTransportInfo\(\)\{.*?\n\})', "$onEndedFunction`n`n`$1"
        Write-Host "  ✓ onPreviewVideoEnded() تمت الإضافة" -ForegroundColor Green
    }

    # تعديل دالة togglePlay لدعم الفيديو
    $newTogglePlay = @'
function togglePlay(){
    const btn = document.getElementById('playBtn');
    const video = document.getElementById('previewVideo');
    if(video) {
        if(video.paused) {
            video.play();
            btn.textContent = '⏸';
            btn.classList.add('playing');
        } else {
            video.pause();
            btn.textContent = '▶';
            btn.classList.remove('playing');
        }
        return;
    }
    if(playInterval){
        clearInterval(playInterval);
        playInterval = null;
        btn.textContent = '▶';
        btn.classList.remove('playing');
    } else {
        if(activeClipIdx < 0 || clips.length === 0) return;
        btn.textContent = '⏸';
        btn.classList.add('playing');
        const clip = clips[activeClipIdx];
        const steps = clip.duration * 10;
        let step = 0;
        playInterval = setInterval(()=>{
            step++;
            playProgress = (step / steps) * 100;
            updatePlaybar();
            if(step >= steps){
                clearInterval(playInterval);
                playInterval = null;
                btn.textContent = '▶';
                btn.classList.remove('playing');
                playProgress = 0;
                updatePlaybar();
                if(activeClipIdx < clips.length - 1) selectClip(activeClipIdx + 1);
            }
        }, 100);
    }
}

'@
    $assemblyContent = $assemblyContent -replace '(function togglePlay\(\)\{.*?\n\})', $newTogglePlay -replace '(?ms)function togglePlay\(\)\{.*?\n\}', $newTogglePlay
    Write-Host "  ✓ togglePlay() تم التعديل" -ForegroundColor Green

    # إضافة استدعاء loadVideosFromStudio في window.onload
    if ($assemblyContent -match 'window\.onload = \(\) => \{') {
        $assemblyContent = $assemblyContent -replace '(window\.onload = \(\) => \{[^}]*)loadFromStudio\(\);', "`$1loadFromStudio();`n    loadVideosFromStudio();"
        Write-Host "  ✓ window.onload تم التعديل" -ForegroundColor Green
    }

    # حفظ التعديلات
    Set-Content -Path $assemblyPath -Value $assemblyContent -Encoding UTF8 -NoNewline
    Write-Host "  ✓ assembly.html تم التعديل" -ForegroundColor Green
} else {
    Write-Host "  ✗ assembly.html غير موجود!" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ التعديلات اكتملت!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔴 مهم: قم بتحديث الصفحات (Ctrl+F5) في المتصفح"
Write-Host "🎬 الآن: توليد فيديو في الاستوديو ثم اذهب إلى غرفة المونتاج"
Write-Host ""