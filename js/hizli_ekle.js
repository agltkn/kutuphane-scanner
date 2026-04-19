// js/hizli_ekle.js — v64
// v64 — DÜZELTMELER:
//   • _sistemdeVarMiSor(): "sistemde kayıtlı" için scan ANINDA YES/NO mini form
//     → evet: forceEkle:true olarak kuyrukta   → hayır: kuyruktan dışarıda
//     → böylece zatenKayitli item artık kuyrukta gizlice oluşturulmuyor
//     → kamera restart'ta "zaten kuyrukta" hatası kalktı
//   • hizliTopluKaydet: k.forceEkle=true → forceAdd:true ile worker'a gönderir
//   • Kuyruk duplicate (tekrar) ile DB duplicate (sistemde var) kesin ayrıldı
// v63: basHarfBuyut/hapticFeedback global, autocomplete click fix, hizliForceEkle
// v62: API_URL guard, autocomplete dropdown, z-index 9999
// v61: _basHarfBuyut, title-case, _yazarListesiYukle
// v60: video style düzeltmesi  |  v59: mf.querySelector fix
// Bağımlılıklar: api.js (API_URL), utils.js (guvenliYazi, temizIsbn, getUserKey, basHarfBuyut, hapticFeedback), camera.js

(function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let kuyruk        = [];
  let bannerTmr     = null;
  let _yazarListesi = [];

  // ── Yardımcı ──────────────────────────────────────────────────────────────
  function _guvenli(v) {
    return typeof guvenliYazi === 'function'
      ? guvenliYazi(v)
      : String(v || '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;')
          .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _temizIsbn(v) {
    return typeof temizIsbn === 'function'
      ? temizIsbn(v)
      : String(v || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
  }

  function _userKey() {
    return typeof getUserKey === 'function' ? getUserKey() : 'demo-user';
  }

  function _basHarfBuyut(str) {
    if (typeof basHarfBuyut === 'function') return basHarfBuyut(str);
    return String(str || '').trim().replace(/\S+/g, function (w) {
      if (!w) return w;
      try {
        return w.charAt(0).toLocaleUpperCase('tr') + w.slice(1).toLocaleLowerCase('tr');
      } catch (_) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      }
    });
  }

  function _haptic(type) {
    if (typeof hapticFeedback === 'function') { hapticFeedback(type); return; }
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {}
  }

  function _durumHesapla(data) {
    const adi   = (data.kitapAdi || '').trim();
    const yazar = (data.yazar    || '').trim();
    if (adi && yazar) return 'hazir';
    if (adi || yazar) return 'eksik';
    return 'bulunamadi';
  }

  // v63: sonuc.duplicate bayrağı da kontrol edilir
  function _zatenVarMi(sonuc) {
    if (!sonuc.ok) return false;
    if (sonuc.duplicate) return true;
    const msg = String(sonuc.message || '').toLowerCase();
    return (
      msg.includes('zaten') || msg.includes('kayıtlı') ||
      msg.includes('kayitli') || msg.includes('mevcut') ||
      msg.includes('duplicate') || msg.includes('already')
    );
  }

  // ── Yazar listesi ──────────────────────────────────────────────────────────
  async function _yazarListesiYukle() {
    const apiUrl = (typeof API_URL !== 'undefined') ? API_URL : null;
    if (!apiUrl) {
      console.warn('[hizliEkle] _yazarListesiYukle: API_URL tanımsız, atlandı');
      return;
    }
    try {
      const sonuc = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'authorsList' })
      }).then(r => r.json());
      if (sonuc.ok && Array.isArray(sonuc.data)) {
        const map = new Map();
        for (const y of sonuc.data) {
          if (!y) continue;
          const norm = _basHarfBuyut(y);
          const key  = norm.toLocaleLowerCase('tr');
          if (!map.has(key)) map.set(key, norm);
        }
        _yazarListesi = [...map.values()].sort((a, b) =>
          a.toLocaleLowerCase('tr').localeCompare(b.toLocaleLowerCase('tr'), 'tr')
        );
        console.log('[hizliEkle] yazarListesi:', _yazarListesi.length, 'yazar yüklendi');
      } else {
        console.warn('[hizliEkle] authorsList yanıtı beklenmedik:', sonuc);
      }
    } catch (err) {
      console.error('[hizliEkle] _yazarListesiYukle hata:', err);
    }
  }

  // ── Banner ─────────────────────────────────────────────────────────────────
  function bannerGoster(durum, mesaj) {
    const mf = document.getElementById('hizliMiniForm');
    if (mf) mf.style.display = 'none';

    const el = document.getElementById('hizliBanner');
    if (!el) return;
    clearTimeout(bannerTmr);

    const MAP = {
      hazir:      { bg: '#d1fae5', color: '#065f46', emoji: '✅' },
      eksik:      { bg: '#fef9c3', color: '#854d0e', emoji: '⚠️' },
      bulunamadi: { bg: '#fee2e2', color: '#991b1b', emoji: '❌' },
      tekrar:     { bg: '#e0e7ff', color: '#3730a3', emoji: '🔁' },
      kayitli:    { bg: '#f3e8ff', color: '#6b21a8', emoji: '📌' },
      atlandi:    { bg: '#f3f4f6', color: '#6b7280', emoji: '⏭️' },
    };
    const r = MAP[durum] || { bg: '#f3f4f6', color: '#374151', emoji: 'ℹ️' };
    el.style.cssText = `
      display:block;background:${r.bg};color:${r.color};
      border-radius:12px;padding:10px 14px;font-size:15px;font-weight:bold;
      text-align:center;line-height:1.4;
      box-shadow:0 2px 6px rgba(0,0,0,0.07);word-break:break-word;
    `;
    el.innerHTML = `${r.emoji} ${_guvenli(mesaj)}`;
    bannerTmr = setTimeout(() => { if (el) el.style.display = 'none'; }, 2400);
  }

  // ── v64: Sistemde kayıtlı → YES/NO mini form ─────────────────────────────
  // Döner: Promise<boolean> — true=ekle, false=geç
  function _sistemdeVarMiSor(isbn, kitapAdi, yazar) {
    return new Promise(resolve => {
      const banner = document.getElementById('hizliBanner');
      const mf     = document.getElementById('hizliMiniForm');
      if (!mf) { resolve(false); return; }

      if (banner) { clearTimeout(bannerTmr); banner.style.display = 'none'; }

      mf.innerHTML = `
        <div style="
          background:#f3e8ff;border:1px solid #a855f7;border-radius:12px;
          padding:10px 12px;
        ">
          <div style="font-size:13px;color:#6b21a8;font-weight:700;margin-bottom:6px">
            📌 Sistemde zaten kayıtlı
          </div>
          <div style="font-size:13px;color:#4c1d95;font-weight:500;margin-bottom:2px;word-break:break-word">
            ${_guvenli(kitapAdi || isbn)}
          </div>
          ${yazar ? `<div style="font-size:11px;color:#7e22ce;margin-bottom:8px">${_guvenli(yazar)}</div>` : '<div style="margin-bottom:8px"></div>'}
          <div style="font-size:12px;color:#6b21a8;margin-bottom:10px;line-height:1.4">
            Yine de <strong>ikinci kopya</strong> olarak eklemek ister misiniz?
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button id="hizliVarEkleBtn" style="
              padding:9px 6px;font-size:13px;font-weight:bold;border:none;
              border-radius:9px;background:#047857;color:#fff;cursor:pointer;
            ">✓ Evet, Ekle</button>
            <button id="hizliVarGecBtn" style="
              padding:9px 6px;font-size:13px;font-weight:bold;border:none;
              border-radius:9px;background:#6b7280;color:#fff;cursor:pointer;
            ">Hayır, Geç</button>
          </div>
        </div>
      `;
      mf.style.display = 'block';

      const ekleBtn = mf.querySelector('#hizliVarEkleBtn');
      const gecBtn  = mf.querySelector('#hizliVarGecBtn');

      function _evet()  { mf.style.display = 'none'; resolve(true);  }
      function _hayir() { mf.style.display = 'none'; resolve(false); }

      if (ekleBtn) ekleBtn.addEventListener('click', _evet);
      if (gecBtn)  gecBtn.addEventListener('click', _hayir);
    });
  }

  // ── Manuel Giriş Mini Form ────────────────────────────────────────────────
  // Döner: Promise<{kitapAdi, yazar}|null>
  function _manuelGirisGoster(isbn) {
    return new Promise(resolve => {
      const banner = document.getElementById('hizliBanner');
      const mf     = document.getElementById('hizliMiniForm');
      if (!mf) { resolve(null); return; }

      if (banner) { clearTimeout(bannerTmr); banner.style.display = 'none'; }

      if (_yazarListesi.length === 0) _yazarListesiYukle();

      mf.innerHTML = `
        <div style="
          background:#fff8e1;border:1px solid #f59e0b;border-radius:12px;
          padding:10px 12px;
        ">
          <div style="font-size:13px;color:#92400e;font-weight:600;margin-bottom:8px">
            📕 Kitap bilgisi bulunamadı
            <span style="font-weight:normal;color:#b45309;font-size:12px"> — elle girmek ister misiniz?</span>
          </div>
          <div style="font-size:10px;color:#b45309;margin-bottom:6px;font-family:monospace">${_guvenli(isbn)}</div>
          <input id="hizliMiniAdi" type="text" placeholder="Kitap Adı *" autocomplete="off" style="
            width:100%;box-sizing:border-box;padding:8px 10px;font-size:14px;
            border:1px solid #d1d5db;border-radius:8px;margin-bottom:6px;
            outline:none;background:#fff;
          ">
          <div style="position:relative;margin-bottom:8px">
            <input id="hizliMiniYazar" type="text" placeholder="Yazar *" autocomplete="off" style="
              width:100%;box-sizing:border-box;padding:8px 10px;font-size:14px;
              border:1px solid #d1d5db;border-radius:8px;
              outline:none;background:#fff;display:block;
            ">
            <div id="hizliYazarOneri" style="
              display:none;position:absolute;left:0;right:0;top:100%;
              background:#fff;border:1px solid #d1d5db;
              border-radius:8px;margin-top:2px;
              box-shadow:0 6px 16px rgba(0,0,0,0.15);
              z-index:9999;max-height:160px;overflow-y:auto;
            "></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button id="hizliMiniEkleBtn" style="
              padding:9px 6px;font-size:14px;font-weight:bold;border:none;
              border-radius:9px;background:#047857;color:#fff;cursor:pointer
            ">✓ Kuyruğa Ekle</button>
            <button id="hizliMiniGecBtn" style="
              padding:9px 6px;font-size:14px;font-weight:bold;border:none;
              border-radius:9px;background:#6b7280;color:#fff;cursor:pointer
            ">Geç</button>
          </div>
        </div>
      `;
      mf.style.display = 'block';

      const adiEl    = mf.querySelector('#hizliMiniAdi');
      const yazarEl  = mf.querySelector('#hizliMiniYazar');
      const oneriDiv = mf.querySelector('#hizliYazarOneri');
      const ekleBtn  = mf.querySelector('#hizliMiniEkleBtn');
      const gecBtn   = mf.querySelector('#hizliMiniGecBtn');

      function _submit() {
        const adi   = _basHarfBuyut(adiEl   ? adiEl.value.trim()   : '');
        const yazar = _basHarfBuyut(yazarEl ? yazarEl.value.trim() : '');
        if (oneriDiv) oneriDiv.style.display = 'none';
        mf.style.display = 'none';
        resolve(adi || yazar ? { kitapAdi: adi, yazar } : null);
      }
      function _skip() {
        if (oneriDiv) oneriDiv.style.display = 'none';
        mf.style.display = 'none';
        resolve(null);
      }

      // v63: autocomplete click + 300ms blur delay
      if (yazarEl && oneriDiv) {
        function _oneriGoster() {
          const q = yazarEl.value.trim().toLocaleLowerCase('tr');
          if (!q) { oneriDiv.style.display = 'none'; return; }
          const eslesme = _yazarListesi
            .filter(function (y) { return y.toLocaleLowerCase('tr').includes(q); })
            .slice(0, 6);
          if (!eslesme.length) { oneriDiv.style.display = 'none'; return; }
          oneriDiv.innerHTML = eslesme.map(function (y) {
            return '<div style="padding:8px 10px;cursor:pointer;font-size:13px;' +
              'color:#1f2937;border-bottom:1px solid #f3f4f6;" data-y="' +
              _guvenli(y) + '">' + _guvenli(y) + '</div>';
          }).join('');
          oneriDiv.style.display = 'block';
          oneriDiv.querySelectorAll('div[data-y]').forEach(function (item) {
            item.addEventListener('click', function () {
              yazarEl.value = item.dataset.y;
              oneriDiv.style.display = 'none';
            });
          });
        }
        yazarEl.addEventListener('input',   _oneriGoster);
        yazarEl.addEventListener('keyup',   _oneriGoster);
        yazarEl.addEventListener('blur',    function () { setTimeout(function () { oneriDiv.style.display = 'none'; }, 300); });
        yazarEl.addEventListener('keydown', function (e) { if (e.key === 'Escape') oneriDiv.style.display = 'none'; });
      }

      if (adiEl)   adiEl.addEventListener('keydown',   function (e) { if (e.key === 'Enter') { e.preventDefault(); yazarEl && yazarEl.focus(); } });
      if (yazarEl) yazarEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); _submit(); } });

      if (ekleBtn) ekleBtn.addEventListener('click', _submit);
      if (gecBtn)  gecBtn.addEventListener('click',  _skip);

      setTimeout(function () { if (adiEl) adiEl.focus(); }, 80);
    });
  }

  // ── Kuyruk Render ──────────────────────────────────────────────────────────
  function kuyrukRender() {
    const liste = document.getElementById('hizliKuyrukListe');
    const sayac = document.getElementById('hizliSayac');
    if (!liste) return;

    const kaydedilecek = kuyruk.filter(k => (k.durum === 'hazir' || k.forceEkle) && !k.zatenKayitli && !k.yeniKaydedildi).length;
    if (sayac) sayac.textContent = `${kuyruk.length} kayıt — ${kaydedilecek} kaydedilecek`;

    if (!kuyruk.length) {
      liste.innerHTML = '<div style="text-align:center;color:#aaa;padding:14px;font-size:13px">Henüz tarama yapılmadı</div>';
      return;
    }

    const BADGE = {
      hazir:      'background:#d1fae5;color:#065f46',
      eksik:      'background:#fef9c3;color:#854d0e',
      bulunamadi: 'background:#fee2e2;color:#991b1b',
    };

    liste.innerHTML = kuyruk.map((k, i) => {
      const bc     = BADGE[k.durum] || 'background:#e5e7eb;color:#374151';
      const etiket = k.forceEkle ? 'Kopya' : k.durum === 'hazir' ? 'Hazır' : k.durum === 'eksik' ? 'Eksik' : 'Bulunamadı';
      const badgeStyle = k.forceEkle
        ? 'background:#e0e7ff;color:#3730a3'
        : bc;

      const kayitliPill = k.yeniKaydedildi
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:bold;margin-left:5px">Kaydedildi</span>`
        : k.zatenKayitli
        ? `<span style="background:#f3e8ff;color:#6b21a8;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:bold;margin-left:5px">Sistemde Vardı</span>`
        : '';

      // Sadece hizliTopluKaydet sırasında hata ile zatenKayitli olan için fallback
      const forceBtn = (k.zatenKayitli && !k.yeniKaydedildi && !k.forceAdding)
        ? `<button onclick="hizliForceEkle(${i})" style="
            border:none;background:#0b57d0;color:#fff;
            padding:3px 8px;border-radius:6px;font-size:11px;
            font-weight:bold;cursor:pointer;flex-shrink:0;white-space:nowrap;
          ">Yine de Ekle</button>`
        : k.forceAdding
        ? `<span style="font-size:11px;color:#9ca3af;flex-shrink:0">Ekleniyor...</span>`
        : '';

      return `
        <div style="
          background:#fff;border-radius:10px;padding:7px 10px;
          box-shadow:0 1px 3px rgba(0,0,0,0.07);
          display:flex;align-items:center;gap:8px;flex-wrap:wrap;
        ">
          <span style="${badgeStyle};padding:3px 7px;border-radius:999px;font-size:11px;font-weight:bold;white-space:nowrap;flex-shrink:0">
            ${etiket}
          </span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3">
              ${_guvenli(k.kitapAdi || '—')}${kayitliPill}
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:1px;font-family:monospace,monospace">${_guvenli(k.isbn)}</div>
          </div>
          ${forceBtn}
          <button onclick="hizliEkleSil(${i})" style="
            border:none;background:transparent;color:#9ca3af;
            padding:2px 5px;font-size:14px;cursor:pointer;flex-shrink:0;line-height:1;
          " title="Çıkar">✕</button>
        </div>
      `;
    }).join('');
  }

  // ── ISBN İşle — v64 ────────────────────────────────────────────────────────
  async function isbnIslendi(isbn) {
    const temiz = _temizIsbn(isbn);
    if (!temiz) return;

    _haptic('scan');

    // ── 1. Kuyruk duplicate kontrolü ──────────────────────────────────────
    // Bu oturumda zaten taranmış: ekleme, sadece bildir
    const kuyrukItem = kuyruk.find(k => _temizIsbn(k.isbn) === temiz);
    if (kuyrukItem) {
      bannerGoster('tekrar', `Zaten kuyrukta: ${kuyrukItem.kitapAdi || temiz}`);
      return;
    }

    let kayit = {
      isbn:           temiz,
      kitapAdi:       '',
      yazar:          '',
      yayinevi:       '',
      yayinYili:      '',
      durum:          'bulunamadi',
      mesaj:          '',
      zatenKayitli:   false,   // sistemde var mı (artık kuyrukta tutulmaz)
      yeniKaydedildi: false,
      forceAdding:    false,
      forceEkle:      false    // v64: kullanıcı "evet" dedi → forceAdd:true ile kaydet
    };

    // ── 2. API lookup ─────────────────────────────────────────────────────
    try {
      const sonuc = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'isbnLookup', isbn: temiz })
      }).then(r => r.json());

      if (sonuc.ok && sonuc.data) {
        const d = sonuc.data;
        kayit.kitapAdi  = _basHarfBuyut(d.kitapAdi  || '');
        kayit.yazar     = _basHarfBuyut(d.yazar     || '');
        kayit.yayinevi  = d.yayinevi   || '';
        kayit.yayinYili = d.yayinYili  || '';
        kayit.mesaj     = d.mesaj      || '';

        // ── 3. Sistemde kayıtlı → scan ANINDA sor (v64) ──────────────────
        // kuyruk duplicate ile karıştırılmıyor; ayrı YES/NO mini form
        if (d.zatenKayitli) {
          const ekle = await _sistemdeVarMiSor(temiz, kayit.kitapAdi, kayit.yazar);
          if (!ekle) {
            // Kullanıcı "Hayır, Geç" seçti
            bannerGoster('atlandi', `Atlandı: ${kayit.kitapAdi || temiz}`);
            return; // kuyruktan dışarıda, hiç eklenmedi
          }
          // Kullanıcı "Evet, Ekle" seçti → ikinci kopya olarak ekle
          kayit.forceEkle  = true;   // hizliTopluKaydet bunu forceAdd:true ile gönderir
          kayit.durum      = _durumHesapla(kayit);
          kuyruk.unshift(kayit);
          kuyrukRender();
          bannerGoster('hazir', `Kuyruğa eklendi: ${kayit.kitapAdi || temiz}`);
          _haptic('success');
          return;
        }
      }
    } catch (err) {
      kayit.mesaj = 'Bağlantı hatası';
    }

    // ── 4. Normal akış ────────────────────────────────────────────────────
    kayit.durum = _durumHesapla(kayit);

    // Bilgi bulunamadıysa manuel giriş mini formu
    if (kayit.durum === 'bulunamadi') {
      const manuel = await _manuelGirisGoster(temiz);
      if (manuel) {
        kayit.kitapAdi = manuel.kitapAdi || '';
        kayit.yazar    = manuel.yazar    || '';
        kayit.durum    = _durumHesapla(kayit);
      }
    }

    kuyruk.unshift(kayit);
    kuyrukRender();

    if (kayit.durum === 'hazir')      bannerGoster('hazir',      kayit.kitapAdi);
    else if (kayit.durum === 'eksik') bannerGoster('eksik',      `Eksik bilgi: ${kayit.kitapAdi || temiz}`);
    else                              bannerGoster('bulunamadi', `Bulunamadı: ${temiz}`);
  }

  // ── Kamera yardımcıları ───────────────────────────────────────────────────
  function _placeholderGoster(goster) {
    const ph = document.getElementById('hizliCameraPlaceholder');
    const wm = document.getElementById('hizliWatermark');
    if (ph) ph.style.display = goster ? 'flex' : 'none';
    if (wm) wm.style.display = goster ? 'none' : 'block';
  }

  // ── Kamera ────────────────────────────────────────────────────────────────
  async function hizliKameraBaslat() {
    if (!window.KutuphaneCamera) {
      bannerGoster('bulunamadi', 'Kamera modülü yüklenemedi');
      return;
    }
    _placeholderGoster(false);
    try {
      await window.KutuphaneCamera.start({
        readerId:   'hizliReader',
        wrapId:     'hizliScannerWrap',
        adaptifMod: true,

        onAdaptif: () => {
          const wm = document.getElementById('hizliWatermark');
          if (!wm) return;
          wm.textContent      = 'Hassas mod aktif';
          wm.style.color      = 'rgba(255,255,255,0.75)';
          wm.style.fontWeight = 'bold';
        },

        onRestartNormal: () => {
          const wm = document.getElementById('hizliWatermark');
          if (!wm) return;
          wm.textContent      = 'Küçük barkodlar için 3 sn bekleyin';
          wm.style.color      = 'rgba(255,255,255,0.38)';
          wm.style.fontWeight = 'normal';
        },

        onDetected: async (isbn) => {
          await isbnIslendi(isbn);
        }
      });
    } catch (err) {
      _placeholderGoster(true);
      bannerGoster('bulunamadi', 'Kamera açılamadı: ' + (err.message || err));
    }
  }

  async function hizliKameraKapat() {
    if (window.KutuphaneCamera) await window.KutuphaneCamera.stop();
    const reader = document.getElementById('hizliReader');
    if (reader) reader.innerHTML = '';
    _placeholderGoster(true);
  }

  // ── Toplu Kaydet ──────────────────────────────────────────────────────────
  async function hizliTopluKaydet() {
    // forceEkle:true olanlar da dahil (sistemde var ama kullanıcı eklemeyi onayladı)
    const adaylar = kuyruk.filter(k =>
      (k.durum === 'hazir' || k.forceEkle) && !k.zatenKayitli && !k.yeniKaydedildi
    );
    if (!adaylar.length) {
      bannerGoster('bulunamadi', 'Kaydedilecek uygun kayıt yok');
      return;
    }
    const btn = document.getElementById('hizliKaydetBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor...'; }

    let basarili = 0, duplicate = 0, hatali = 0;

    for (const k of adaylar) {
      try {
        const payload = {
          action:    'bookAdd',
          userKey:   _userKey(),
          isbn:      k.isbn,
          kitapAdi:  k.kitapAdi,
          yazar:     k.yazar,
          yayinevi:  k.yayinevi,
          yayinYili: k.yayinYili,
          notText:   ''
        };
        // v64: kullanıcı onay vermişse forceAdd:true gönder
        if (k.forceEkle) payload.forceAdd = true;

        const sonuc = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (!sonuc.ok) {
          k.mesaj = sonuc.error || 'Kayıt hatası'; hatali++;
        } else if (_zatenVarMi(sonuc)) {
          // forceAdd olmayan adayda duplicate yanıtı geldiyse (edge case)
          k.zatenKayitli = true;
          k.mesaj = sonuc.message || 'Sistemde zaten mevcut'; duplicate++;
        } else {
          k.yeniKaydedildi = true; k.mesaj = ''; basarili++;
        }
      } catch (err) {
        k.mesaj = 'Bağlantı hatası'; hatali++;
      }
    }

    kuyrukRender();
    if (btn) { btn.disabled = false; btn.textContent = '💾 Toplu Kaydet'; }

    const parcalar = [];
    if (basarili)  parcalar.push(`${basarili} eklendi`);
    if (duplicate) parcalar.push(`${duplicate} zaten vardı`);
    if (hatali)    parcalar.push(`${hatali} hata`);
    const tip = hatali > 0 ? 'eksik' : (duplicate > 0 && basarili === 0) ? 'kayitli' : 'hazir';
    bannerGoster(tip, parcalar.join(', '));
    if (basarili > 0)  _haptic('success');
    else if (hatali > 0) _haptic('error');
  }

  // ── Global fonksiyonlar ────────────────────────────────────────────────────
  window.hizliEkleSil = function (index) {
    kuyruk.splice(index, 1);
    kuyrukRender();
  };

  window.hizliKuyrukTemizle = function () {
    if (!kuyruk.length) return;
    if (!confirm('Tüm kuyruk temizlensin mi?')) return;
    kuyruk = [];
    kuyrukRender();
  };

  // v63 fallback: hizliTopluKaydet sırasında hata ile zatenKayitli olan itemlar için
  window.hizliForceEkle = async function (index) {
    const k = kuyruk[index];
    if (!k) return;
    k.forceAdding = true;
    kuyrukRender();
    try {
      const sonuc = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bookAdd', userKey: _userKey(), forceAdd: true,
          isbn: k.isbn, kitapAdi: k.kitapAdi, yazar: k.yazar,
          yayinevi: k.yayinevi, yayinYili: k.yayinYili, notText: ''
        })
      }).then(r => r.json());
      if (sonuc.ok && !_zatenVarMi(sonuc)) {
        k.yeniKaydedildi = true;
        k.zatenKayitli   = false;
        k.mesaj          = '';
        _haptic('success');
        bannerGoster('hazir', `Eklendi: ${k.kitapAdi || k.isbn}`);
      } else {
        k.mesaj = sonuc.error || sonuc.message || 'Kayıt hatası';
        _haptic('error');
        bannerGoster('bulunamadi', k.mesaj);
      }
    } catch (err) {
      k.mesaj = 'Bağlantı hatası';
      _haptic('error');
      bannerGoster('bulunamadi', 'Bağlantı hatası');
    } finally {
      k.forceAdding = false;
      kuyrukRender();
    }
  };

  // v60: Html5Qrcode video elementini konteynere doğal oturtur
  function _videoStyleDuzelt() {
    if (document.getElementById('hizliVideoStyle')) return;
    const s = document.createElement('style');
    s.id = 'hizliVideoStyle';
    s.textContent =
      '#hizliReader video{width:100%!important;height:100%!important;' +
      'object-fit:cover!important;position:absolute!important;inset:0!important;}' +
      '#hizliReader{overflow:hidden!important;}';
    document.head.appendChild(s);
  }

  window.hizliEkleForm = function () {
    const alan = document.getElementById('formAlani');
    if (!alan) return;
    _videoStyleDuzelt();
    _yazarListesiYukle();
    kuyruk = [];

    alan.innerHTML = `
      <div style="
        background:#fff;border-radius:20px;padding:14px 14px 16px;
        box-shadow:0 6px 16px rgba(0,0,0,0.10);margin-top:14px;
      ">

        <div style="font-size:17px;font-weight:bold;text-align:center;margin-bottom:10px;color:#333">
          ⚡ Hızlı Ekle
        </div>

        <!-- kamera alanı: sabit 200px -->
        <div id="hizliScannerWrap" style="
          position:relative;height:200px;border-radius:14px;
          overflow:hidden;background:#111;margin-bottom:8px;
        ">
          <div id="hizliCameraPlaceholder" style="
            position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            background:#1c1c1c;color:#666;font-size:13px;gap:8px;
            pointer-events:none;
          ">
            <span style="font-size:36px;opacity:0.5">📷</span>
            <span>Başlat'a basarak kamerayı açın</span>
          </div>

          <div id="hizliReader" style="
            width:100%;height:100%;background:#000;touch-action:manipulation;
          "></div>

          <div id="hizliWatermark" style="
            position:absolute;bottom:8px;left:0;right:0;
            text-align:center;color:rgba(255,255,255,0.38);
            font-size:11px;letter-spacing:0.2px;
            pointer-events:none;padding:0 10px;display:none;
          ">Küçük barkodlar için 3 sn bekleyin</div>
        </div>

        <!-- kamera butonları -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <button onclick="hizliKameraBaslat()" style="
            padding:10px 8px;font-size:15px;font-weight:bold;border:none;
            border-radius:12px;background:#0b57d0;color:#fff;cursor:pointer
          ">📷 Başlat</button>
          <button onclick="hizliKameraKapat()" style="
            padding:10px 8px;font-size:15px;font-weight:bold;border:none;
            border-radius:12px;background:#6b7280;color:#fff;cursor:pointer
          ">⏹ Kapat</button>
        </div>

        <!-- bilgi alanı: banner veya mini form -->
        <div id="hizliBilgiAlani" style="margin-bottom:6px;min-height:42px;overflow:visible">
          <div id="hizliBanner" style="display:none"></div>
          <div id="hizliMiniForm" style="display:none"></div>
        </div>

        <!-- sayac -->
        <div id="hizliSayac" style="
          font-size:12px;color:#666;margin-bottom:6px;
          text-align:center;font-weight:600;letter-spacing:0.2px;
        ">0 kayıt — 0 kaydedilecek</div>

        <!-- kuyruk listesi -->
        <div id="hizliKuyrukListe" style="
          max-height:220px;overflow-y:auto;
          display:grid;gap:5px;margin-bottom:12px;
        ">
          <div style="text-align:center;color:#aaa;padding:14px;font-size:13px">
            Henüz tarama yapılmadı
          </div>
        </div>

        <!-- aksiyon -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button id="hizliKaydetBtn" onclick="hizliTopluKaydet()" style="
            padding:13px 8px;font-size:16px;font-weight:bold;border:none;
            border-radius:12px;background:#047857;color:#fff;cursor:pointer
          ">💾 Toplu Kaydet</button>
          <button onclick="hizliKuyrukTemizle()" style="
            padding:13px 8px;font-size:16px;font-weight:bold;border:none;
            border-radius:12px;background:#b91c1c;color:#fff;cursor:pointer
          ">🗑️ Temizle</button>
        </div>

      </div>
    `;

    kuyrukRender();
    setTimeout(() => { alan.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  window.hizliKameraBaslat = hizliKameraBaslat;
  window.hizliKameraKapat  = hizliKameraKapat;
  window.hizliTopluKaydet  = hizliTopluKaydet;

})();
