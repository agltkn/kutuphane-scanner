// js/camera.js — v2
// Html5Qrcode üzerinde EAN-13 odaklı, adaptif barkod okuyucu
// Değişiklikler: tek tanım, fps 12/15, fonksiyon-tabanlı qrbox, adaptifMod

window.KutuphaneCamera = (function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let activeReader          = null;
  let activeReaderElementId = null;
  let lastScannedCode       = '';
  let isStarting            = false;
  let adaptifTimer          = null;

  // ── Yardımcı ──────────────────────────────────────────────────────────────
  function temizKod(text) {
    return String(text || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
  }

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
    } catch (_) {
      return null;
    }
  }

  // ── Ortak ayarlar ──────────────────────────────────────────────────────────
  function _ortakAyarlar() {
    const base = {
      aspectRatio: 1.7778,
      disableFlip: false,
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    };

    if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
      base.formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,   // kitap ISBN barkodları
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

  // ── Normal config — büyük/orta barkodlar ──────────────────────────────────
  // qrbox: container genişliğinin %82'si, yükseklik genişliğin %40'ı
  // fps 12 → 8'den daha hızlı çerçeve analizi
  function varsayilanConfig() {
    return {
      ..._ortakAyarlar(),
      fps: 12,
      qrbox: (w, _h) => {
        const bw = Math.min(Math.round(w * 0.82), 340);
        return { width: bw, height: Math.round(bw * 0.40) };
      }
    };
  }

  // ── Küçük barkod config ────────────────────────────────────────────────────
  // Daha dar odak kutusu: barkod kutuyu doldurmak zorunda kalır → daha iyi decode
  // fps 15, kutu %58 genişlik
  function kucukBarkodConfig() {
    return {
      ..._ortakAyarlar(),
      fps: 15,
      qrbox: (w, _h) => {
        const bw = Math.min(Math.round(w * 0.58), 215);
        return { width: bw, height: Math.round(bw * 0.43) };
      }
    };
  }

  // ── İç stop — adaptifTimer/isStarting dokunmaz ────────────────────────────
  async function _stopInner() {
    if (activeReader) {
      try { await activeReader.stop(); }  catch (_) {}
      try { await activeReader.clear(); } catch (_) {}
    }
    activeReader          = null;
    activeReaderElementId = null;
    lastScannedCode       = '';
  }

  // ── Dışa açık stop ─────────────────────────────────────────────────────────
  async function stop() {
    clearTimeout(adaptifTimer);
    adaptifTimer = null;
    await _stopInner();
    isStarting = false;
  }

  // ── Ortak scan başlatıcı ──────────────────────────────────────────────────
  async function _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError) {
    const readerEl = document.getElementById(readerId);
    const wrapEl   = wrapId ? document.getElementById(wrapId) : null;
    if (!readerEl) throw new Error('Reader alanı bulunamadı: ' + readerId);

    if (wrapEl) wrapEl.style.display = 'block';
    readerEl.innerHTML = '';

    activeReader          = new Html5Qrcode(readerId);
    activeReaderElementId = readerId;
    lastScannedCode       = '';

    const kameraId     = await enUygunArkaKameraIdBul();
    const cameraConfig = kameraId || { facingMode: 'environment' };

    await activeReader.start(
      cameraConfig,
      scanConfig,
      async decodedText => {
        const temiz = temizKod(decodedText);
        if (!temiz || temiz === lastScannedCode) return;
        // Başarılı okuma — adaptif zamanlayıcıyı iptal et
        clearTimeout(adaptifTimer);
        adaptifTimer    = null;
        lastScannedCode = temiz;
        await onDetected(temiz);
      },
      errMsg => {
        if (typeof onError === 'function') onError(errMsg);
      }
    );
  }

  // ── start ─────────────────────────────────────────────────────────────────
  async function start(options) {
    const {
      readerId,
      wrapId,
      onDetected,
      onError,
      onAdaptif,   // () => void  — küçük barkod moduna geçilince çağrılır
      adaptifMod,  // true        — 5s içinde okuma olmazsa otomatik geç
      config       // varsayilanConfig'i override eder
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
    adaptifTimer = null;

    try {
      await _stopInner();

      const scanConfig = { ...varsayilanConfig(), ...(config || {}) };
      await _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError);

      // Adaptif mod: 5s içinde başarılı okuma olmadıysa küçük barkod config'e geç
      if (adaptifMod) {
        adaptifTimer = setTimeout(async () => {
          if (activeReaderElementId !== readerId) return; // başka oturum açılmış
          try {
            await _stopInner();
            await _scanBaslat(readerId, wrapId, kucukBarkodConfig(), onDetected, onError);
            if (typeof onAdaptif === 'function') onAdaptif();
          } catch (_) {
            // geçiş başarısız — sessizce devam
          }
        }, 5000);
      }

    } finally {
      isStarting = false;
    }
  }

  // ── Durum ─────────────────────────────────────────────────────────────────
  function isActive()           { return !!activeReader; }
  function getReaderElementId() { return activeReaderElementId; }

  // ── Sayfa yaşam döngüsü ───────────────────────────────────────────────────
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) await stop();
  });
  window.addEventListener('pagehide',     async () => { await stop(); });
  window.addEventListener('beforeunload', async () => { await stop(); });

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    start,
    stop,
    isActive,
    getReaderElementId,
    temizKod,
    varsayilanConfig,
    kucukBarkodConfig  // yeni — ekle.js/hizli_ekle.js erişebilir
  };

})();
