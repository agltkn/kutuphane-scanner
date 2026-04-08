window.KutuphaneCamera = (function () {
  let activeReader = null;
  let activeReaderElementId = null;
  let lastScannedCode = '';
  let isStarting = false;

  function temizKod(text) {
    return String(text || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
  }

  async function enUygunArkaKameraIdBul() {
    try {
      if (typeof Html5Qrcode === 'undefined' || !Html5Qrcode.getCameras) {
        return null;
      }

      const devices = await Html5Qrcode.getCameras();
      if (!devices || !devices.length) return null;

      const arkaKameralar = devices.filter(d => {
        const label = String(d.label || '').toLowerCase();
        return (
          label.includes('back') ||
          label.includes('rear') ||
          label.includes('environment') ||
          label.includes('arka')
        );
      });

      const hedefListe = arkaKameralar.length ? arkaKameralar : devices;

      const puanli = hedefListe.map(cam => {
        const label = String(cam.label || '').toLowerCase();
        let puan = 0;

        if (label.includes('main')) puan += 14;
        if (label.includes('1x')) puan += 12;
        if (label.includes('back')) puan += 6;
        if (label.includes('rear')) puan += 6;
        if (label.includes('environment')) puan += 6;

        if (label.includes('wide')) puan -= 12;
        if (label.includes('ultra')) puan -= 16;
        if (label.includes('0.5')) puan -= 16;
        if (label.includes('telephoto')) puan -= 4;
        if (label.includes('front')) puan -= 20;

        return {
          id: cam.id,
          label: cam.label || '',
          puan
        };
      });

      puanli.sort((a, b) => b.puan - a.puan);
      return puanli[0]?.id || null;
    } catch (err) {
      return null;
    }
  }

  function varsayilanConfig() {
    const base = {
      fps: 8,
      qrbox: { width: 320, height: 140 },
      aspectRatio: 1.7778,
      disableFlip: false,
      rememberLastUsedCamera: true,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true
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

    base.experimentalFeatures = {
      useBarCodeDetectorIfSupported: true
    };

    return base;
  }

  async function stop() {
    try {
      if (activeReader) {
        try { await activeReader.stop(); } catch (e) {}
        try { await activeReader.clear(); } catch (e) {}
      }
    } finally {
      activeReader = null;
      activeReaderElementId = null;
      lastScannedCode = '';
      isStarting = false;
    }
  }

  async function start(options) {
    const {
      readerId,
      wrapId,
      onDetected,
      onError,
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

    try {
      await stop();

      const readerEl = document.getElementById(readerId);
      const wrapEl = wrapId ? document.getElementById(wrapId) : null;

      if (!readerEl) {
        throw new Error('Reader alanı bulunamadı');
      }

      if (wrapEl) wrapEl.style.display = 'block';
      readerEl.innerHTML = '';

      activeReader = new Html5Qrcode(readerId);
      activeReaderElementId = readerId;
      lastScannedCode = '';

      const kameraId = await enUygunArkaKameraIdBul();
      const cameraConfig = kameraId || { facingMode: 'environment' };

      await activeReader.start(
        cameraConfig,
        { ...varsayilanConfig(), ...(config || {}) },
        async decodedText => {
          const temiz = temizKod(decodedText);
          if (!temiz) return;
          if (temiz === lastScannedCode) return;

          lastScannedCode = temiz;
          await onDetected(temiz);
        },
        errMsg => {
          if (typeof onError === 'function') onError(errMsg);
        }
      );
    } finally {
      isStarting = false;
    }
  }

  function isActive() {
    return !!activeReader;
  }

  function getReaderElementId() {
    return activeReaderElementId;
  }

  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      await stop();
    }
  });

  window.addEventListener('pagehide', async () => {
    await stop();
  });

  window.addEventListener('beforeunload', async () => {
    await stop();
  });

  return {
    start,
    stop,
    isActive,
    getReaderElementId,
    temizKod,
    varsayilanConfig
  };
})();
