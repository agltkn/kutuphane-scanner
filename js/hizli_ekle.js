// js/hizli_ekle.js — v53
// Bağımlılıklar: api.js (API_URL), utils.js (guvenliYazi, temizIsbn, getUserKey), camera.js (KutuphaneCamera)

(function () {

  // ── State ──────────────────────────────────────────────────────────────────
  let kuyruk    = [];   // { isbn, kitapAdi, yazar, yayinevi, yayinYili, durum, mesaj, zatenKayitli }
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

  // "zaten var" tespiti: ok:true ama aslında duplicate
  function _zatenVarMi(sonuc) {
    if (!sonuc.ok) return false;
    const msg = String(sonuc.message || '').toLowerCase();
    return (
      msg.includes('zaten') ||
      msg.includes('kayıtlı') ||
      msg.includes('kayitli') ||
      msg.includes('mevcut') ||
      msg.includes('duplicate') ||
      msg.includes('already')
    );
  }

  // ── Banner ─────────────────────────────────────────────────────────────────
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
      display:block;
      background:${r.bg};
      color:${r.color};
      border-radius:18px;
      padding:22px 20px;
      font-size:26px;
      font-weight:bold;
      text-align:center;
      line-height:1.4;
      margin-bottom:14px;
      box-shadow:0 4px 14px rgba(0,0,0,0.10);
      word-break:break-word;
    `;
    el.innerHTML = `${r.emoji} ${_guvenli(mesaj)}`;

    bannerTmr = setTimeout(() => { if (el) el.style.display = 'none'; }, 2200);
  }

  // ── Kuyruk Render ──────────────────────────────────────────────────────────
  function kuyrukRender() {
    const liste  = document.getElementById('hizliKuyrukListe');
    const sayac  = document.getElementById('hizliSayac');
    if (!liste) return;

    const kaydedilecek = kuyruk.filter(k => k.durum === 'hazir' && !k.zatenKayitli).length;

    if (sayac) {
      sayac.textContent = `Kuyruk: ${kuyruk.length} kayıt — ${kaydedilecek} kaydedilecek`;
    }

    if (!kuyruk.length) {
      liste.innerHTML = '<div style="text-align:center;color:#888;padding:24px;font-size:16px">Henüz tarama yapılmadı</div>';
      return;
    }

    const BADGE = {
      hazir:      'background:#d1fae5;color:#065f46',
      eksik:      'background:#fef9c3;color:#854d0e',
      bulunamadi: 'background:#fee2e2;color:#991b1b',
    };

    liste.innerHTML = kuyruk.map((k, i) => {
      const bc    = BADGE[k.durum] || 'background:#e5e7eb;color:#374151';
      const etiket = k.durum === 'hazir' ? 'Hazır' : k.durum === 'eksik' ? 'Eksik' : 'Bulunamadı';

      const kayitliPill = k.yeniKaydedildi
        ? `<span style="background:#d1fae5;color:#065f46;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:bold;margin-left:6px">Kaydedildi</span>`
        : k.zatenKayitli
        ? `<span style="background:#f3e8ff;color:#6b21a8;padding:4px 10px;border-radius:999px;font-size:13px;font-weight:bold;margin-left:6px">Sistemde Vardı</span>`
        : '';

      return `
        <div style="
          background:#fff;border-radius:14px;padding:14px 16px;
          box-shadow:0 2px 8px rgba(0,0,0,0.07);
          display:flex;align-items:flex-start;gap:12px;
        ">
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:bold;word-break:break-word;margin-bottom:4px">
              ${_guvenli(k.kitapAdi || '—')}${kayitliPill}
            </div>
            <div style="font-size:14px;color:#555;margin-bottom:2px">${_guvenli(k.yazar || '—')}</div>
            <div style="font-size:13px;color:#888">${_guvenli(k.isbn)}</div>
            ${k.mesaj ? `<div style="font-size:13px;color:#999;margin-top:2px">${_guvenli(k.mesaj)}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:80px">
            <span style="${bc};padding:5px 10px;border-radius:999px;font-size:13px;font-weight:bold;white-space:nowrap">
              ${etiket}
            </span>
            <button onclick="hizliEkleSil(${i})" style="
              border:none;background:#f3f4f6;color:#6b7280;
              border-radius:8px;padding:5px 10px;font-size:13px;cursor:pointer
            ">Çıkar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── ISBN İşle ─────────────────────────────────────────────────────────────
  async function isbnIslendi(isbn) {
    const temiz = _temizIsbn(isbn);
    if (!temiz) return;

    // Kuyrukta tekrar kontrolü
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
        kayit.kitapAdi    = d.kitapAdi   || '';
        kayit.yazar       = d.yazar      || '';
        kayit.yayinevi    = d.yayinevi   || '';
        kayit.yayinYili   = d.yayinYili  || '';
        kayit.zatenKayitli = !!(d.zatenKayitli);
        kayit.mesaj       = d.mesaj      || '';
      }
    } catch (err) {
      kayit.mesaj = 'Bağlantı hatası';
    }

    kayit.durum = _durumHesapla(kayit);
    kuyruk.unshift(kayit);
    kuyrukRender();

    if (kayit.zatenKayitli) {
      bannerGoster('kayitli', `Sistemde kayıtlı: ${kayit.kitapAdi || temiz}`);
    } else if (kayit.durum === 'hazir') {
      bannerGoster('hazir', kayit.kitapAdi);
    } else if (kayit.durum === 'eksik') {
      bannerGoster('eksik', `Eksik bilgi: ${kayit.kitapAdi || temiz}`);
    } else {
      bannerGoster('bulunamadi', `Bulunamadı: ${temiz}`);
    }
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
          const hint = document.getElementById('hizliScanHint');
          if (hint) hint.textContent = '🔍 Küçük barkod modu aktif — barkodu yaklaştırın';
        },
        onDetected: async (isbn) => {
          await isbnIslendi(isbn);
          // stop çağrılmaz — kamera akışı devam eder
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
    if (reader) reader.innerHTML = '';
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

    let basarili = 0;
    let duplicate = 0;
    let hatali   = 0;

    for (const k of adaylar) {
      try {
        const sonuc = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:    'bookAdd',
            userKey:   _userKey(),
            isbn:      k.isbn,
            kitapAdi:  k.kitapAdi,
            yazar:     k.yazar,
            yayinevi:  k.yayinevi,
            yayinYili: k.yayinYili,
            notText:   ''
          })
        }).then(r => r.json());

        if (!sonuc.ok) {
          // Worker açıkça hata döndü
          k.mesaj = sonuc.error || 'Kayıt hatası';
          hatali++;
        } else if (_zatenVarMi(sonuc)) {
          // ok:true ama aslında duplicate / zaten var
          k.zatenKayitli = true;
          k.mesaj = sonuc.message || 'Sistemde zaten mevcut';
          duplicate++;
        } else {
          // Gerçek başarı — bu oturumda yeni kaydedildi
          k.yeniKaydedildi = true;
          k.mesaj = '';
          basarili++;
        }
      } catch (err) {
        k.mesaj = 'Bağlantı hatası';
        hatali++;
      }
    }

    kuyrukRender();
    if (btn) { btn.disabled = false; btn.textContent = '💾 Toplu Kaydet'; }

    // Banner özeti
    const parcalar = [];
    if (basarili)  parcalar.push(`${basarili} eklendi`);
    if (duplicate) parcalar.push(`${duplicate} zaten vardı`);
    if (hatali)    parcalar.push(`${hatali} hata`);

    const ozet = parcalar.join(', ');
    const tip   = hatali > 0 ? 'eksik' : (duplicate > 0 && basarili === 0) ? 'kayitli' : 'hazir';
    bannerGoster(tip, ozet);
  }

  // ── Global Fonksiyonlar ────────────────────────────────────────────────────
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
        background:#fff;border-radius:22px;padding:20px;
        box-shadow:0 6px 16px rgba(0,0,0,0.10);margin-top:18px;
      ">
        <div style="font-size:28px;font-weight:bold;text-align:center;margin-bottom:18px;color:#222">
          ⚡ Hızlı Ekle
        </div>

        <div id="hizliBanner" style="display:none"></div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <button onclick="hizliKameraBaslat()" style="
            padding:18px;font-size:20px;font-weight:bold;border:none;
            border-radius:14px;background:#0b57d0;color:#fff;cursor:pointer
          ">📷 Kamerayı Başlat</button>
          <button onclick="hizliKameraKapat()" style="
            padding:18px;font-size:20px;font-weight:bold;border:none;
            border-radius:14px;background:#6b7280;color:#fff;cursor:pointer
          ">Kamerayı Kapat</button>
        </div>

        <div id="hizliScannerWrap" style="
          display:none;margin-bottom:14px;border-radius:18px;
          overflow:hidden;background:#111;padding:10px;
        ">
          <div id="hizliReader" style="
            width:100%;min-height:240px;border-radius:12px;
            overflow:hidden;background:#000;touch-action:manipulation;
          "></div>
          <div id="hizliScanHint" style="
            margin-top:10px;color:#fff;background:rgba(255,255,255,0.08);
            padding:10px 12px;border-radius:12px;font-size:14px;line-height:1.5;
          ">Barkodu kutuya ortalayın. Her okuma sonrası kamera devam eder.</div>
        </div>

        <div id="hizliSayac" style="
          font-size:15px;color:#555;margin-bottom:10px;
          text-align:center;font-weight:bold;
        ">Kuyruk: 0 kayıt — 0 kaydedilecek</div>

        <div id="hizliKuyrukListe" style="display:grid;gap:10px;margin-bottom:14px">
          <div style="text-align:center;color:#888;padding:24px;font-size:16px">Henüz tarama yapılmadı</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button id="hizliKaydetBtn" onclick="hizliTopluKaydet()" style="
            padding:18px;font-size:20px;font-weight:bold;border:none;
            border-radius:14px;background:#047857;color:#fff;cursor:pointer
          ">💾 Toplu Kaydet</button>
          <button onclick="hizliKuyrukTemizle()" style="
            padding:18px;font-size:20px;font-weight:bold;border:none;
            border-radius:14px;background:#b91c1c;color:#fff;cursor:pointer
          ">🗑️ Kuyruğu Temizle</button>
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
