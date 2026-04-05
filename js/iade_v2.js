function iadeTemizMesaj() {
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className = 'mesajKutusu';
  kutu.innerHTML = '';
}

function iadeMesajGoster(mesaj, tip = 'success') {
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className = 'mesajKutusu mesaj-' + tip;
  kutu.innerHTML = guvenliYazi(mesaj);
}

function iadeKitapKartHtml(kitap) {
  const durum = String(kitap.durum || 'RAFTA').toUpperCase();
  const badgeClass = durum === 'ÖDÜNÇTE' ? 'oduncte' : 'rafta';

  return `
    <div class="kitapKart">
      <div class="kitapBaslik">${guvenliYazi(kitap.kitapAdi || '-')}</div>
      <div class="kitapSatir"><strong>Kitap Kodu:</strong> ${guvenliYazi(kitap.kitapKodu || '-')}</div>
      <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(kitap.yazar || '-')}</div>
      <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(kitap.isbn || '-')}</div>
      <div class="kitapSatir"><strong>Yayınevi:</strong> ${guvenliYazi(kitap.yayinevi || '-')}</div>
      <div class="kitapSatir"><strong>Yıl:</strong> ${guvenliYazi(kitap.yayinYili || '-')}</div>
      <div class="kitapSatir"><strong>Ödünç Alan:</strong> ${guvenliYazi(kitap.oduncAlan || '-')}</div>
      <div class="kitapSatir"><strong>Ödünç Tarihi:</strong> ${guvenliYazi(kitap.oduncTarihi || '-')}</div>
      <div class="kitapSatir"><strong>İade Tarihi:</strong> ${guvenliYazi(kitap.iadeTarihi || '-')}</div>
      <div class="durumBadge ${badgeClass}">${guvenliYazi(durum)}</div>
    </div>
  `;
}

async function iadeApiPost(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

async function iadeTumKitaplariGetir() {
  const sonuc = await iadeApiPost({ action: 'booksList' });
  if (!sonuc.ok) {
    throw new Error(sonuc.error || 'Kitap listesi alınamadı');
  }
  return sonuc.data || [];
}

async function kameraKapatIade() {
  try {
    if (window.qrReader) {
      try { await window.qrReader.stop(); } catch (e) {}
      try { await window.qrReader.clear(); } catch (e) {}
      window.qrReader = null;
    }

    const wrap = document.getElementById('scannerWrap');
    const reader = document.getElementById('reader');

    if (wrap) wrap.style.display = 'none';
    if (reader) reader.innerHTML = '';
    window.sonOkunanKod = '';
  } catch (err) {}
}

async function kamerayiBaslatIade() {
  iadeTemizMesaj();
  await kameraKapatIade();

  if (typeof Html5Qrcode === 'undefined') {
    iadeMesajGoster('Kamera modülü yüklenemedi', 'error');
    return;
  }

  const wrap = document.getElementById('scannerWrap');
  const reader = document.getElementById('reader');

  if (!wrap || !reader) {
    iadeMesajGoster('Kamera alanı bulunamadı', 'error');
    return;
  }

  try {
    wrap.style.display = 'block';
    reader.innerHTML = '';
    window.qrReader = new Html5Qrcode('reader');
    window.sonOkunanKod = '';

    await window.qrReader.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 120 }
      },
      async (decodedText) => {
        const isbn = temizIsbn(decodedText);
        if (!isbn) return;
        if (isbn === window.sonOkunanKod) return;

        window.sonOkunanKod = isbn;

        const isbnInput = document.getElementById('iadeIsbn');
        if (isbnInput) isbnInput.value = isbn;

        iadeMesajGoster('ISBN okundu: ' + isbn, 'success');
        await kameraKapatIade();
        await iadeKitapBul();
      }
    );
  } catch (err) {
    await kameraKapatIade();
    iadeMesajGoster('Kamera açılamadı: ' + (err.message || err), 'error');
  }
}

function iadeForm() {
  window.seciliIadeKitap = null;

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

      .formInput{
        width:100%;
        padding:16px;
        font-size:16px;
        border:1px solid #ccc;
        border-radius:14px;
        background:white;
      }

      .scannerWrap{
        display:none;
        margin-top:16px;
        border-radius:18px;
        overflow:hidden;
        background:#111;
        padding:10px;
      }

      #reader{
        width:100%;
        min-height:260px;
        border-radius:12px;
        overflow:hidden;
        background:#000;
      }

      .scanHelp{
        margin-top:10px;
        color:#fff;
        background:rgba(255,255,255,0.08);
        padding:10px 12px;
        border-radius:12px;
        font-size:14px;
        line-height:1.4;
      }

      .kitapKart{
        margin-top:18px;
        background:#fff7ed;
        border:2px solid #fdba74;
        border-radius:16px;
        padding:18px;
        overflow:hidden;
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

      .durumBadge{
        display:inline-block;
        padding:8px 14px;
        border-radius:999px;
        font-size:15px;
        font-weight:bold;
        margin-top:8px;
      }

      .rafta{
        background:#d1fae5;
        color:#065f46;
      }

      .oduncte{
        background:#fee2e2;
        color:#991b1b;
      }

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
      }
    </style>

    <div class="formCard">
      <div class="formTitle">📥 İade Al</div>

      <div class="topActions">
        <button class="actionBtn blueBtn" onclick="kamerayiBaslatIade()">📷 Kamera ile ISBN Okut</button>
        <button class="actionBtn grayBtn" onclick="kameraKapatIade()">Kamerayı Kapat</button>
      </div>

      <div id="scannerWrap" class="scannerWrap">
        <div id="reader"></div>
        <div class="scanHelp">Barkodu kutuya ortalayın</div>
      </div>

      <label class="formLabel">ISBN</label>
      <input class="formInput" type="text" id="iadeIsbn" placeholder="ISBN yazın veya okutun">

      <button class="actionBtn secondaryBtn" onclick="iadeKitapBul()">Kitabı Bul</button>

      <div id="iadeKitapAlani"></div>

      <button class="actionBtn greenBtn" onclick="iadeAl()">İade Al</button>

      <div id="mesajKutusu" class="mesajKutusu"></div>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function iadeKitapBul(suppressStatusMessage = false) {
  iadeTemizMesaj();
  window.seciliIadeKitap = null;

  const alan = document.getElementById('iadeKitapAlani');
  if (alan) alan.innerHTML = '';

  try {
    const isbn = temizIsbn(document.getElementById('iadeIsbn')?.value || '');
    if (!isbn) {
      iadeMesajGoster('Önce ISBN girin veya okutun', 'warn');
      return;
    }

    const kitaplar = await iadeTumKitaplariGetir();
    const kitap = kitaplar.find(k => temizIsbn(k.isbn || '') === isbn);

    if (!kitap) {
      iadeMesajGoster('Bu ISBN ile kayıtlı kitap bulunamadı', 'warn');
      return;
    }

    window.seciliIadeKitap = kitap;

    if (alan) alan.innerHTML = iadeKitapKartHtml(kitap);

    if (suppressStatusMessage) return;

    if (String(kitap.durum || '').toUpperCase() !== 'ÖDÜNÇTE') {
      iadeMesajGoster('Bu kitap zaten rafta', 'warn');
    } else {
      iadeMesajGoster('Kitap bulundu', 'success');
    }
  } catch (err) {
    iadeMesajGoster('Arama hatası: ' + err.message, 'error');
  }
}

async function iadeAl() {
  iadeTemizMesaj();

  const kitap = window.seciliIadeKitap;
  if (!kitap) {
    iadeMesajGoster('Önce kitabı bulun', 'warn');
    return;
  }

  if (String(kitap.durum || '').toUpperCase() !== 'ÖDÜNÇTE') {
    iadeMesajGoster('Bu kitap zaten rafta', 'warn');
    return;
  }

  try {
    const sonuc = await iadeApiPost({
      action: 'returnBook',
      id: kitap.id
    });

    if (!sonuc.ok) {
      iadeMesajGoster(sonuc.error || 'İade alma hatası', 'error');
      return;
    }

    await iadeKitapBul(true);
    iadeMesajGoster(sonuc.message || 'Kitap iade alındı', 'success');
  } catch (err) {
    iadeMesajGoster('İade alma hatası: ' + err.message, 'error');
  }
}
