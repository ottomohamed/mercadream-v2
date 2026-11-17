/* md-library.js - MercaDream
 * The user's media library, stored on THIS device (IndexedDB). Nothing is uploaded until a cloud render needs it.
 *   MDLib.list()          -> Promise<[meta]>   meta = { id, kind: 'video'|'image'|'audio', name, size, dur, w, h, thumb, created }
 *   MDLib.add(file)       -> Promise<meta>     (rejects with a readable message)
 *   MDLib.blob(id)        -> Promise<Blob|null>
 *   MDLib.remove(id)      -> Promise
 *   MDLib.setPick(pick) / MDLib.getPick() / MDLib.clearPick()   selection handed to the montage
 */
(function () {
  var DB = 'mercadream-library', VER = 1, db = null;
  var LIMITS = { video: 300, image: 20, audio: 60 };
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise(function (ok, bad) {
      var r = indexedDB.open(DB, VER);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('meta', { keyPath: 'id' }); d.createObjectStore('blob'); };
      r.onsuccess = function () { db = r.result; ok(db); };
      r.onerror = function () { bad(new Error('This browser does not allow a media library here (private mode?).')); };
    });
  }
  function tx(stores, mode, fn) {
    return open().then(function (d) {
      return new Promise(function (ok, bad) {
        var t = d.transaction(stores, mode), out;
        t.oncomplete = function () { ok(out); };
        t.onerror = t.onabort = function () { bad(t.error || new Error('Storage error')); };
        out = fn(t);
      });
    });
  }
  function req(r) { return new Promise(function (ok, bad) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { bad(r.error); }; }); }
  function kindOf(f) {
    var t = f.type || '', n = (f.name || '').toLowerCase();
    if (/^video\//.test(t) || /\.(mp4|mov|webm|m4v)$/.test(n)) return 'video';
    if (/^image\//.test(t) || /\.(jpe?g|png|webp|gif)$/.test(n)) return 'image';
    if (/^audio\//.test(t) || /\.(mp3|wav|m4a|aac|ogg)$/.test(n)) return 'audio';
    return null;
  }
  function shrink(src, w, h, max) {
    var s = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  }
  function probe(file, kind) {
    var url = URL.createObjectURL(file);
    return new Promise(function (ok) {
      var done = function (v) { URL.revokeObjectURL(url); ok(v); };
      if (kind === 'image') {
        var im = new Image();
        im.onload = function () { try { done({ w: im.naturalWidth, h: im.naturalHeight, dur: 0, thumb: shrink(im, im.naturalWidth, im.naturalHeight, 480) }); } catch (e) { done(null); } };
        im.onerror = function () { done(null); }; im.src = url; return;
      }
      var el = document.createElement(kind === 'audio' ? 'audio' : 'video');
      el.preload = 'auto'; el.muted = true; el.src = url;
      var timer = setTimeout(function () { done(isFinite(el.duration) ? { dur: el.duration, w: 0, h: 0, thumb: '' } : null); }, 10000);
      el.onerror = function () { clearTimeout(timer); done(null); };
      el.onloadedmetadata = function () {
        if (kind === 'audio') { clearTimeout(timer); done({ dur: el.duration || 0, w: 0, h: 0, thumb: '' }); return; }
        el.currentTime = Math.min(1, (el.duration || 2) / 3);
      };
      el.onseeked = function () {
        clearTimeout(timer);
        var t = ''; try { t = shrink(el, el.videoWidth || 16, el.videoHeight || 9, 480); } catch (e) {}
        done({ dur: el.duration || 0, w: el.videoWidth, h: el.videoHeight, thumb: t });
      };
    });
  }
  window.MDLib = {
    kindOf: kindOf,
    limits: LIMITS,
    list: function () {
      return tx(['meta'], 'readonly', function (t) { return req(t.objectStore('meta').getAll()); })
        .then(function (rows) { return (rows || []).sort(function (a, b) { return b.created - a.created; }); });
    },
    add: function (file) {
      var kind = kindOf(file);
      if (!kind) return Promise.reject(new Error(file.name + ': not a video, photo or sound'));
      if (file.size > LIMITS[kind] * 1024 * 1024) return Promise.reject(new Error(file.name + ': too big (max ' + LIMITS[kind] + ' MB)'));
      return probe(file, kind).then(function (info) {
        if (!info) throw new Error(file.name + ': this browser cannot open it');
        var meta = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), kind: kind,
          name: (file.name || 'file').replace(/\.[^.]+$/, '').slice(0, 60), size: file.size, type: file.type || '',
          dur: info.dur || 0, w: info.w || 0, h: info.h || 0, thumb: info.thumb || '', created: Date.now() };
        return tx(['meta', 'blob'], 'readwrite', function (t) { t.objectStore('meta').put(meta); t.objectStore('blob').put(file, meta.id); })
          .then(function () { return meta; });
      });
    },
    blob: function (id) { return tx(['blob'], 'readonly', function (t) { return req(t.objectStore('blob').get(id)); }).then(function (b) { return b || null; }); },
    remove: function (id) { return tx(['meta', 'blob'], 'readwrite', function (t) { t.objectStore('meta').delete(id); t.objectStore('blob').delete(id); }); },
    setPick: function (p) { p.at = Date.now(); localStorage.setItem('md_montage_pick', JSON.stringify(p)); },
    getPick: function () { try { var p = JSON.parse(localStorage.getItem('md_montage_pick') || 'null'); return p && Date.now() - p.at < 7 * 864e5 ? p : null; } catch (e) { return null; } },
    clearPick: function () { localStorage.removeItem('md_montage_pick'); }
  };
})();