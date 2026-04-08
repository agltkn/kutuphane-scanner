function silTemizMesaj() {
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className = 'mesajKutusu';
  kutu.innerHTML = '';
}

function silMesajGoster(mesaj, tip = 'success') {
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className = 'mesajKutusu mesaj-' + tip;
  kutu.innerHTML = guvenliYazi(mesaj);
}

function silTemizIsbn(deger) {
  if (window.KutuphaneCamera && window.KutuphaneCamera.temizKod) {
    return window.KutuphaneCamera.temizKod(deger);
  }
  return String(deger || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
}

function silKitapKartHtml(kitap) {
  const durum = String(kitap.durum || 'RAFTA').toUpperCase();
  let badgeClass = 'rafta';
  if (durum === 'ÖDÜNÇTE') badgeClass = 'oduncte';
  if (durum === 'KAYIP') badgeClass = 'oduncte';

  return `
    <div class="kitapKart">
      <div class="kitapBaslik">${guvenliYazi(kitap.kitapAdi || '-')}</div>
      <div class="kitapSatir"><strong>Kitap Kodu:</strong> ${guvenliYazi(kitap.kitapKodu || '-')}</div>
      <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(kitap.yazar || '-')}</div>
      <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(kitap.isbn || '-')}</div>
      <div class="kitapSatir"><strong>Yayınevi:</strong> ${guvenliYazi(kitap.yayinevi || '-')}</div>
      <div class="kitapSatir"><strong>Yıl:</strong> ${guvenliYazi(kitap.yayinYili || '-')}</div>
      <div class="durumBadge ${badgeClass}">${guvenliYazi(durum)}</div>
    </div>
  `;
}

async function silApiPost(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

async function silTumKitaplariGetir() {
  const sonuc = await silApiPost({ action: 'booksList' });
  if (!sonuc.ok) {
    throw new Error(sonuc.error || 'Kitap listesi alınamadı');
  }
  return sonuc.data || [];
}

async function kameraKapatSil() {
  try {
    if (window.KutuphaneCamera) {
      await window.KutuphaneCamera.stop();
    }
    const wrap = document.getElementById('scannerWrap');
    const reader = document.getElementById('reader');
    if (wrap) wrap.style.display = 'none';
    if (reader) reader.innerHTML = '';
  } catch (err) {}
}

async function kamerayiBaslatSil() {
  silTemizMesaj();

  if (!window.KutuphaneCamera) {
    silMesajGoster('Kamera modülü yüklenemedi', 'error');
    return;
  }

  try {
    await window.KutuphaneCamera.start({
      readerId: 'reader',
      wrapId: 'scannerWrap',
      config: {
        fps: 5,
        qrbox: { width: 280, height: 90 },
        aspectRatio: 1.7778
      },
      onDetected: async (isbn) => {
        const isbnInput = document.getElementById('silIsbn');
        if (isbnInput) isbnInput.value = isbn;

        silMesajGoster('ISBN okundu: ' + isbn, 'success');
        await kameraKapatSil();
        await silKitapBul();
      }
    });
  } catch (err) {
    await kameraKapatSil();
    silMesajGoster('Kamera açılamadı: ' + (err.message || err), 'error');
  }
}

function silForm() {
  window.seciliSilKitap = null;

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

      .redBtn{ background:#b91c1c; }
      .orangeBtn{ background:#c2410c; }
      .blueBtn{ background:#0b57d0; }
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
        touch-action:manipulation;
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
      <div class="formTitle">🗑️ Kitap Sil</div>

      <div class="topActions">
        <button class="actionBtn blueBtn" onclick="kamerayiBaslatSil()">📷 Kamera ile ISBN Okut</button>
        <button class="actionBtn grayBtn" onclick="kameraKapatSil()">Kamerayı Kapat</button>
      </div>

      <div id="scannerWrap" class="scannerWrap">
        <div id="reader"></div>
        <div class="scanHelp">Barkodu kutuya ortalayın</div>
      </div>

      <label class="formLabel">ISBN</label>
      <input class="formInput" type="text" id="silIsbn" placeholder="ISBN yazın veya okutun">

      <button class="actionBtn secondaryBtn" onclick="silKitapBul()">Kitabı Bul</button>

      <div id="silKitapAlani"></div>

      <button class="actionBtn orangeBtn" onclick="kitapKayipYap()">Kayıp Olarak İşaretle</button>
      <button class="actionBtn redBtn" onclick="kitapSil()">Kitabı Sil</button>

      <div id="mesajKutusu" class="mesajKutusu"></div>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

async function silKitapBul(suppressStatusMessage = false) {
  silTemizMesaj();
  window.seciliSilKitap = null;

  const alan = document.getElementById('silKitapAlani');
  if (alan) alan.innerHTML = '';

  try {
    const isbn = silTemizIsbn(document.getElementById('silIsbn')?.value || '');
    if (!isbn) {
      silMesajGoster('Önce ISBN girin veya okutun', 'warn');
      return;
    }

    const kitaplar = await silTumKitaplariGetir();
    const kitap = kitaplar.find(k => silTemizIsbn(k.isbn || '') === isbn);

    if (!kitap) {
      silMesajGoster('Bu ISBN ile kayıtlı kitap bulunamadı', 'warn');
      return;
    }

    window.seciliSilKitap = kitap;

    if (alan) alan.innerHTML = silKitapKartHtml(kitap);

    if (suppressStatusMessage) {
      return;
    }

    if (String(kitap.durum || '').toUpperCase() === 'ÖDÜNÇTE') {
      silMesajGoster('Bu kitap ödünçte. Silmek yerine kayıp olarak işaretleyebilirsin.', 'warn');
    } else if (String(kitap.durum || '').toUpperCase() === 'KAYIP') {
      silMesajGoster('Bu kitap zaten kayıp olarak işaretlenmiş.', 'warn');
    } else {
      silMesajGoster('Kitap bulundu', 'success');
    }
  } catch (err) {
    silMesajGoster('Arama hatası: ' + err.message, 'error');
  }
}

async function kitapKayipYap() {
  silTemizMesaj();

  const kitap = window.seciliSilKitap;
  if (!kitap) {
    silMesajGoster('Önce kitabı bulun', 'warn');
    return;
  }

  if (String(kitap.durum || '').toUpperCase() === 'KAYIP') {
    silMesajGoster('Bu kitap zaten kayıp olarak işaretlenmiş', 'warn');
    return;
  }

  const onay = confirm(
    `${kitap.kitapAdi || 'Bu kitabı'} kayıp olarak işaretlemek istiyor musun?`
  );

  if (!onay) return;

  try {
    const sonuc = await silApiPost({
      action: 'markLost',
      id: kitap.id
    });

    if (!sonuc.ok) {
      silMesajGoster(sonuc.error || 'Kayıp işaretleme hatası', 'error');
      return;
    }

    await silKitapBul(true);
    silMesajGoster(sonuc.message || 'Kitap kayıp olarak işaretlendi', 'success');
  } catch (err) {
    silMesajGoster('Kayıp işaretleme hatası: ' + err.message, 'error');
  }
}

async function kitapSil() {
  silTemizMesaj();

  const kitap = window.seciliSilKitap;
  if (!kitap) {
    silMesajGoster('Önce kitabı bulun', 'warn');
    return;
  }

  if (String(kitap.durum || '').toUpperCase() === 'ÖDÜNÇTE') {
    silMesajGoster('Ödünçte olan kitap silinemez. Kayıp olarak işaretleyebilirsin.', 'error');
    return;
  }

  const onay = confirm(
    `${kitap.kitapAdi || 'Bu kitabı'} silmek istediğine emin misin?`
  );

  if (!onay) return;

  try {
    const sonuc = await silApiPost({
      action: 'deleteBook',
      id: kitap.id
    });

    if (!sonuc.ok) {
      silMesajGoster(sonuc.error || 'Silme hatası', 'error');
      return;
    }

    silMesajGoster(sonuc.message || 'Kitap silindi', 'success');

    document.getElementById('silIsbn').value = '';
    const alan = document.getElementById('silKitapAlani');
    if (alan) alan.innerHTML = '';
    window.seciliSilKitap = null;
  } catch (err) {
    silMesajGoster('Silme hatası: ' + err.message, 'error');
  }
}
