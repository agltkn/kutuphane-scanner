// js/odunc.js — v2
// v2: ISBN aramasında tüm kopyalar dikkate alınır
//   1. _oduncNorm(): Unicode-safe durum normalizer (liste.js / iade_v2.js ile aynı)
//   2. oduncKitapBul(): kitaplar.find() → filter() — tüm kopyaları tarar
//      0 RAFTA → "rafta uygun kopya yok"
//      1 RAFTA → tek kopya kartı, otomatik seçilir
//      2+ RAFTA → çoklu seçim UI, satıra tıklayınca seçilir
//   3. oduncVer(): window.seciliOduncKopya üzerinden çalışır
//   4. No worker.js change — booksList zaten tüm kopyaları döndürüyor

// ── Kamera ────────────────────────────────────────────────────────────────
async function kamerayiBaslatOdunc() {
  await kameraBaslat({
    inputId: 'oduncIsbn',
    successMessage: 'ISBN okundu: ',
    onDetected: oduncKitapBul
  });
}

// ── Unicode-safe durum normalizer ─────────────────────────────────────────
// liste.js _durumNorm / iade_v2.js _iadeNorm ile aynı mantık
function _oduncNorm(raw) {
  const s = String(raw || '').trim();
  if (!s || s.toUpperCase() === 'RAFTA') return 'RAFTA';
  if (s.toUpperCase() === 'KAYIP')       return 'KAYIP';
  const c0 = s.charCodeAt(0);
  if (c0 === 214 || c0 === 246) return 'ODUNCTE'; // Ö veya ö
  if (s.toUpperCase().indexOf('D\u00DCN') !== -1) return 'ODUNCTE';
  return 'RAFTA';
}

// ── Form ──────────────────────────────────────────────────────────────────
function oduncVerForm() {
  window.seciliOduncKopya = null; // replaces seciliOduncKitap

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

      .rafta   { background:#d1fae5; color:#065f46; }
      .oduncte { background:#fef3c7; color:#92400e; }

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

      .mesaj-success { display:block; background:#d1fae5; color:#065f46; }
      .mesaj-error   { display:block; background:#fee2e2; color:#991b1b; }
      .mesaj-warn    { display:block; background:#ffedd5; color:#9a3412; }

      @media (max-width:640px){
        .topActions{ grid-template-columns:1fr; }
      }
    </style>

    <div class="formCard">
      <div class="formTitle">📤 Ödünç Ver</div>

      <div class="topActions">
        <button class="actionBtn blueBtn" onclick="kamerayiBaslatOdunc()">📷 Kamera ile ISBN Okut</button>
        <button class="actionBtn grayBtn" onclick="kameraKapat()">Kamerayı Kapat</button>
      </div>

      <div id="scannerWrap" class="scannerWrap">
        <div id="reader"></div>
        <div class="scanHelp">Barkodu kutuya ortalayın</div>
      </div>

      <label class="formLabel">ISBN</label>
      <input class="formInput" type="text" id="oduncIsbn" placeholder="ISBN yazın veya okutun">

      <button class="actionBtn secondaryBtn" onclick="oduncKitapBul()">Kitabı Bul</button>

      <div id="oduncKitapAlani"></div>

      <label class="formLabel">Kime Verildi</label>
      <input class="formInput" type="text" id="oduncAlan" placeholder="Ad Soyad">

      <button class="actionBtn greenBtn" onclick="oduncVer()">📤 Ödünç Ver</button>

      <div id="mesajKutusu" class="mesajKutusu"></div>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ── Kitabı Bul ────────────────────────────────────────────────────────────
async function oduncKitapBul(suppressStatusMessage = false) {
  temizMesaj();
  window.seciliOduncKopya = null;

  const alan = document.getElementById('oduncKitapAlani');
  if (alan) alan.innerHTML = '';

  try {
    const isbn = temizIsbn(document.getElementById('oduncIsbn')?.value || '');
    if (!isbn) { mesajGoster('Önce ISBN girin veya okutun', 'warn'); return; }

    const kitaplar = await tumKitaplariGetir();

    // Tüm eşleşen kopyaları bul — find() değil filter()
    const eslesen = kitaplar.filter(k => temizIsbn(k.isbn || '') === isbn);

    if (!eslesen.length) {
      mesajGoster('Bu ISBN ile kayıtlı kitap bulunamadı', 'warn');
      return;
    }

    // Unicode-safe RAFTA filtresi
    const raftalar = eslesen.filter(k => _oduncNorm(k.durum) === 'RAFTA');

    if (!raftalar.length) {
      // Tüm kopyalar ödünçte veya kayıp — kitap bilgisini göster ama uyar
      if (alan) alan.innerHTML = kitapKartHtml(eslesen[0], '');
      if (!suppressStatusMessage) mesajGoster('Bu kitap için rafta uygun kopya yok', 'warn');
      return;
    }

    if (raftalar.length === 1) {
      // Tek RAFTA kopya — otomatik seç, bilgi kartını göster
      const k = raftalar[0];
      window.seciliOduncKopya = k;
      if (alan) alan.innerHTML = kitapKartHtml(k, '');
      if (!suppressStatusMessage) mesajGoster('Kitap bulundu, ödünç verilebilir', 'success');

    } else {
      // Birden fazla RAFTA kopya — seçim UI göster
      if (alan) {
        alan.innerHTML = _oduncSecimHtml(raftalar, eslesen[0]);
        _oduncSecimKur(raftalar);
      }
      if (!suppressStatusMessage) {
        mesajGoster(raftalar.length + ' rafta kopya bulundu', 'success');
      }
    }

  } catch (err) {
    mesajGoster('Arama hatası: ' + err.message, 'error');
  }
}

// ── Çoklu seçim HTML ──────────────────────────────────────────────────────
function _oduncSecimHtml(raftalar, ilkKitap) {
  const rows = raftalar.map((k, i) => `
    <div class="oduncKopyaRow" data-idx="${i}"
         style="display:flex;align-items:center;justify-content:space-between;
                padding:12px 14px;border-radius:12px;cursor:pointer;margin-bottom:6px;
                background:#fff;border:1.5px solid #e5e7eb;
                -webkit-tap-highlight-color:transparent;transition:background 0.1s;">
      <span style="font-family:monospace;font-size:15px;font-weight:700;color:#111;">
        ${guvenliYazi(k.kitapKodu || '-')}
      </span>
      <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;
                   background:#d1fae5;color:#065f46;">Rafta</span>
    </div>`
  ).join('');

  return `
    <div class="kitapKart">
      <div class="kitapBaslik">${guvenliYazi(ilkKitap.kitapAdi || '-')}</div>
      <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(ilkKitap.isbn || '-')}</div>
      <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(ilkKitap.yazar || '-')}</div>

      <div style="margin:14px 0 8px;font-size:13px;font-weight:700;color:#6b7280;
                  text-transform:uppercase;letter-spacing:0.5px;">
        Rafta Kopyalar (${raftalar.length}) — birini seçin
      </div>

      <div id="oduncKopyaSecimListe">${rows}</div>

      <div id="oduncKopyaSecimOzet"
           style="margin:10px 0 0;font-size:14px;font-weight:600;
                  color:#6b7280;text-align:center;">
        Kopya seçilmedi
      </div>
    </div>`;
}

// ── Çoklu seçim event handlers ────────────────────────────────────────────
function _oduncSecimKur(raftalar) {
  const rows = document.querySelectorAll('.oduncKopyaRow');

  rows.forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.idx, 10);
      const secilen = raftalar[idx];

      // Tüm satırları sıfırla, seçileni vurgula
      rows.forEach(r => {
        r.style.background  = '#fff';
        r.style.borderColor = '#e5e7eb';
      });
      row.style.background  = '#d1fae5';
      row.style.borderColor = '#059669';

      window.seciliOduncKopya = secilen;

      const ozet = document.getElementById('oduncKopyaSecimOzet');
      if (ozet) {
        ozet.textContent = guvenliYazi(secilen.kitapKodu || '-') + ' seçildi';
        ozet.style.color = '#065f46';
      }
    });
  });
}

// ── Ödünç Ver ─────────────────────────────────────────────────────────────
async function oduncVer() {
  temizMesaj();

  const kopya = window.seciliOduncKopya;
  if (!kopya) {
    mesajGoster('Önce kitabı bulun', 'warn');
    return;
  }

  // Çift kontrol: seçilen kopya hâlâ RAFTA mı?
  if (_oduncNorm(kopya.durum) !== 'RAFTA') {
    mesajGoster('Seçilen kopya artık rafta değil', 'error');
    return;
  }

  const borrower = (document.getElementById('oduncAlan')?.value || '').trim();
  if (!borrower) {
    mesajGoster('Kişi adı zorunlu', 'warn');
    return;
  }

  try {
    const sonuc = await apiPost({
      action: 'loanBook',
      id: kopya.id,
      borrower
    });

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Ödünç verme hatası', 'error');
      return;
    }

    window.seciliOduncKopya = null;
    await oduncKitapBul(true); // güncel durumu göster
    mesajGoster(sonuc.message || 'Kitap ödünç verildi', 'success');
    const oduncAlanInput = document.getElementById('oduncAlan');
    if (oduncAlanInput) oduncAlanInput.value = '';

  } catch (err) {
    mesajGoster('Ödünç verme hatası: ' + err.message, 'error');
  }
}
