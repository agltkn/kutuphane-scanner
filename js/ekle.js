function getUserKey() {
  let key = localStorage.getItem('kutuphane_user_key');
  if (!key) {
    key = 'demo-user';
    localStorage.setItem('kutuphane_user_key', key);
  }
  return key;
}

function guvenliYazi(deger) {
  return String(deger || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function temizIsbn(deger) {
  if (window.KutuphaneCamera && window.KutuphaneCamera.temizKod) {
    return window.KutuphaneCamera.temizKod(deger);
  }
  return String(deger || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
}

function temizMesaj() {
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className = 'mesajKutusu';
  kutu.innerHTML = '';
}

function mesajGoster(mesaj, tip = 'success') {
  const kutu = document.getElementById('mesajKutusu');
  if (!kutu) return;
  kutu.className = 'mesajKutusu mesaj-' + tip;
  kutu.innerHTML = guvenliYazi(mesaj);
}

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

async function kameraKapat() {
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

async function kamerayiBaslatEkle() {
  temizMesaj();

  if (!window.KutuphaneCamera) {
    mesajGoster('Kamera modülü yüklenemedi', 'error');
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
        const isbnInput = document.getElementById('isbn');
        if (isbnInput) isbnInput.value = isbn;

        mesajGoster('ISBN okundu: ' + isbn, 'success');
        await kameraKapat();
        await isbnBilgisiGetir();
      }
    });
  } catch (err) {
    await kameraKapat();
    mesajGoster('Kamera açılamadı: ' + (err.message || err), 'error');
  }
}

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
        <div class="scanHelp">Barkodu kutuya ortalayın</div>
      </div>

      <label class="formLabel">ISBN</label>
      <input class="formInput" type="text" id="isbn" placeholder="ISBN yazın veya okutun">

      <button class="actionBtn secondaryBtn" onclick="isbnBilgisiGetir()">ISBN'den Doldur</button>

      <div id="ekleKitapAlani"></div>

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

      <button class="actionBtn greenBtn" onclick="kitapEkle()">Kaydet</button>

      <div id="mesajKutusu" class="mesajKutusu"></div>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

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
    const sonuc = await apiPost({
      action: 'isbnLookup',
      isbn: isbn
    });

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Sorgu hatası', 'error');
      return;
    }

    const data = sonuc.data || {};
    const kartAlani = document.getElementById('ekleKitapAlani');
    if (kartAlani) kartAlani.innerHTML = '';

    if (!data.bulundu) {
      mesajGoster(data.mesaj || 'Kitap bilgisi bulunamadı', 'warn');
      return;
    }

    document.getElementById('isbn').value = data.isbn || '';
    document.getElementById('kitapAdi').value = data.kitapAdi || '';
    document.getElementById('yazar').value = data.yazar || '';
    document.getElementById('yayinevi').value = data.yayinevi || '';
    document.getElementById('yayinYili').value = data.yayinYili || '';

    if (kartAlani) {
      const kapakHtml = data.kapakUrl
        ? `
          <div class="kapakWrap">
            <img
              class="kapakImg"
              src="${String(data.kapakUrl).replace(/"/g, '&quot;')}"
              alt="Kitap kapağı"
              referrerpolicy="no-referrer"
              loading="lazy"
            >
          </div>
        `
        : '';

      kartAlani.innerHTML = `
        <div class="kitapKart">
          <div class="kitapKartUst">
            ${kapakHtml}
            <div class="kitapBilgi">
              <div class="kitapBaslik">${guvenliYazi(data.kitapAdi || '-')}</div>
              <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(data.yazar || '-')}</div>
              <div class="kitapSatir"><strong>Yayınevi:</strong> ${guvenliYazi(data.yayinevi || '-')}</div>
              <div class="kitapSatir"><strong>Yıl:</strong> ${guvenliYazi(data.yayinYili || '-')}</div>
              <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(data.isbn || '-')}</div>
            </div>
          </div>
        </div>
      `;
    }

    if (data.zatenKayitli && data.mevcutKayit) {
      mesajGoster('Bu ISBN sistemde zaten kayıtlı', 'error');
    } else {
      mesajGoster('Kitap bilgisi dolduruldu', 'success');
    }
  } catch (err) {
    mesajGoster('Sorgu hatası: ' + err.message, 'error');
  }
}

async function kitapEkle() {
  temizMesaj();

  const payload = {
    action: 'bookAdd',
    userKey: getUserKey(),
    isbn: temizIsbn(document.getElementById('isbn')?.value || ''),
    kitapAdi: (document.getElementById('kitapAdi')?.value || '').trim(),
    yazar: (document.getElementById('yazar')?.value || '').trim(),
    yayinevi: (document.getElementById('yayinevi')?.value || '').trim(),
    yayinYili: (document.getElementById('yayinYili')?.value || '').trim(),
    notText: (document.getElementById('notText')?.value || '').trim()
  };

  if (!payload.kitapAdi || !payload.yazar) {
    mesajGoster('Kitap adı ve yazar zorunlu', 'warn');
    return;
  }

  try {
    const sonuc = await apiPost(payload);

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Kayıt hatası', 'error');
      return;
    }

    const mesaj = String(sonuc.message || '');
    if (mesaj.toLowerCase().includes('zaten')) {
      mesajGoster(mesaj, 'error');
      return;
    }

    mesajGoster(mesaj || 'Kitap kaydedildi', 'success');

    document.getElementById('isbn').value = '';
    document.getElementById('kitapAdi').value = '';
    document.getElementById('yazar').value = '';
    document.getElementById('yayinevi').value = '';
    document.getElementById('yayinYili').value = '';
    document.getElementById('notText').value = '';

    const kartAlani = document.getElementById('ekleKitapAlani');
    if (kartAlani) kartAlani.innerHTML = '';
  } catch (err) {
    mesajGoster('Kayıt hatası: ' + err.message, 'error');
  }
}
