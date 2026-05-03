// js/ekle.js — v69
// v68: Dinamik kopya numarası
//   - worker.js isbnLookup ve bookAdd artık mevcutSayisi döndürüyor
//   - "Ekle (2. kopya)" metni artık dinamik: mevcut kopya sayısı + 1
//   - _ekleGecPaneliGoster(aciklama, kopySayisi) — 2. param isteğe bağlı
//   - isbnBilgisiGetir: data.mevcutSayisi varsa kopySayisi hesaplanır
//   - kitapEkle(false): sonuc.mevcutSayisi varsa kopySayisi hesaplanır
// v67: bookAddForce — ikinci kopya için ayrı action
// v66: forceAdd diagnostic
// v65: forceAdd=true: duplicate/zaten kontrolleri atlanır

// ── Kamera ────────────────────────────────────────────────────────────────
async function kamerayiBaslatEkle() {
  if (!window.KutuphaneCamera) {
    mesajGoster('Kamera modülü yüklenemedi', 'error');
    return;
  }
  try {
    await window.KutuphaneCamera.start({
      readerId:   'reader',
      wrapId:     'scannerWrap',
      adaptifMod: true,
      onAdaptif: () => {
        const hint = document.getElementById('ekleHint');
        if (hint) hint.textContent = '🔍 Hassas mod aktif — barkodu yaklaştırın';
      },
      onDetected: async (isbn) => {
        // v69: barkod okunduğunda kamera kapanır, sonra form doldurulur
        await kameraKapat();
        const el = document.getElementById('isbn');
        if (el) el.value = isbn;
        await isbnBilgisiGetir();
      }
    });
  } catch (err) {
    mesajGoster('Kamera açılamadı: ' + (err.message || err), 'error');
  }
}

async function kameraKapat() {
  if (window.KutuphaneCamera) await window.KutuphaneCamera.stop();
  const wrap   = document.getElementById('scannerWrap');
  const reader = document.getElementById('reader');
  if (wrap)   wrap.style.display = 'none';
  if (reader) reader.innerHTML   = '';
}

// ── Form ──────────────────────────────────────────────────────────────────
function ekleForm() {
  const alan = document.getElementById('formAlani');
  if (!alan) return;

  alan.innerHTML = `
    <style>
      .formCard{
        background:#fff;
        border-radius:22px;
        padding:20px;
        box-shadow:0 6px 16px rgba(0,0,0,0.10);
      }

      .formTitle{
        font-size:28px;
        font-weight:bold;
        text-align:center;
        margin-bottom:18px;
        color:#222;
      }

      .topActions{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:10px;
      }

      .actionBtn{
        width:100%;
        padding:18px;
        margin-top:18px;
        font-size:22px;
        border:none;
        border-radius:14px;
        background:#111;
        color:white;
        font-weight:bold;
        cursor:pointer;
      }

      .blueBtn{ background:#0b57d0; }
      .greenBtn{ background:#047857; }
      .grayBtn{ background:#6b7280; }
      .secondaryBtn{ background:#444; }

      .formLabel{
        display:block;
        font-size:18px;
        font-weight:bold;
        margin:16px 0 8px 0;
        color:#333;
      }

      .formInput, .formTextarea{
        width:100%;
        padding:16px;
        font-size:16px;
        border:1px solid #ccc;
        border-radius:14px;
        background:white;
      }

      .formTextarea{
        min-height:120px;
        resize:vertical;
      }

      .scannerWrap{
        display:none;
        margin-top:12px;
        border-radius:18px;
        overflow:hidden;
        background:#111;
      }

      #reader{
        display:block;
        width:100%;
        height:240px;
        max-width:420px;
        margin:0 auto;
        border-radius:16px;
        overflow:hidden;
        background:#000;
        touch-action:manipulation;
      }

      .scanHelp{
        margin-top:10px;
        color:#fff;
        background:rgba(255,255,255,0.08);
        padding:10px 12px;
        border-radius:12px;
        font-size:14px;
        line-height:1.5;
      }

      .kitapKart{
        margin-top:18px;
        background:#fff7ed;
        border:2px solid #fdba74;
        border-radius:16px;
        padding:18px;
        overflow:hidden;
      }

      .kitapKartUst{
        display:flex;
        gap:14px;
        align-items:flex-start;
      }

      .kapakWrap{
        width:96px;
        min-width:96px;
        max-width:96px;
      }

      .kapakImg{
        width:96px;
        height:140px;
        object-fit:cover;
        border-radius:10px;
        border:1px solid #e5e7eb;
        background:#fff;
        display:block;
      }

      .kitapBilgi{
        flex:1;
        min-width:0;
      }

      .kitapBaslik{
        font-size:24px;
        font-weight:bold;
        color:#222;
        margin-bottom:10px;
        word-break:break-word;
      }

      .kitapSatir{
        font-size:17px;
        color:#444;
        margin:6px 0;
        line-height:1.4;
        word-break:break-word;
      }

      /* mesajKutusu — Kaydet butonunun ÜSTÜNDE, scroll gerekmez */
      .mesajKutusu{
        display:none;
        margin-top:18px;
        padding:16px 18px;
        border-radius:14px;
        font-size:18px;
        font-weight:bold;
        line-height:1.5;
        word-break:break-word;
      }

      .mesaj-success{
        display:block;
        background:#d1fae5;
        color:#065f46;
      }

      .mesaj-error{
        display:block;
        background:#fee2e2;
        color:#991b1b;
      }

      .mesaj-warn{
        display:block;
        background:#ffedd5;
        color:#9a3412;
      }

      @media (max-width:640px){
        .topActions{
          grid-template-columns:1fr;
        }

        .kitapKartUst{
          flex-direction:column;
        }

        .kapakWrap{
          width:100%;
          min-width:0;
          max-width:none;
        }

        .kapakImg{
          width:110px;
          height:160px;
        }
      }
    </style>

    <div class="formCard">
      <div class="formTitle">➕ Kitap Ekle</div>

      <div class="topActions">
        <button class="actionBtn blueBtn" onclick="kamerayiBaslatEkle()">📷 Kamera ile ISBN Okut</button>
        <button class="actionBtn grayBtn" onclick="kameraKapat()">Kamerayı Kapat</button>
      </div>

      <div id="scannerWrap" class="scannerWrap">
        <div id="reader"></div>
        <div id="ekleHint" class="scanHelp">
          Barkodu kutuya ortalayın. Küçük barkodlar için 3 sn bekleyin, hassas mod otomatik açılır.<br>
          Okunmazsa barkod altındaki 13 haneli ISBN'yi elle girin.
        </div>
      </div>

      <label class="formLabel">ISBN</label>
      <input class="formInput" type="text" id="isbn" placeholder="ISBN yazın veya okutun">

      <button class="actionBtn secondaryBtn" onclick="isbnBilgisiGetir()">ISBN'den Doldur</button>

      <!-- Kitap önizleme + duplicate seçenek paneli buraya eklenir -->
      <div id="ekleKitapAlani"></div>

      <!-- mesajKutusu ISBN bölümünün hemen altında — scroll gerekmez -->
      <div id="mesajKutusu" class="mesajKutusu"></div>

      <label class="formLabel">Kitap Adı</label>
      <input class="formInput" type="text" id="kitapAdi" placeholder="Kitap adı">

      <label class="formLabel">Yazar</label>
      <input class="formInput" type="text" id="yazar" placeholder="Yazar">

      <label class="formLabel">Yayınevi</label>
      <input class="formInput" type="text" id="yayinevi" placeholder="Yayınevi">

      <label class="formLabel">Yayın Yılı</label>
      <input class="formInput" type="text" id="yayinYili" placeholder="Örn: 2024">

      <label class="formLabel">Not</label>
      <textarea class="formTextarea" id="notText" placeholder="İsteğe bağlı not"></textarea>

      <button class="actionBtn greenBtn" id="kaydetBtn" onclick="kitapEkle(false)">Kaydet</button>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ── Formu Temizle (Geç aksiyonu) ─────────────────────────────────────────
function formuTemizle() {
  ['isbn', 'kitapAdi', 'yazar', 'yayinevi', 'yayinYili', 'notText'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const kartAlani = document.getElementById('ekleKitapAlani');
  if (kartAlani) kartAlani.innerHTML = '';
  temizMesaj();
}

// ── Duplicate seçenek paneli ──────────────────────────────────────────────
// Hem isbnBilgisiGetir() hem kitapEkle() bu paneli kullanabilir.
// kopySayisi: sistemdeki mevcut kopya sayısı + 1 (eklenen kopya sırası)
function _ekleGecPaneliGoster(aciklama, kopySayisi) {
  const no = Math.max(2, Number(kopySayisi) || 2);
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className   = 'mesajKutusu mesaj-warn';
  kutu.style.display = 'block';
  kutu.innerHTML   =
    `<div style="margin-bottom:12px">${guvenliYazi(aciklama)}</div>` +
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">` +
      `<button onclick="kitapEkle(true)" style="` +
        `padding:13px;font-size:15px;font-weight:bold;` +
        `border:none;border-radius:10px;` +
        `background:#0b57d0;color:#fff;cursor:pointer;` +
      `">📥 Ekle (${no}. kopya)</button>` +
      `<button onclick="formuTemizle()" style="` +
        `padding:13px;font-size:15px;font-weight:bold;` +
        `border:none;border-radius:10px;` +
        `background:#6b7280;color:#fff;cursor:pointer;` +
      `">✕ Geç</button>` +
    `</div>`;
  kutu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── ISBN Lookup ───────────────────────────────────────────────────────────
async function isbnBilgisiGetir() {
  temizMesaj();

  const isbnInput = document.getElementById('isbn');
  if (!isbnInput) return;

  const isbn = temizIsbn(isbnInput.value);

  if (!isbn) {
    mesajGoster('Önce ISBN girin veya okutun', 'warn');
    return;
  }

  try {
    const sonuc = await apiPost({ action: 'isbnLookup', isbn });

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Sorgu hatası', 'error');
      return;
    }

    const data      = sonuc.data || {};
    const kartAlani = document.getElementById('ekleKitapAlani');
    if (kartAlani) kartAlani.innerHTML = '';

    if (!data.bulundu) {
      mesajGoster(data.mesaj || 'Kitap bilgisi bulunamadı', 'warn');
      return;
    }

    const _bh = typeof basHarfBuyut === 'function' ? basHarfBuyut : function(s){ return s; };

    // Form alanlarını doldur
    document.getElementById('isbn').value      = data.isbn      || '';
    document.getElementById('kitapAdi').value  = _bh(data.kitapAdi  || '');
    document.getElementById('yazar').value     = _bh(data.yazar     || '');
    document.getElementById('yayinevi').value  = data.yayinevi  || '';
    document.getElementById('yayinYili').value = data.yayinYili || '';

    // Kitap önizleme kartı
    if (kartAlani) {
      const kapakHtmlStr = data.kapakUrl
        ? `<div class="kapakWrap">
            <img class="kapakImg"
              src="${String(data.kapakUrl).replace(/"/g, '&quot;')}"
              alt="Kitap kapağı"
              referrerpolicy="no-referrer"
              loading="lazy">
          </div>`
        : '';

      // v68: kopySayisi dinamik — worker mevcutSayisi döndürüyor
      let dupBolumu = '';
      if (data.zatenKayitli) {
        // mevcutSayisi: sistemdeki toplam kopya sayısı
        // kopySayisi: eklenecek kopyanın sırası = mevcutSayisi + 1
        const kopySayisi = (Number(data.mevcutSayisi) || 1) + 1;
        dupBolumu = `
          <div style="
            margin-top:14px;padding-top:14px;
            border-top:2px solid #fdba74;
          ">
            <div style="
              font-size:15px;font-weight:bold;color:#92400e;margin-bottom:10px;
            ">⚠️ Bu ISBN sistemde zaten kayıtlı (${data.mevcutSayisi || 1} kopya). Ne yapmak istiyorsunuz?</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <button onclick="kitapEkle(true)" style="
                padding:13px;font-size:15px;font-weight:bold;
                border:none;border-radius:10px;
                background:#0b57d0;color:#fff;cursor:pointer;
              ">📥 Ekle (${kopySayisi}. kopya)</button>
              <button onclick="formuTemizle()" style="
                padding:13px;font-size:15px;font-weight:bold;
                border:none;border-radius:10px;
                background:#6b7280;color:#fff;cursor:pointer;
              ">✕ Geç</button>
            </div>
          </div>`;
      }

      kartAlani.innerHTML = `
        <div class="kitapKart">
          <div class="kitapKartUst">
            ${kapakHtmlStr}
            <div class="kitapBilgi">
              <div class="kitapBaslik">${guvenliYazi(data.kitapAdi || '-')}</div>
              <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(data.yazar || '-')}</div>
              <div class="kitapSatir"><strong>Yayınevi:</strong> ${guvenliYazi(data.yayinevi || '-')}</div>
              <div class="kitapSatir"><strong>Yıl:</strong> ${guvenliYazi(data.yayinYili || '-')}</div>
              <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(data.isbn || '-')}</div>
            </div>
          </div>
          ${dupBolumu}
        </div>
      `;

      kartAlani.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Duplicate ise panel yeterli — ayrı hata mesajı gösterme
    if (!data.zatenKayitli) {
      mesajGoster('Kitap bilgisi dolduruldu', 'success');
    }
  } catch (err) {
    mesajGoster('Sorgu hatası: ' + err.message, 'error');
  }
}

// ── Kaydet ────────────────────────────────────────────────────────────────
async function kitapEkle(forceAdd) {
  temizMesaj();

  const _bh = typeof basHarfBuyut === 'function' ? basHarfBuyut : function(s){ return s; };

  const kitapAdi  = _bh((document.getElementById('kitapAdi')?.value  || '').trim());
  const yazar     = _bh((document.getElementById('yazar')?.value     || '').trim());

  if (!kitapAdi || !yazar) {
    mesajGoster('Kitap adı ve yazar zorunlu', 'warn');
    return;
  }

  // v67: forceAdd=true → bookAddForce (ISBN duplicate kontrolü olmayan ayrı action)
  //      forceAdd=false → bookAdd (normal akış, duplicate kontrolü var)
  const payload = {
    action:    forceAdd ? 'bookAddForce' : 'bookAdd',
    userKey:   getUserKey(),
    isbn:      temizIsbn(document.getElementById('isbn')?.value      || ''),
    kitapAdi,
    yazar,
    yayinevi:  (document.getElementById('yayinevi')?.value  || '').trim(),
    yayinYili: (document.getElementById('yayinYili')?.value || '').trim(),
    notText:   (document.getElementById('notText')?.value   || '').trim()
  };
  // NOT: forceAdd flag payload'a EKLENMİYOR — action adı yeterli

  try {
    const sonuc = await apiPost(payload);

    if (!sonuc.ok) {
      // v67: "Bilinmeyen action" → worker eski deploy, bookAddForce tanımıyor
      if (forceAdd && (sonuc.error || '').includes('Bilinmeyen')) {
        mesajGoster(
          '⚠️ Worker güncel değil: worker.js\'i Cloudflare\'e deploy edin.',
          'error'
        );
      } else {
        mesajGoster(sonuc.error || 'Kayıt hatası', 'error');
      }
      return;
    }

    // Normal bookAdd → duplicate kontrolü
    // v68: sonuc.mevcutSayisi varsa dinamik kopya numarası gösterilir
    if (!forceAdd && sonuc.duplicate) {
      const kopySayisi = (Number(sonuc.mevcutSayisi) || 1) + 1;
      _ekleGecPaneliGoster(
        'Bu ISBN ile kayıtlı bir kitap zaten var. İkinci kopya olarak eklemek ister misiniz?',
        kopySayisi
      );
      return;
    }

    const mesaj = String(sonuc.message || '');

    if (!forceAdd && mesaj.toLowerCase().includes('zaten')) {
      mesajGoster(mesaj, 'error');
      return;
    }

    mesajGoster(mesaj || 'Kitap kaydedildi', 'success');

    // Formu temizle
    ['isbn', 'kitapAdi', 'yazar', 'yayinevi', 'yayinYili', 'notText'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const kartAlani = document.getElementById('ekleKitapAlani');
    if (kartAlani) kartAlani.innerHTML = '';
  } catch (err) {
    mesajGoster('Kayıt hatası: ' + err.message, 'error');
  }
}
