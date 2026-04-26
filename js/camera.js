// js/camera.js — v8.1
// v8.1: Html5Qrcode uyumluluk düzeltmesi
//   start() ilk parametresi ya string (cameraId) ya da TEK key'li object olmalı.
//   _cameraParam: kameraId varsa string, yoksa { facingMode: { ideal: "environment" } }
//   Çözünürlük (1280x720) → start() sonrası applyConstraints ile best-effort
// v8: iPhone ISBN okuma stabilitesi iyileştirmeleri (fps, qrbox, autofocus)
// v7: aspectRatio kaldırıldı
// v6: _isProcessing lock, onRestartNormal callback
// v5: restartNormal() + isAdaptifAktif()
// v4: EAN-13 checksum, adaptif 3s, cooldown 600ms

window.KutuphaneCamera = (function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let activeReader          = null;
  let activeReaderElementId = null;
  let lastScannedCode       = '';
  let isStarting            = false;
  let adaptifTimer          = null;
  let _adaptifAktif         = false;
  let _isProcessing         = false;
  let _lastStartOpts        = null;

  // ── temizKod ──────────────────────────────────────────────────────────────
  function temizKod(text) {
    const s = String(text || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
    if (s.length !== 8 && s.length !== 13) return '';
    return s;
  }

  function _ean13Gecerli(kod) {
    if (!/^\d{13}$/.test(kod)) return false;
    const d   = kod.split('').map(Number);
    const sum = d.slice(0, 12).reduce((acc, v, i) => acc + v * (i % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === d[12];
  }

  function _barkodGecerli(kod) {
    if (!kod) return false;
    if (kod.length === 13) return _ean13Gecerli(kod);
    if (kod.length === 8)  return true;
    return false;
  }

  // ── Kamera seçici ─────────────────────────────────────────────────────────
  async function enUygunArkaKameraIdBul() {
    try {
      if (typeof Html5Qrcode === 'undefined' || !Html5Qrcode.getCameras) return null;
      const devices = await Html5Qrcode.getCameras();
      if (!devices || !devices.length) return null;
      const arkaKameralar = devices.filter(d => {
        const lbl = String(d.label || '').toLowerCase();
        return lbl.includes('back') || lbl.includes('rear') ||
               lbl.includes('environment') || lbl.includes('arka');
      });
      const hedefListe = arkaKameralar.length ? arkaKameralar : devices;
      const puanli = hedefListe.map(cam => {
        const lbl = String(cam.label || '').toLowerCase();
        let puan = 0;
        if (lbl.includes('main'))        puan += 14;
        if (lbl.includes('1x'))          puan += 12;
        if (lbl.includes('back'))        puan += 6;
        if (lbl.includes('rear'))        puan += 6;
        if (lbl.includes('environment')) puan += 6;
        if (lbl.includes('wide'))        puan -= 12;
        if (lbl.includes('ultra'))       puan -= 16;
        if (lbl.includes('0.5'))         puan -= 16;
        if (lbl.includes('telephoto'))   puan -= 4;
        if (lbl.includes('front'))       puan -= 20;
        return { id: cam.id, label: cam.label || '', puan };
      });
      puanli.sort((a, b) => b.puan - a.puan);
      return puanli[0]?.id || null;
    } catch (_) { return null; }
  }

  // ── Html5Qrcode start() ilk parametresi ──────────────────────────────────
  // Html5Qrcode kuralı: ya string (cameraId) ya da TEK key'li object.
  // Çoklu key object → "found N keys" hatası.
  // Çözünürlük bu parametreye verilemiyor — applyConstraints ile sonradan ayarlanır.
  function _cameraParam(kameraId) {
    if (kameraId) return kameraId; // string — library direkt deviceId olarak kullanır
    return { facingMode: { ideal: 'environment' } }; // tek key, iOS dahil çalışır
  }

  // ── Autofocus + çözünürlük (start() sonrası best-effort) ─────────────────
  // start() tamamlandıktan sonra video track üzerinden:
  //   1. focusMode=continuous — destekleniyorsa ayarla (Android Chrome)
  //   2. width/height ideal 1280x720 — cihaz destekliyorsa uygula
  // iOS Safari'de getCapabilities() yok → try/catch ile korunur, sessizce geçilir.
  function _autofocusUygula(readerId) {
    setTimeout(() => {
      try {
        const videoEl = document.querySelector('#' + readerId + ' video');
        const stream  = videoEl?.srcObject;
        const track   = stream?.getVideoTracks?.()?.[0];
        if (!track) return;

        const caps        = track.getCapabilities?.() || {};
        const constraints = {};

        // Continuous autofocus
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          constraints.advanced = [{ focusMode: 'continuous' }];
        }

        // Çözünürlük — cihaz 1280 genişliği destekliyorsa iste
        if (caps.width?.max >= 1280) {
          constraints.width  = { ideal: 1280 };
          constraints.height = { ideal: 720 };
        }

        if (Object.keys(constraints).length > 0) {
          track.applyConstraints(constraints).catch(() => {});
        }
      } catch (_) {}
    }, 600); // stream'in stabilize olmasını bekle
  }

  // ── Config ─────────────────────────────────────────────────────────────────
  function _ortakAyarlar() {
    const base = {
      // aspectRatio YOK (v7): native oran, zoom/crop olmaz
      disableFlip: false,
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    };
    if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
      base.formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE
      ];
    }
    return base;
  }

  function varsayilanConfig() {
    return {
      ..._ortakAyarlar(),
      fps: 18, // v8: 12→18
      qrbox: (w, h) => {
        // ISBN barkodları yatay — geniş ve yeterince yüksek alan
        const bw = Math.min(Math.round(w * 0.92), 420);
        const bh = Math.min(Math.round(bw * 0.44), Math.round(h * 0.72));
        return { width: bw, height: bh };
      }
    };
  }

  function kucukBarkodConfig() {
    return {
      ..._ortakAyarlar(),
      fps: 20, // v8: 15→20
      qrbox: (w, _h) => {
        const bw = Math.min(Math.round(w * 0.62), 240);
        return { width: bw, height: Math.round(bw * 0.43) };
      }
    };
  }

  // ── İç stop — lastScannedCode'a dokunmaz ──────────────────────────────────
  async function _stopInner() {
    if (activeReader) {
      try { await activeReader.stop(); }  catch (_) {}
      try { await activeReader.clear(); } catch (_) {}
    }
    activeReader          = null;
    activeReaderElementId = null;
  }

  // ── Dışa açık stop ────────────────────────────────────────────────────────
  async function stop() {
    clearTimeout(adaptifTimer);
    adaptifTimer    = null;
    _adaptifAktif   = false;
    _isProcessing   = false;
    _lastStartOpts  = null;
    await _stopInner();
    lastScannedCode = '';
    isStarting      = false;
  }

  // ── Adaptif timer ─────────────────────────────────────────────────────────
  function _armAdaptifTimer(readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif) {
    if (!adaptifMod) return;
    adaptifTimer = setTimeout(async () => {
      if (activeReaderElementId !== readerId) return;
      const savedCode = lastScannedCode;
      try {
        await _stopInner();
        lastScannedCode = savedCode;
        _adaptifAktif   = true;
        await _scanBaslat(readerId, wrapId, kucukBarkodConfig(), onDetected, onError, 600);
        if (typeof onAdaptif === 'function') onAdaptif();
      } catch (_) {}
    }, 3000);
  }

  // ── Ortak scan başlatıcı ──────────────────────────────────────────────────
  async function _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError, ignoreScanMs) {
    const readerEl = document.getElementById(readerId);
    const wrapEl   = wrapId ? document.getElementById(wrapId) : null;
    if (!readerEl) throw new Error('Reader alanı bulunamadı: ' + readerId);

    if (wrapEl) wrapEl.style.display = 'block';
    readerEl.innerHTML = '';

    activeReader          = new Html5Qrcode(readerId);
    activeReaderElementId = readerId;

    const kameraId   = await enUygunArkaKameraIdBul();
    const cameraParam = _cameraParam(kameraId); // string veya tek-key object

    let ignoreUntil = 0;

    await activeReader.start(
      cameraParam,
      scanConfig,
      async decodedText => {
        if (ignoreUntil > 0 && Date.now() < ignoreUntil) return;

        const temiz = temizKod(decodedText);
        if (!temiz || !_barkodGecerli(temiz)) return;
        if (temiz === lastScannedCode) return;
        if (_isProcessing) return;

        _isProcessing   = true;
        clearTimeout(adaptifTimer);
        adaptifTimer    = null;
        lastScannedCode = temiz;

        try {
          await onDetected(temiz);

          if (_adaptifAktif) {
            _adaptifAktif = false;
            if (typeof _lastStartOpts?.onRestartNormal === 'function') {
              _lastStartOpts.onRestartNormal();
            }
            await _restartNormalInternal();
          }
        } finally {
          _isProcessing = false;
        }
      },
      errMsg => {
        if (typeof onError === 'function') onError(errMsg);
      }
    );

    if (ignoreScanMs > 0) ignoreUntil = Date.now() + ignoreScanMs;

    // v8: continuous autofocus — destekleniyorsa ayarla
    _autofocusUygula(readerId);
  }

  // ── Dahili: normal moda dön (adaptif sonrası) ─────────────────────────────
  async function _restartNormalInternal() {
    if (!_lastStartOpts) return;
    const { readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif, config } = _lastStartOpts;
    const savedCode = lastScannedCode;
    clearTimeout(adaptifTimer);
    adaptifTimer = null;
    try {
      await _stopInner();
      lastScannedCode = savedCode;
      const scanConfig = { ...varsayilanConfig(), ...(config || {}) };
      await _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError, 400);
      _armAdaptifTimer(readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif);
    } catch (_) {}
  }

  // ── start ─────────────────────────────────────────────────────────────────
  async function start(options) {
    const {
      readerId,
      wrapId,
      onDetected,
      onError,
      onAdaptif,
      onRestartNormal,
      adaptifMod,
      config
    } = options || {};

    if (!readerId || typeof onDetected !== 'function') {
      throw new Error('camera.js: readerId ve onDetected zorunlu');
    }
    if (typeof Html5Qrcode === 'undefined') {
      throw new Error('Html5Qrcode yüklenemedi');
    }
    if (isStarting) return;
    isStarting = true;

    clearTimeout(adaptifTimer);
    adaptifTimer   = null;
    _adaptifAktif  = false;
    _isProcessing  = false;
    _lastStartOpts = { readerId, wrapId, onDetected, onError, onAdaptif, onRestartNormal, adaptifMod, config };

    try {
      await _stopInner();
      lastScannedCode = '';
      const scanConfig = { ...varsayilanConfig(), ...(config || {}) };
      await _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError, 0);
      _armAdaptifTimer(readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif);
    } finally {
      isStarting = false;
    }
  }

  // ── Dışa açık restartNormal ───────────────────────────────────────────────
  async function restartNormal() {
    await _restartNormalInternal();
  }

  function isAdaptifAktif()     { return _adaptifAktif; }
  function isActive()           { return !!activeReader; }
  function getReaderElementId() { return activeReaderElementId; }

  // ── Sayfa yaşam döngüsü ───────────────────────────────────────────────────
  document.addEventListener('visibilitychange', async () => { if (document.hidden) await stop(); });
  window.addEventListener('pagehide',     async () => { await stop(); });
  window.addEventListener('beforeunload', async () => { await stop(); });

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    start,
    stop,
    restartNormal,
    isAdaptifAktif,
    isActive,
    getReaderElementId,
    temizKod,
    varsayilanConfig,
    kucukBarkodConfig
  };

})();
