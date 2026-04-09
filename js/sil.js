async function kamerayiBaslatSil() {
  await kameraBaslat({
    inputId: 'silIsbn',
    successMessage: 'ISBN okundu: ',
    onDetected: silKitapBul
  });
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
        <button class="actionBtn grayBtn" onclick="kameraKapat()">Kamerayı Kapat</button>
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
  temizMesaj();
  window.seciliSilKitap = null;

  const alan = document.getElementById('silKitapAlani');
  if (alan) alan.innerHTML = '';

  try {
    const isbn = temizIsbn(document.getElementById('silIsbn')?.value || '');
    if (!isbn) {
      mesajGoster('Önce ISBN girin veya okutun', 'warn');
      return;
    }

    const kitaplar = await tumKitaplariGetir();
    const kitap = kitaplar.find(k => temizIsbn(k.isbn || '') === isbn);

    if (!kitap) {
      mesajGoster('Bu ISBN ile kayıtlı kitap bulunamadı', 'warn');
      return;
    }

    window.seciliSilKitap = kitap;

    if (alan) {
      alan.innerHTML = kitapKartHtml(kitap);
    }

    if (suppressStatusMessage) return;

    if (String(kitap.durum || '').toUpperCase() === 'ÖDÜNÇTE') {
      mesajGoster('Bu kitap ödünçte. Silmek yerine kayıp olarak işaretleyebilirsin.', 'warn');
    } else if (String(kitap.durum || '').toUpperCase() === 'KAYIP') {
      mesajGoster('Bu kitap zaten kayıp olarak işaretlenmiş.', 'warn');
    } else {
      mesajGoster('Kitap bulundu', 'success');
    }
  } catch (err) {
    mesajGoster('Arama hatası: ' + err.message, 'error');
  }
}

async function kitapKayipYap() {
  temizMesaj();

  const kitap = window.seciliSilKitap;
  if (!kitap) {
    mesajGoster('Önce kitabı bulun', 'warn');
    return;
  }

  if (String(kitap.durum || '').toUpperCase() === 'KAYIP') {
    mesajGoster('Bu kitap zaten kayıp olarak işaretlenmiş', 'warn');
    return;
  }

  const onay = confirm(
    `${kitap.kitapAdi || 'Bu kitabı'} kayıp olarak işaretlemek istiyor musun?`
  );

  if (!onay) return;

  try {
    const sonuc = await apiPost({
      action: 'markLost',
      id: kitap.id
    });

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Kayıp işaretleme hatası', 'error');
      return;
    }

    await silKitapBul(true);
    mesajGoster(sonuc.message || 'Kitap kayıp olarak işaretlendi', 'success');
  } catch (err) {
    mesajGoster('Kayıp işaretleme hatası: ' + err.message, 'error');
  }
}

async function kitapSil() {
  temizMesaj();

  const kitap = window.seciliSilKitap;
  if (!kitap) {
    mesajGoster('Önce kitabı bulun', 'warn');
    return;
  }

  if (String(kitap.durum || '').toUpperCase() === 'ÖDÜNÇTE') {
    mesajGoster('Ödünçte olan kitap silinemez. Kayıp olarak işaretleyebilirsin.', 'error');
    return;
  }

  const onay = confirm(
    `${kitap.kitapAdi || 'Bu kitabı'} silmek istediğine emin misin?`
  );

  if (!onay) return;

  try {
    const sonuc = await apiPost({
      action: 'deleteBook',
      id: kitap.id
    });

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Silme hatası', 'error');
      return;
    }

    mesajGoster(sonuc.message || 'Kitap silindi', 'success');

    document.getElementById('silIsbn').value = '';
    const alan = document.getElementById('silKitapAlani');
    if (alan) alan.innerHTML = '';
    window.seciliSilKitap = null;
  } catch (err) {
    mesajGoster('Silme hatası: ' + err.message, 'error');
  }
}
