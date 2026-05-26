// ═══════════════════════════════════════════════════════
// MERCADREAM — Neural Pipeline
// SEND TO feature for all service pages
// ═══════════════════════════════════════════════════════

window.MD_PIPELINE = {

  // Save output file for next service
  save: function(file, fromService) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      localStorage.setItem('md_pipe_file_name', file.name);
      localStorage.setItem('md_pipe_file_type', file.type);
      localStorage.setItem('md_pipe_from', fromService || '');
      localStorage.setItem('md_pipe_data', e.target.result);
    };
    reader.readAsDataURL(file);
  },

  // Load piped file
  load: function() {
    var data = localStorage.getItem('md_pipe_data');
    var name = localStorage.getItem('md_pipe_file_name');
    var type = localStorage.getItem('md_pipe_file_type');
    if (!data) return null;
    return { data: data, name: name, type: type };
  },

  // Clear pipeline
  clear: function() {
    localStorage.removeItem('md_pipe_data');
    localStorage.removeItem('md_pipe_file_name');
    localStorage.removeItem('md_pipe_file_type');
    localStorage.removeItem('md_pipe_from');
  },

  // Show SEND TO panel after completion
  showSendTo: function(currentService) {
    var existing = document.getElementById('md-send-to');
    if (existing) existing.remove();

    var services = [
      { id: 'faceswap',  label: 'FACE SWAP',   icon: 'face' },
      { id: 'lipsync',   label: 'LIP SYNC',    icon: 'record_voice_over' },
      { id: 'deaging',   label: 'DE-AGING',    icon: 'face_retouching_natural' },
      { id: 'grading',   label: 'COLOR GRADE', icon: 'palette' },
      { id: 'convert',   label: 'CONVERT',     icon: 'transform' },
      { id: 'assembly',  label: 'ASSEMBLY',    icon: 'movie_edit' }
    ].filter(function(s) { return s.id !== currentService; });

    var panel = document.createElement('div');
    panel.id = 'md-send-to';
    panel.style.cssText = 'position:fixed;bottom:90px;right:20px;z-index:9999;background:#0d0d0d;border:1px solid rgba(200,255,0,0.4);padding:16px;min-width:220px;box-shadow:0 0 30px rgba(200,255,0,0.1)';

    var title = '<div style="font-family:IBM Plex Mono,monospace;font-size:9px;color:#a1a1a1;letter-spacing:2px;margin-bottom:10px">SEND OUTPUT TO:</div>';

    var btns = services.map(function(s) {
      return '<button onclick="window.MD_PIPELINE.sendTo(\''+s.id+'\')" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;margin-bottom:4px;background:transparent;border:1px solid #434933;color:#e5e2e1;font-family:IBM Plex Mono,monospace;font-size:10px;cursor:pointer;transition:all .2s" onmouseover="this.style.borderColor=\'#c8ff00\';this.style.color=\'#c8ff00\'" onmouseout="this.style.borderColor=\'#434933\';this.style.color=\'#e5e2e1\'"><span class="material-symbols-outlined" style="font-size:14px">'+s.icon+'</span>'+s.label+'</button>';
    }).join('');

    var close = '<button onclick="document.getElementById(\'md-send-to\').remove()" style="position:absolute;top:8px;right:10px;background:transparent;border:none;color:#666;cursor:pointer;font-size:16px">✕</button>';

    panel.innerHTML = close + title + btns;
    document.body.appendChild(panel);
  },

  sendTo: function(targetService) {
    document.getElementById('md-send-to') && document.getElementById('md-send-to').remove();
    window.location.href = targetService + '.html';
  },

  // Auto-load piped file into upload zone
  autoLoad: function(uploadZoneSelector) {
    var piped = this.load();
    if (!piped) return;

    var zone = document.querySelector(uploadZoneSelector);
    if (!zone) return;

    var from = localStorage.getItem('md_pipe_from') || 'previous service';

    zone.innerHTML = '<div style="padding:20px;text-align:center">' +
      '<div style="color:#c8ff00;font-family:IBM Plex Mono,monospace;font-size:10px;margin-bottom:6px">⚡ PIPELINE INPUT</div>' +
      '<div style="color:#e5e2e1;font-family:IBM Plex Mono,monospace;font-size:11px;margin-bottom:4px">' + piped.name + '</div>' +
      '<div style="color:#a1a1a1;font-family:IBM Plex Mono,monospace;font-size:9px">FROM: ' + from.toUpperCase() + '</div>' +
    '</div>';
    zone.style.borderColor = '#c8ff00';

    // Return as usable reference
    return piped;
  }
};
