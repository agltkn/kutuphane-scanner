// js/camera.js — v5
// v5: restartNormal() + isAdaptifAktif() — hassas mod her barkod sonrası sıfırlanır
//     her yeni okuma döngüsü normal moddan başlar, küçük barkod modu geçicidir
// v4: geçersiz barkod filtresi (uzunluk + EAN-13 checksum), adaptif 3s,
//     lastScannedCode sadece start/stop kontrolünde, restart cooldown 600ms

window.KutuphaneCamera = (function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let activeReader          = null;
  let activeReaderElementId = null;
  let lastScannedCode       = "";
  let isStarting            = false;
  let adaptifTimer          = null;
  let _adaptifAktif         = false;  // v5: küçük barkod modu aktif mi?
  let _lastStartOpts        = null;   // v5: restart için son start() parametreleri

  // ── temizKod: sadece EAN-8 (8) veya EAN-13 (13) uzunluğu kabul et ─────────
  function temizKod(text) {
    const s = String(text || "").toUpperCase().replace(/[^0-9X]/g, "").trim();
    if (s.length !== 8 && s.length !== 13) return ""; // kısa/uzun → geçersiz
    return s;
  }

  // EAN-13 checksum doğrulaması (kitap ISBN barkodları için ek güvence)
  function _ean13Gecerli(kod) {
    if (!/^\d{13}$/.test(kod)) return false;
    const d   = kod.split("").map(Number);
    const sum = d.slice(0, 12).reduce((acc, v, i) => acc + v * (i % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === d[12];
  }

  // Barkod güvenilirlik kontrolü
  function _barkodGecerli(kod) {
    if (!kod) return false;
    if (kod.length === 13) return _ean13Gecerli(kod); // checksum zorunlu
    if (kod.length === 8)  return true;               // EAN-8: lib zaten doğrulamış
    return false;
  }

  // ── Kamera seçici ─────────────────────────────────────────────────────────
  async function enUygunArkaKameraIdBul() {
    try {
      if (typeof Html5Qrcode === "undefined" || !Html5Qrcode.getCameras) return null;
      const devices = await Html5Qrcode.getCameras();
      if (!devices || !devices.length) return null;

      const arkaKameralar = devices.filter(d => {
        const lbl = String(d.label || "").toLowerCase();
        return lbl.includes("back") || lbl.includes("rear") ||
               lbl.includes("environment") || lbl.includes("arka");
      });

      const hedefListe = arkaKameralar.length ? arkaKameralar : devices;

      const puanli = hedefListe.map(cam => {
        const lbl = String(cam.label || "").toLowerCase();
        let puan = 0;
        if (lbl.includes("main"))        puan += 14;
        if (lbl.includes("1x"))          puan += 12;
        if (lbl.includes("back"))        puan += 6;
        if (lbl.includes("rear"))        puan += 6;
        if (lbl.includes("environment")) puan += 6;
        if (lbl.includes("wide"))        puan -= 12;
        if (lbl.includes("ultra"))       puan -= 16;
        if (lbl.includes("0.5"))         puan -= 16;
        if (lbl.includes("telephoto"))   puan -= 4;
        if (lbl.includes("front"))       puan -= 20;
        return { id: cam.id, label: cam.label || "", puan };
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

    if (typeof Html5QrcodeSupportedFormats !== "undefined") {
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
  function varsayilanConfig() {
    return {
      ..._ortakAyarlar(),
      fps: 12,
      qrbox: (w, _h) => {
        const bw = Math.min(Math.round(w * 0.90), 380);
        return { width: bw, height: Math.round(bw * 0.45) };
      }
    };
  }

  // ── Küçük barkod config ────────────────────────────────────────────────────
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

  // ── İç stop ───────────────────────────────────────────────────────────────
  // lastScannedCode SIFIRLANMAZ — caller kontrolünde (adaptif koruma için)
  async function _stopInner() {
    if (activeReader) {
      try { await activeReader.stop(); }  catch (_) {}
      try { await activeReader.clear(); } catch (_) {}
    }
    activeReader          = null;
    activeReaderElementId = null;
  }

  // ── Dışa açık stop — her şeyi sıfırlar ───────────────────────────────────
  async function stop() {
    clearTimeout(adaptifTimer);
    adaptifTimer    = null;
    _adaptifAktif   = false;
    _lastStartOpts  = null;
    await _stopInner();
    lastScannedCode = ""; // kullanıcı kapattı → temiz slate
    isStarting      = false;
  }

  // ── Ortak scan başlatıcı ──────────────────────────────────────────────────
  // ignoreScanMs: restart sonrası bu süre decode sonuçları yoksayılır
  async function _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError, ignoreScanMs) {
    const readerEl = document.getElementById(readerId);
    const wrapEl   = wrapId ? document.getElementById(wrapId) : null;
    if (!readerEl) throw new Error("Reader alanı bulunamadı: " + readerId);

    if (wrapEl) wrapEl.style.display = "block";
    readerEl.innerHTML = "";

    activeReader          = new Html5Qrcode(readerId);
    activeReaderElementId = readerId;
    // lastScannedCode DOKUNULMAZ — caller set ediyor

    const kameraId     = await enUygunArkaKameraIdBul();
    const cameraConfig = kameraId || { facingMode: "environment" };
    const ignoreUntil  = (ignoreScanMs > 0) ? (Date.now() + ignoreScanMs) : 0;

    await activeReader.start(
      cameraConfig,
      scanConfig,
      async decodedText => {
        // 1. Restart cooldown — ilk N ms yoksay
        if (ignoreUntil > 0 && Date.now() < ignoreUntil) return;

        // 2. Uzunluk filtresi — sadece EAN-8 veya EAN-13
        const temiz = temizKod(decodedText);
        if (!temiz) return;

        // 3. EAN-13 checksum — geçersizse çöp
        if (!_barkodGecerli(temiz)) return;

        // 4. Tekrar okuma koruması
        if (temiz === lastScannedCode) return;

        // ── Geçerli okuma ──
        clearTimeout(adaptifTimer);
        adaptifTimer    = null;
        lastScannedCode = temiz;
        await onDetected(temiz);
      },
      errMsg => {
        if (typeof onError === "function") onError(errMsg);
      }
    );
  }

  // ── v5: Adaptif timer kurucusu (DRY — start() ve restartNormal() kullanır) ─
  function _armAdaptifTimer(readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif) {
    if (!adaptifMod) return;
    adaptifTimer = setTimeout(async () => {
      if (activeReaderElementId !== readerId) return;
      const savedCode = lastScannedCode; // önceki kodu koru — çift ateşleme önler
      try {
        await _stopInner();
        lastScannedCode = savedCode;     // restore
        _adaptifAktif   = true;          // v5: hassas mod aktif olarak işaretle
        // 600ms cooldown: restart sonrası anlık/bayat frame yoksayılır
        await _scanBaslat(readerId, wrapId, kucukBarkodConfig(), onDetected, onError, 600);
        if (typeof onAdaptif === "function") onAdaptif();
      } catch (_) {
        // geçiş başarısız — sessizce devam
      }
    }, 3000);
  }

  // ── start ─────────────────────────────────────────────────────────────────
  async function start(options) {
    const {
      readerId,
      wrapId,
      onDetected,
      onError,
      onAdaptif,  // () => void — küçük mod aktifleşince çağrılır
      adaptifMod, // true → 3s sonra otomatik küçük barkod moduna geç
      config      // varsayilanConfig override
    } = options || {};

    if (!readerId || typeof onDetected !== "function") {
      throw new Error("camera.js: readerId ve onDetected zorunlu");
    }
    if (typeof Html5Qrcode === "undefined") {
      throw new Error("Html5Qrcode yüklenemedi");
    }
    if (isStarting) return;
    isStarting = true;

    clearTimeout(adaptifTimer);
    adaptifTimer   = null;
    _adaptifAktif  = false; // v5: taze başlangıç — normal mod
    _lastStartOpts = { readerId, wrapId, onDetected, onError, onAdaptif, adaptifMod, config }; // v5

    try {
      await _stopInner();
      lastScannedCode = ""; // taze başlangıç — sıfırla

      const scanConfig = { ...varsayilanConfig(), ...(config || {}) };
      await _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError, 0);

      _armAdaptifTimer(readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif); // v5

    } finally {
      isStarting = false;
    }
  }

  // ── v5: restartNormal — barkod okundu, hassas moddan çık, normal moda dön ──
  // Çağıran: hizli_ekle.js onDetected callback, isbnIslendi() tamamlandıktan sonra
  async function restartNormal() {
    if (!_lastStartOpts) return;
    const { readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif, config } = _lastStartOpts;
    if (activeReaderElementId !== readerId) return;

    const savedCode = lastScannedCode; // yeni okuma için koru
    clearTimeout(adaptifTimer);
    adaptifTimer  = null;
    _adaptifAktif = false; // normal moda dön

    try {
      await _stopInner();
      lastScannedCode = savedCode; // restore — aynı barkodu tekrar okumasın
      const scanConfig = { ...varsayilanConfig(), ...(config || {}) };
      await _scanBaslat(readerId, wrapId, scanConfig, onDetected, onError, 300);
      _armAdaptifTimer(readerId, wrapId, onDetected, onError, adaptifMod, onAdaptif);
    } catch (_) {
      // restart başarısız — sessizce devam
    }
  }

  // ── v5: Durum sorgusu — hassas mod aktif mi? ──────────────────────────────
  function isAdaptifAktif() { return _adaptifAktif; }

  // ── Durum ─────────────────────────────────────────────────────────────────
  function isActive()           { return !!activeReader; }
  function getReaderElementId() { return activeReaderElementId; }

  // ── Sayfa yaşam döngüsü ───────────────────────────────────────────────────
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) await stop();
  });
  window.addEventListener("pagehide",     async () => { await stop(); });
  window.addEventListener("beforeunload", async () => { await stop(); });

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    start,
    stop,
    restartNormal,   // v5
    isAdaptifAktif,  // v5
    isActive,
    getReaderElementId,
    temizKod,
    varsayilanConfig,
    kucukBarkodConfig
  };

})();
