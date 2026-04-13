// js/hizli_ekle.js — v55
// Bağımlılıklar: api.js (API_URL), utils.js (guvenliYazi, temizIsbn, getUserKey), camera.js (KutuphaneCamera)

(function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let kuyruk    = [];
  let bannerTmr = null;

  // ── Yardımcı ──────────────────────────────────────────────────────────────
  function _guvenli(v) {
    return typeof guvenliYazi === 'function'
      ? guvenliYazi(v)
      : String(v || '')
          .replace(/&/g,'&amp;').replace(/</g,'&lt;')
          .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _temizIsbn(v) {
    return typeof temizIsbn === 'function'
      ? temizIsbn(v)
      : String(v || '').toUpperCase().replace(/[^0-9X]/g,'').trim();
  }

  function _userKey() {
    return typeof getUserKey === 'function' ? getUserKey() : 'demo-user';
  }

  function _durumHesapla(data) {
    const adi  = (data.kitapAdi || '').trim();
    const yazar = (data.yazar   || '').trim();
    if (adi && yazar) return 'hazir';
    if (adi || yazar) return 'eksik';
    return 'bulunamadi';
  }

  function _zatenVarMi(sonuc) {
    if (!sonuc.ok) return false;
    const msg = String(sonuc.message || '').toLowerCase();
    return (
      msg.includes('zaten') || msg.includes('kayıtlı') ||
      msg.includes('kayitli') || msg.includes('mevcut') ||
      msg.includes('duplicate') || msg.includes('already')
    );
  }

  // ── Banner (okuma sonucu flaşı) ────────────────────────────────────────────
  function bannerGoster(durum, mesaj) {
    const el = document.getElementById('hizliBanner');
    if (!el) return;
    clearTimeout(bannerTmr);

    const MAP = {
      hazir:      { bg:'#d1fae5', color:'#065f46', emoji:'✅' },
      eksik:      { bg:'#fef9c3', color:'#854d0e', emoji:'⚠️' },
      bulunamadi: { bg:'#fee2e2', color:'#991b1b', emoji:'❌' },
      tekrar:     { bg:'#e0e7ff', color:'#3730a3', emoji:'🔁' },
      kayitli:    { bg:'#f3e8ff', color:'#6b21a8', emoji:'📌' },
    };
    const r = MAP[durum] || { bg:'#f3f4f6', color:'#374151', emoji:'ℹ️' };

    el.style.cssText = `
      display:block;background:${r.bg};color:${r.color};
      border-radius:14px;padding:14px 16px;font-size:18px;font-weight:bold;
      text-align:center;line-height:1.4;margin-bottom:10px;
      box-shadow:0 2px 8px rgba(0,0,0,0.08);word-break:break-word;
    `;
    el.innerHTML = `${r.emoji} ${_guvenli(mesaj)}`;
    bannerTmr = setTimeout(() => { if (el) el.style.display = 'none'; }, 2200);
  }

  // ── Kuyruk Render (kompakt) ────────────────────────────────────────────────
  function kuyrukRender() {
    const liste = document.getElementById('hizliKuyrukListe');
    const sayac = document.getElementById('hizliSayac');
    if (!liste) return;

    const kaydedilecek = kuyruk.filter(k => k.durum === 'hazir' && !k.zatenKayitli && !k.yeniKaydedildi).length;
    if (sayac) sayac.textContent = `${kuyruk.length} kayıt — ${kaydedilecek} kaydedilecek`;

    if (!kuyruk.length) {
      liste.innerHTML = '<div style="text-align:center;color:#aaa;padding:16px;font-size:13px">Henüz tarama yapılmadı</div>';
      return;
    }

    const BADGE = {
      hazir:      'background:#d1fae5;color:#065f46',
      eksik:      'background:#fef9c3;color:#854d0e',
      bulunamadi: 'background:#fee2e2;color:#991b1b',
    };

    // En son okunan en üstte (kuyruk.unshift ile eklendiği için sıra zaten doğru)
    liste.innerHTML = kuyruk.map((k, i) => {
      const bc     = BADGE[k.durum] || 'background:#e5e7eb;color:#374151';
      const etiket = k.durum === 'hazir' ? 'Hazır' : k.durum === 'eksik' ? 'Eksik' : 'Bulunamadı';

      const kayitliPill = k.yeniKaydedildi
        ? `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:bold;margin-left:5px">Kaydedildi</span>`
        : k.zatenKayitli
        ? `<span style="background:#f3e8ff;color:#6b21a8;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:bold;margin-left:5px">Sistemde Vardı</span>`
        : '';

      return `
        <div style="
          background:#fff;border-radius:10px;padding:8px 10px;
          box-shadow:0 1px 4px rgba(0,0,0,0.07);
          display:flex;align-items:center;gap:8px;
        ">
          <span style="${bc};padding:3px 8px;border-radius:999px;font-size:11px;font-weight:bold;white-space:nowrap;flex-shrink:0">
            ${etiket}
          </span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3">
              ${_guvenli(k.kitapAdi || '—')}${kayitliPill}
            </div>
            <div style="font-size:11px;color:#9ca3af;margin-top:1px;font-family:monospace,monospace">${_guvenli(k.isbn)}</div>
          </div>
          <button onclick="hizliEkleSil(${i})" style="
            border:none;background:transparent;color:#9ca3af;
            padding:2px 5px;font-size:14px;cursor:pointer;flex-shrink:0;line-height:1;
          " title="Çıkar">✕</button>
        </div>
      `;
    }).join('');
  }

  // ── ISBN İşle ─────────────────────────────────────────────────────────────
  async function isbnIslendi(isbn) {
    const temiz = _temizIsbn(isbn);
    if (!temiz) return;

    if (kuyruk.find(k => _temizIsbn(k.isbn) === temiz)) {
      bannerGoster('tekrar', `Zaten kuyrukta: ${temiz}`);
      return;
    }

    let kayit = {
      isbn: temiz,
      kitapAdi: '', yazar: '', yayinevi: '', yayinYili: '',
      durum: 'bulunamadi', mesaj: '', zatenKayitli: false, yeniKaydedildi: false
    };

    try {
      const sonuc = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'isbnLookup', isbn: temiz })
      }).then(r => r.json());

      if (sonuc.ok && sonuc.data) {
        const d = sonuc.data;
        kayit.kitapAdi     = d.kitapAdi   || '';
        kayit.yazar        = d.yazar      || '';
        kayit.yayinevi     = d.yayinevi   || '';
        kayit.yayinYili    = d.yayinYili  || '';
        kayit.zatenKayitli = !!(d.zatenKayitli);
        kayit.mesaj        = d.mesaj      || '';
      }
    } catch (err) {
      kayit.mesaj = 'Bağlantı hatası';
    }

    kayit.durum = _durumHesapla(kayit);
    kuyruk.unshift(kayit);
    kuyrukRender();

    if (kayit.zatenKayitli)          bannerGoster('kayitli',    `Sistemde kayıtlı: ${kayit.kitapAdi || temiz}`);
    else if (kayit.durum === 'hazir')    bannerGoster('hazir',      kayit.kitapAdi);
    else if (kayit.durum === 'eksik')    bannerGoster('eksik',      `Eksik bilgi: ${kayit.kitapAdi || temiz}`);
    else                                 bannerGoster('bulunamadi', `Bulunamadı: ${temiz}`);
  }

  // ── Kamera ────────────────────────────────────────────────────────────────
  async function hizliKameraBaslat() {
    if (!window.KutuphaneCamera) {
      bannerGoster('bulunamadi', 'Kamera modülü yüklenemedi');
      return;
    }
    try {
      await window.KutuphaneCamera.start({
        readerId:   'hizliReader',
        wrapId:     'hizliScannerWrap',
        adaptifMod: true,
        onAdaptif: () => {
          const wm = document.getElementById('hizliWatermark');
          if (!wm) return;
          wm.textContent   = 'Hassas mod aktif';
          wm.style.color   = 'rgba(255,255,255,0.75)';
          wm.style.fontWeight = 'bold';
          setTimeout(() => {
            if (!wm) return;
            wm.textContent      = 'Küçük barkodlar için 3 sn bekleyin';
            wm.style.color      = 'rgba(255,255,255,0.38)';
            wm.style.fontWeight = 'normal';
          }, 2500);
        },
        onDetected: async (isbn) => {
          await isbnIslendi(isbn);
        }
      });
    } catch (err) {
      bannerGoster('bulunamadi', 'Kamera açılamadı: ' + (err.message || err));
    }
  }

  async function hizliKameraKapat() {
    if (window.KutuphaneCamera) await window.KutuphaneCamera.stop();
    const wrap   = document.getElementById('hizliScannerWrap');
    const reader = document.getElementById('hizliReader');
    if (wrap)   wrap.style.display = 'none';
    if (reader) reader.innerHTML   = '';
  }

  // ── Toplu Kaydet ──────────────────────────────────────────────────────────
  async function hizliTopluKaydet() {
    const adaylar = kuyruk.filter(k => k.durum === 'hazir' && !k.zatenKayitli && !k.yeniKaydedildi);

    if (!adaylar.length) {
      bannerGoster('bulunamadi', 'Kaydedilecek uygun kayıt yok');
      return;
    }

    const btn = document.getElementById('hizliKaydetBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Kaydediliyor...'; }

    let basarili = 0, duplicate = 0, hatali = 0;

    for (const k of adaylar) {
      try {
        const sonuc = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'bookAdd', userKey: _userKey(),
            isbn: k.isbn, kitapAdi: k.kitapAdi, yazar: k.yazar,
            yayinevi: k.yayinevi, yayinYili: k.yayinYili, notText: ''
          })
        }).then(r => r.json());

        if (!sonuc.ok) {
          k.mesaj = sonuc.error || 'Kayıt hatası'; hatali++;
        } else if (_zatenVarMi(sonuc)) {
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

  window.hizliEkleForm = function () {
    const alan = document.getElementById('formAlani');
    if (!alan) return;
    kuyruk = [];

    alan.innerHTML = `
      <div style="
        background:#fff;border-radius:20px;padding:14px 14px 16px;
        box-shadow:0 6px 16px rgba(0,0,0,0.10);margin-top:14px;
      ">

        <!-- başlık -->
        <div style="font-size:18px;font-weight:bold;text-align:center;margin-bottom:10px;color:#333">
          ⚡ Hızlı Ekle
        </div>

        <!-- kamera alanı — üst 1/3, watermark overlay ile -->
        <div id="hizliScannerWrap" style="
          position:relative;display:none;border-radius:14px;
          overflow:hidden;background:#111;margin-bottom:8px;
        ">
          <div id="hizliReader" style="
            width:100%;min-height:160px;background:#000;
            touch-action:manipulation;
          "></div>
          <div id="hizliWatermark" style="
            position:absolute;bottom:8px;left:0;right:0;
            text-align:center;
            color:rgba(255,255,255,0.38);
            font-size:11px;letter-spacing:0.2px;
            pointer-events:none;padding:0 10px;
          ">Küçük barkodlar için 3 sn bekleyin</div>
        </div>

        <!-- kamera butonları (kompakt) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <button onclick="hizliKameraBaslat()" style="
            padding:11px 8px;font-size:15px;font-weight:bold;border:none;
            border-radius:12px;background:#0b57d0;color:#fff;cursor:pointer
          ">📷 Başlat</button>
          <button onclick="hizliKameraKapat()" style="
            padding:11px 8px;font-size:15px;font-weight:bold;border:none;
            border-radius:12px;background:#6b7280;color:#fff;cursor:pointer
          ">⏹ Kapat</button>
        </div>

        <!-- banner flaşı -->
        <div id="hizliBanner" style="display:none"></div>

        <!-- sayac -->
        <div id="hizliSayac" style="
          font-size:12px;color:#666;margin-bottom:8px;
          text-align:center;font-weight:600;letter-spacing:0.2px;
        ">0 kayıt — 0 kaydedilecek</div>

        <!-- kompakt liste -->
        <div id="hizliKuyrukListe" style="display:grid;gap:5px;margin-bottom:12px">
          <div style="text-align:center;color:#aaa;padding:16px;font-size:13px">
            Henüz tarama yapılmadı
          </div>
        </div>

        <!-- aksiyon butonları -->
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
    setTimeout(() => { alan.scrollIntoView({ behavior:'smooth', block:'start' }); }, 100);
  };

  window.hizliKameraBaslat = hizliKameraBaslat;
  window.hizliKameraKapat  = hizliKameraKapat;
  window.hizliTopluKaydet  = hizliTopluKaydet;

})();
