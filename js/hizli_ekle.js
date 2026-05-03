// js/hizli_ekle.js — v70
// v70: Seri okuma UX iyileştirmeleri
//   - Flash efekti: barkod okunduğunda kamera alanı 130ms yeşil parlar
//   - Sayaç: "#hizliTaramaSayaci" başarılı kuyruk eklemelerini sayar
//   - Haptic: navigator.vibrate(50) barkod okunduğunda
//   - Toast: 'hazir' banneri 2400ms → 1000ms (spam yapmaz)
//   - CSS: .scan-success overlay eklendi
// v69 — hizliTopluKaydet: k._basarili property mutation yerine Set<ref> takibi;
//        if(basarili>0) guard kaldırıldı — filter her zaman çalışır.
//        Root cause: basarili===0 durumunda filter hiç koşmuyordu.
// v68 — forceEkle:true kayıtlarda kuyruk mesajı temizleniyor;
//        kuyrukRender'da hataPill forceEkle durumunda gizleniyor.
//        Root cause: isbnLookup'tan gelen d.mesaj forceEkle sonrası temizlenmiyordu.
// v67 — forceEkle:true kayıtlar için API "zaten var" yanıtı başarı sayılıyor;
//        kuyruktan doğru siliniyor. Root cause: _zatenVarMi forceEkle'yi ayırt etmiyordu.
// v66 — Toplu Kaydet sonrası başarılı kayıtlar kuyruktan siliniyor;
//        hatalı kayıtlar kuyrukta kalıyor, kullanıcı tekrar deneyebilir.
//        yeniKaydedildi state'i kaldırıldı — artık gereksiz.
// v65 — Duplicate ISBN akışı yeniden tasarlandı:
//   • Otomatik bloklama YOK — her duplicate durumda kullanıcıya sor
//   • _duplicateInfoGoster(): kamera altında inline bilgi paneli (popup değil)
//     - Durum 1: Sadece DB'de var    → "kütüphanede zaten var"
//     - Durum 2: Sadece kuyrukta var → "kuyrukta zaten var"
//     - Durum 3: Her ikisinde de var → "hem kütüphanede hem kuyrukta var"
//     - Butonlar: Ekle / Geç
//   • Ekle → kuyrukta yeni kayıt (her basışta gerçekten yeni)
//   • Geç  → hiçbir işlem yapma
//   • Camera.js lastScannedCode mekanizması bozulmadı (kasıtlı auto-tekrar engeli)
//   • Kamera kapanmıyor; _isProcessing lock kullanıcı seçim yapana kadar tutuluyor
// v64: _sistemdeVarMiSor, isbnIslendi restructure, forceEkle
// v63: basHarfBuyut/hapticFeedback global, autocomplete click fix
// Bağımlılıklar: api.js (API_URL), utils.js (guvenliYazi, temizIsbn, getUserKey, basHarfBuyut, hapticFeedback), camera.js

(function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let kuyruk          = [];
  let bannerTmr       = null;
  let _yazarListesi   = [];
  let _taramaSayaci   = 0; // v70: başarılı kuyruk ekleme sayacı

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
    // v70: başarı toast'u 1s, diğerleri 2.4s
    bannerTmr = setTimeout(() => { if (el) el.style.display = 'none'; }, durum === 'hazir' ? 1000 : 2400);
  }

  // ── v65: Duplicate bilgi paneli — kamera altında inline, popup değil ────────
  // dbde  : isbnLookup → zatenKayitli:true
  // kuyrukta: aynı ISBN bu oturumda kuyrukta
  // Döner: Promise<boolean> — true=ekle, false=geç
  function _duplicateInfoGoster(isbn, kitapAdi, yazar, kuyrukta, dbde) {
    return new Promise(resolve => {
      const banner = document.getElementById('hizliBanner');
      const mf     = document.getElementById('hizliMiniForm');
      if (!mf) { resolve(false); return; }

      if (banner) { clearTimeout(bannerTmr); banner.style.display = 'none'; }

      // Duruma göre renk + mesaj
      let ikon, mesaj, bg, border, renk;
      if (dbde && kuyrukta) {
        ikon = '⚠️'; mesaj = 'Bu ISBN hem kütüphanede hem kuyrukta var';
        bg = '#fff7ed'; border = '#fb923c'; renk = '#9a3412';
      } else if (dbde) {
        ikon = '📌'; mesaj = 'Bu ISBN kütüphanede zaten var';
        bg = '#f3e8ff'; border = '#a855f7'; renk = '#6b21a8';
      } else {
        ikon = '🔁'; mesaj = 'Bu ISBN zaten kuyrukta var';
        bg = '#e0e7ff'; border = '#818cf8'; renk = '#3730a3';
      }

      const kitapSatiri = (kitapAdi || yazar)
        ? `<div style="font-size:12px;color:${renk};opacity:0.85;margin-bottom:8px;word-break:break-word;font-weight:500">
            ${_guvenli(kitapAdi || isbn)}${yazar ? ' — ' + _guvenli(yazar) : ''}
           </div>`
        : '<div style="margin-bottom:8px"></div>';

      mf.innerHTML = `
        <div style="
          background:${bg};border:1px solid ${border};border-radius:12px;
          padding:10px 12px;
        ">
          <div style="font-size:13px;color:${renk};font-weight:700;margin-bottom:4px">
            ${ikon} ${_guvenli(mesaj)}
          </div>
          ${kitapSatiri}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button id="hizliDupEkleBtn" style="
              padding:9px 6px;font-size:13px;font-weight:bold;border:none;
              border-radius:9px;background:#047857;color:#fff;cursor:pointer;
            ">✓ Ekle</button>
            <button id="hizliDupGecBtn" style="
              padding:9px 6px;font-size:13px;font-weight:bold;border:none;
              border-radius:9px;background:#6b7280;color:#fff;cursor:pointer;
            ">Geç</button>
          </div>
        </div>
      `;
      mf.style.display = 'block';

      const ekleBtn = mf.querySelector('#hizliDupEkleBtn');
      const gecBtn  = mf.querySelector('#hizliDupGecBtn');

      function _evet()  { mf.style.display = 'none'; resolve(true);  }
      function _hayir() { mf.style.display = 'none'; resolve(false); }

      if (ekleBtn) ekleBtn.addEventListener('click', _evet);
      if (gecBtn)  gecBtn.addEventListener('click',  _hayir);
    });
  }

  // ── Manuel Giriş Mini Form (ISBN bulunamadı) ──────────────────────────────
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

    // v66: yeniKaydedildi yok — başarılılar zaten kuyruktan silindi
    const kaydedilecek = kuyruk.filter(k => k.durum === 'hazir' || k.forceEkle).length;
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
      const etiket     = k.forceEkle ? 'Kopya' : k.durum === 'hazir' ? 'Hazır' : k.durum === 'eksik' ? 'Eksik' : 'Bulunamadı';
      const badgeStyle = k.forceEkle ? 'background:#e0e7ff;color:#3730a3' : (BADGE[k.durum] || 'background:#e5e7eb;color:#374151');

      // Hata mesajı varsa küçük kırmızı satır göster
      // v68: forceEkle:true ise mesaj gösterilmez (kullanıcı bilinçli ekledi)
      const hataPill = k.mesaj && !k.forceEkle
        ? `<div style="font-size:11px;color:#b91c1c;margin-top:2px">${_guvenli(k.mesaj)}</div>`
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
              ${_guvenli(k.kitapAdi || '—')}
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:1px;font-family:monospace,monospace">${_guvenli(k.isbn)}</div>
            ${hataPill}
          </div>
          <button onclick="hizliEkleSil(${i})" style="
            border:none;background:transparent;color:#9ca3af;
            padding:2px 5px;font-size:14px;cursor:pointer;flex-shrink:0;line-height:1;
          " title="Çıkar">✕</button>
        </div>
      `;
    }).join('');
  }

  // ── ISBN İşle — v65 ────────────────────────────────────────────────────────
  // v70: kamera alanında kısa yeşil flash efekti
  function _scanFlash() {
    try {
      const wrap = document.getElementById('hizliScannerWrap');
      if (!wrap) return;
      const flash = document.getElementById('hizliFlash');
      if (!flash) return;
      flash.style.opacity = '1';
      setTimeout(() => { flash.style.opacity = '0'; }, 130);
    } catch (_) {}
  }

  // v70: sayacı güncelle
  function _sayacGuncelle() {
    const el = document.getElementById('hizliTaramaSayaci');
    if (el) el.textContent = _taramaSayaci + ' kitap eklendi';
  }

  async function isbnIslendi(isbn) {
    const temiz = _temizIsbn(isbn);
    if (!temiz) return;

    _haptic('scan');
    // v70: haptic + flash
    try { if (navigator.vibrate) navigator.vibrate(50); } catch (_) {}
    _scanFlash();

    // ── 1. Mevcut durum tespiti ────────────────────────────────────────────
    // Not: otomatik bloklama YOK — her durumda kullanıcıya sorulur
    const kuyrukItem = kuyruk.find(k => _temizIsbn(k.isbn) === temiz);
    const kuyrukta   = !!kuyrukItem;

    let kayit = {
      isbn:        temiz,
      kitapAdi:    '',
      yazar:       '',
      yayinevi:    '',
      yayinYili:   '',
      durum:       'bulunamadi',
      mesaj:       '',
      forceEkle:   false
    };

    let dbde = false;

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
        dbde            = !!(d.zatenKayitli);

        // Kitap bilgisi kuyruk öğesinden tamamlanabilir
        // (kuyrukta var ama DB'de yoksa API internet'ten baktı; bulamazsa kuyruktan al)
        if (!kayit.kitapAdi && kuyrukItem) kayit.kitapAdi = kuyrukItem.kitapAdi;
        if (!kayit.yazar    && kuyrukItem) kayit.yazar    = kuyrukItem.yazar;
        if (!kayit.yayinevi && kuyrukItem) kayit.yayinevi = kuyrukItem.yayinevi;
        if (!kayit.yayinYili && kuyrukItem) kayit.yayinYili = kuyrukItem.yayinYili;
      }
    } catch (err) {
      kayit.mesaj = 'Bağlantı hatası';
      // Bağlantı hatası varsa kuyruk bilgisini kopyala
      if (kuyrukItem) {
        kayit.kitapAdi  = kuyrukItem.kitapAdi;
        kayit.yazar     = kuyrukItem.yazar;
        kayit.yayinevi  = kuyrukItem.yayinevi;
        kayit.yayinYili = kuyrukItem.yayinYili;
      }
    }

    // ── 3. Duplicate durumu: kullanıcıya sor ─────────────────────────────
    // DB'de veya kuyrukta varsa → _duplicateInfoGoster → Ekle/Geç
    if (kuyrukta || dbde) {
      const ekle = await _duplicateInfoGoster(temiz, kayit.kitapAdi, kayit.yazar, kuyrukta, dbde);

      if (!ekle) {
        bannerGoster('atlandi', `Atlandı: ${kayit.kitapAdi || temiz}`);
        return; // Kullanıcı "Geç" seçti — kuyrukta hiçbir şey değişmez
      }

      // Kullanıcı "Ekle" seçti — her basışta yeni kayıt
      if (dbde) kayit.forceEkle = true; // hizliTopluKaydet → forceAdd:true ile gönderir
      kayit.mesaj = ''; // v68: isbnLookup'tan gelen "zaten var" mesajını temizle
      kayit.durum = _durumHesapla(kayit);

      // Bilgi eksikse (ne DB'den ne internetten gelebildi) kısmen kaydet
      kuyruk.unshift(kayit);
      _taramaSayaci++; _sayacGuncelle(); // v70
      kuyrukRender();
      bannerGoster('hazir', `Kuyruğa eklendi: ${kayit.kitapAdi || temiz}`);
      _haptic('success');
      return;
    }

    // ── 4. Normal akış: ne DB'de ne kuyrukta ─────────────────────────────
    kayit.durum = _durumHesapla(kayit);

    // Bilgi bulunamadıysa manuel giriş formu
    if (kayit.durum === 'bulunamadi') {
      const manuel = await _manuelGirisGoster(temiz);
      if (manuel) {
        kayit.kitapAdi = manuel.kitapAdi || '';
        kayit.yazar    = manuel.yazar    || '';
        kayit.durum    = _durumHesapla(kayit);
      }
    }

    kuyruk.unshift(kayit);
    _taramaSayaci++; _sayacGuncelle(); // v70
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
    const adaylar = kuyruk.filter(k => k.durum === 'hazir' || k.forceEkle);
    if (!adaylar.length) {
      bannerGoster('bulunamadi', 'Kaydedilecek uygun kayıt yok');
      return;
    }

    const btn = document.getElementById('hizliKaydetBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor...'; }

    let basarili = 0, duplicate = 0, hatali = 0;
    // v69: property mutation yerine referans bazlı Set takibi
    const basariliSet = new Set();

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
        if (k.forceEkle) payload.forceAdd = true;

        const sonuc = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (!sonuc.ok) {
          k.mesaj = sonuc.error || 'Kayıt hatası'; hatali++;
        } else if (!k.forceEkle && _zatenVarMi(sonuc)) {
          // Beklenmedik duplicate — forceEkle olmayan kayıtlar için hata
          k.mesaj = sonuc.message || 'Sistemde zaten mevcut'; duplicate++;
        } else {
          // Başarılı — forceEkle:true için ok:true her zaman başarı sayılır
          basariliSet.add(k);
          k.mesaj = ''; basarili++;
        }
      } catch (err) {
        k.mesaj = 'Bağlantı hatası'; hatali++;
      }
    }

    // v69: guard yok — filter her zaman çalışır, basariliSet boşsa no-op
    kuyruk = kuyruk.filter(k => !basariliSet.has(k));

    kuyrukRender();
    if (btn) { btn.disabled = false; btn.textContent = '💾 Toplu Kaydet'; }

    const parcalar = [];
    if (basarili)  parcalar.push(`${basarili} eklendi`);
    if (duplicate) parcalar.push(`${duplicate} tekrar`);
    if (hatali)    parcalar.push(`${hatali} hata`);
    if (kuyruk.length && (hatali || duplicate)) {
      parcalar.push(`${kuyruk.filter(k => k.durum === 'hazir' || k.forceEkle).length} kayıt kaldı`);
    }
    const tip = hatali > 0 ? 'eksik' : duplicate > 0 ? 'kayitli' : 'hazir';
    bannerGoster(tip, parcalar.join(' · '));
    if (basarili > 0)    _haptic('success');
    else if (hatali > 0) _haptic('error');
  }

  // ── Global ────────────────────────────────────────────────────────────────
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
    kuyruk        = [];
    _taramaSayaci = 0; // v70: her form açılışında sayacı sıfırla

    alan.innerHTML = `
      <div style="
        background:#fff;border-radius:20px;padding:14px 14px 16px;
        box-shadow:0 6px 16px rgba(0,0,0,0.10);margin-top:14px;
      ">
        <div style="font-size:17px;font-weight:bold;text-align:center;margin-bottom:10px;color:#333">
          ⚡ Hızlı Ekle
        </div>

        <!-- kamera alanı -->
        <div id="hizliScannerWrap" style="
          position:relative;height:240px;border-radius:16px;
          overflow:hidden;background:#111;margin-bottom:8px;
          max-width:420px;margin-left:auto;margin-right:auto;
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

          <!-- v70: scan flash overlay — barkod okunduğunda yeşil parlar -->
          <div id="hizliFlash" style="
            position:absolute;inset:0;
            background:rgba(0,220,100,0.28);
            opacity:0;pointer-events:none;
            transition:opacity 0.13s ease;
            border-radius:16px;
          "></div>

          <div id="hizliWatermark" style="
            position:absolute;bottom:8px;left:0;right:0;
            text-align:center;color:rgba(255,255,255,0.38);
            font-size:11px;letter-spacing:0.2px;
            pointer-events:none;padding:0 10px;display:none;
          ">Küçük barkodlar için 3 sn bekleyin</div>
        </div>

        <!-- v70: tarama sayacı -->
        <div id="hizliTaramaSayaci" style="
          text-align:center;font-size:12px;font-weight:600;
          color:#059669;letter-spacing:0.2px;margin-bottom:4px;min-height:16px;
        "></div>

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

        <!-- bilgi alanı: banner + mini form (Ekle/Geç paneli burada çıkar) -->
        <div id="hizliBilgiAlani" style="margin-bottom:6px;min-height:42px;overflow:visible">
          <div id="hizliBanner" style="display:none"></div>
          <div id="hizliMiniForm" style="display:none"></div>
        </div>

        <!-- sayac -->
        <div id="hizliSayac" style="
          font-size:12px;color:#666;margin-bottom:6px;
          text-align:center;font-weight:600;letter-spacing:0.2px;
        ">0 kayıt — 0 kaydedilecek</div>

        <!-- kuyruk -->
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
