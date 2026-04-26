// js/iade_v2.js — v2
// v2: ISBN aramasında tüm kopyalar dikkate alınır
//   1. _iadeNorm(): Unicode-safe durum normalizer (liste.js'deki _durumNorm ile aynı)
//   2. iadeKitapBul(): kitaplar.find() → filter() — tüm kopyaları tarar
//      0 ÖDÜNÇTE → "iade bekleyen kopya yok"
//      1 ÖDÜNÇTE → tek kopya kartı, otomatik seçilir
//      2+ ÖDÜNÇTE → çoklu seçim UI, inline [İptal] [İade Al (X)] butonları
//   3. iadeAl(): window.seciliIadeKopyalar dizisini işler (Promise.all batch iade)
//   4. No worker.js change — booksList zaten tüm kopyaları döndürüyor

// ── Kamera ────────────────────────────────────────────────────────────────
async function kamerayiBaslatIade() {
  await kameraBaslat({
    inputId: 'iadeIsbn',
    successMessage: 'ISBN okundu: ',
    onDetected: iadeKitapBul
  });
}

// ── Unicode-safe durum normalizer ─────────────────────────────────────────
// liste.js'deki _durumNorm ile aynı mantık — Ö/ÖDÜNÇTE NFC/NFD sorununa karşı
function _iadeNorm(raw) {
  const s = String(raw || '').trim();
  if (!s || s.toUpperCase() === 'RAFTA') return 'RAFTA';
  if (s.toUpperCase() === 'KAYIP')       return 'KAYIP';
  const c0 = s.charCodeAt(0);
  if (c0 === 214 || c0 === 246) return 'ODUNCTE'; // Ö veya ö
  if (s.toUpperCase().indexOf('D\u00DCN') !== -1) return 'ODUNCTE';
  return 'RAFTA';
}

// ── Form ──────────────────────────────────────────────────────────────────
function iadeForm() {
  window.seciliIadeKopyalar = []; // replaces seciliIadeKitap

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
      <div class="formTitle">📥 İade Al</div>

      <div class="topActions">
        <button class="actionBtn blueBtn" onclick="kamerayiBaslatIade()">📷 Kamera ile ISBN Okut</button>
        <button class="actionBtn grayBtn" onclick="kameraKapat()">Kamerayı Kapat</button>
      </div>

      <div id="scannerWrap" class="scannerWrap">
        <div id="reader"></div>
        <div class="scanHelp">Barkodu kutuya ortalayın</div>
      </div>

      <label class="formLabel">ISBN</label>
      <input class="formInput" type="text" id="iadeIsbn" placeholder="ISBN yazın veya okutun">

      <button class="actionBtn secondaryBtn" onclick="iadeKitapBul()">Kitabı Bul</button>

      <div id="iadeKitapAlani"></div>

      <button class="actionBtn greenBtn" onclick="iadeAl()">📥 İade Al</button>

      <div id="mesajKutusu" class="mesajKutusu"></div>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ── Kitabı Bul ────────────────────────────────────────────────────────────
async function iadeKitapBul(suppressStatusMessage = false) {
  temizMesaj();
  window.seciliIadeKopyalar = [];

  const alan = document.getElementById('iadeKitapAlani');
  if (alan) alan.innerHTML = '';

  try {
    const isbn = temizIsbn(document.getElementById('iadeIsbn')?.value || '');
    if (!isbn) { mesajGoster('Önce ISBN girin veya okutun', 'warn'); return; }

    const kitaplar = await tumKitaplariGetir();

    // Tüm eşleşen kopyaları bul — find() değil filter()
    const eslesen = kitaplar.filter(k => temizIsbn(k.isbn || '') === isbn);

    if (!eslesen.length) {
      mesajGoster('Bu ISBN ile kayıtlı kitap bulunamadı', 'warn');
      return;
    }

    // Unicode-safe ÖDÜNÇTE filtresi
    const oduncteler = eslesen.filter(k => _iadeNorm(k.durum) === 'ODUNCTE');

    if (!oduncteler.length) {
      // Tüm kopyalar rafta — kitap bilgisini göster ama uyar
      if (alan) alan.innerHTML = kitapKartHtml(eslesen[0], '');
      if (!suppressStatusMessage) mesajGoster('Bu kitap için iade bekleyen kopya yok', 'warn');
      return;
    }

    if (oduncteler.length === 1) {
      // Tek ÖDÜNÇTE kopya — otomatik seç, bilgi kartını göster
      const k = oduncteler[0];
      window.seciliIadeKopyalar = [k];
      if (alan) {
        alan.innerHTML = kitapKartHtml(k, `
          <div class="kitapSatir"><strong>Ödünç Alan:</strong> ${guvenliYazi(k.oduncAlan || '-')}</div>
          <div class="kitapSatir"><strong>Ödünç Tarihi:</strong> ${guvenliYazi(k.oduncTarihi || '-')}</div>
          <div class="kitapSatir"><strong>İade Tarihi:</strong> ${guvenliYazi(k.iadeTarihi || '-')}</div>
        `);
      }
      if (!suppressStatusMessage) mesajGoster('Kitap bulundu, iade alınabilir', 'success');

    } else {
      // Birden fazla ÖDÜNÇTE kopya — seçim UI göster
      if (alan) {
        alan.innerHTML = _iadeSecimHtml(oduncteler, eslesen[0]);
        _iadeSecimKur(oduncteler);
      }
      if (!suppressStatusMessage) {
        mesajGoster(oduncteler.length + ' ödünçte kopya bulundu', 'success');
      }
    }

  } catch (err) {
    mesajGoster('Arama hatası: ' + err.message, 'error');
  }
}

// ── Çoklu seçim HTML ──────────────────────────────────────────────────────
function _iadeSecimHtml(oduncteler, ilkKitap) {
  const rows = oduncteler.map((k, i) => {
    const tarih = k.oduncTarihi
      ? new Date(k.oduncTarihi).toLocaleDateString('tr-TR', { day:'numeric', month:'numeric', year:'numeric' })
      : '';
    const label = [k.kitapKodu, k.oduncAlan, tarih].filter(Boolean).join(' — ');
    return `
      <div class="iadeSecimRow" data-idx="${i}"
           style="display:flex;align-items:center;justify-content:space-between;
                  padding:12px 14px;border-radius:12px;cursor:pointer;margin-bottom:6px;
                  background:#fff;border:1.5px solid #e5e7eb;
                  -webkit-tap-highlight-color:transparent;transition:background 0.1s;">
        <span style="font-size:14px;font-weight:600;color:#111;
                     word-break:break-word;flex:1;min-width:0;">
          ${guvenliYazi(label)}
        </span>
        <span class="iadeSecimCheck"
              style="font-size:20px;color:transparent;flex-shrink:0;margin-left:10px;">✓</span>
      </div>`;
  }).join('');

  return `
    <div class="kitapKart">
      <div class="kitapBaslik">${guvenliYazi(ilkKitap.kitapAdi || '-')}</div>
      <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(ilkKitap.isbn || '-')}</div>
      <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(ilkKitap.yazar || '-')}</div>

      <div style="margin:14px 0 8px;font-size:13px;font-weight:700;color:#6b7280;
                  text-transform:uppercase;letter-spacing:0.5px;">
        Ödünçte Kopyalar (${oduncteler.length})
      </div>

      <div id="iadeSecimListe">${rows}</div>

      <div id="iadeSecimOzet"
           style="margin:10px 0 4px;font-size:14px;font-weight:600;
                  color:#6b7280;text-align:center;">
        0 kopya seçildi
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
        <button onclick="_iadeSecimIptal()"
                style="padding:14px;font-size:16px;font-weight:700;
                       border:none;border-radius:12px;
                       background:#f3f4f6;color:#374151;cursor:pointer;
                       -webkit-tap-highlight-color:transparent;">İptal</button>
        <button id="iadeSecimOnayBtn" disabled
                style="padding:14px;font-size:16px;font-weight:700;
                       border:none;border-radius:12px;
                       background:#e5e7eb;color:#9ca3af;cursor:not-allowed;
                       -webkit-tap-highlight-color:transparent;">İade Al (0)</button>
      </div>
    </div>`;
}

// ── Çoklu seçim event handlers ────────────────────────────────────────────
function _iadeSecimKur(oduncteler) {
  const rows    = document.querySelectorAll('.iadeSecimRow');
  const onayBtn = document.getElementById('iadeSecimOnayBtn');
  const seciler = new Set();

  function _guncelle() {
    rows.forEach(row => {
      const i      = parseInt(row.dataset.idx, 10);
      const secili = seciler.has(i);
      row.style.background  = secili ? '#d1fae5' : '#fff';
      row.style.borderColor = secili ? '#059669' : '#e5e7eb';
      const check = row.querySelector('.iadeSecimCheck');
      if (check) check.style.color = secili ? '#047857' : 'transparent';
    });

    const count = seciler.size;
    const ozet  = document.getElementById('iadeSecimOzet');
    if (ozet) ozet.textContent = count + ' kopya seçildi';

    if (onayBtn) {
      onayBtn.disabled         = count === 0;
      onayBtn.style.background = count > 0 ? '#047857' : '#e5e7eb';
      onayBtn.style.color      = count > 0 ? '#fff'    : '#9ca3af';
      onayBtn.style.cursor     = count > 0 ? 'pointer' : 'not-allowed';
      onayBtn.textContent      = count > 0 ? `İade Al (${count})` : 'İade Al (0)';
    }

    // Sync global state so iadeAl() also works
    window.seciliIadeKopyalar = [...seciler].sort().map(i => oduncteler[i]);
  }

  rows.forEach(row => {
    row.addEventListener('click', () => {
      const i = parseInt(row.dataset.idx, 10);
      if (seciler.has(i)) seciler.delete(i); else seciler.add(i);
      _guncelle();
    });
  });

  if (onayBtn) {
    onayBtn.addEventListener('click', () => {
      if (window.seciliIadeKopyalar?.length > 0) iadeAl();
    });
  }
}

// Seçimi iptal et — alanı temizle
function _iadeSecimIptal() {
  window.seciliIadeKopyalar = [];
  const alan = document.getElementById('iadeKitapAlani');
  if (alan) alan.innerHTML = '';
  temizMesaj();
}

// ── İade Al ───────────────────────────────────────────────────────────────
async function iadeAl() {
  temizMesaj();

  const kopyalar = window.seciliIadeKopyalar || [];
  if (!kopyalar.length) {
    mesajGoster('Önce kitabı bulun ve iade edilecek kopyayı seçin', 'warn');
    return;
  }

  try {
    const sonuclar = await Promise.all(
      kopyalar.map(k => apiPost({ action: 'returnBook', id: k.id }))
    );

    const hata = sonuclar.find(s => !s.ok);
    if (hata) { mesajGoster(hata.error || 'İade alma hatası', 'error'); return; }

    window.seciliIadeKopyalar = [];

    const count = kopyalar.length;
    const mesaj = count === 1
      ? (sonuclar[0].message || 'Kitap iade alındı')
      : count + ' kitap iade alındı';

    await iadeKitapBul(true); // Güncel durumu göster (suppressStatusMessage=true)
    mesajGoster(mesaj, 'success');

  } catch (err) {
    mesajGoster('İade alma hatası: ' + err.message, 'error');
  }
}
