// js/sil.js — v2
// v2: Kopya seçimli silme akışı
//   - _silNorm(): Unicode-safe durum normalizer (iade_v2.js / odunc.js ile aynı mantık)
//   - silKitapBul(): filter() — tüm kopyaları tarar
//     0 RAFTA → uyarı (tüm kopyalar ödünçte/kayıp olabilir)
//     1 RAFTA → otomatik seç, direkt silme/kayıp akışı
//     2+ RAFTA → _silSecimHtml() + _silSecimKur() — kopya seçim UI
//   - kitapSil() / kitapKayipYap(): window.seciliSilKitap üzerinden çalışır (değişmedi)

// ── Kamera ────────────────────────────────────────────────────────────────
async function kamerayiBaslatSil() {
  await kameraBaslat({
    inputId: 'silIsbn',
    successMessage: 'ISBN okundu: ',
    onDetected: silKitapBul
  });
}

// ── Unicode-safe durum normalizer ─────────────────────────────────────────
function _silNorm(raw) {
  const s = String(raw || '').trim();
  if (!s || s.toUpperCase() === 'RAFTA') return 'RAFTA';
  if (s.toUpperCase() === 'KAYIP')       return 'KAYIP';
  const c0 = s.charCodeAt(0);
  if (c0 === 214 || c0 === 246) return 'ODUNCTE'; // Ö veya ö
  if (s.toUpperCase().indexOf('DÜN') !== -1) return 'ODUNCTE';
  return 'RAFTA';
}

// ── Form ──────────────────────────────────────────────────────────────────
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
      .oduncte { background:#fee2e2; color:#991b1b; }

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

      <!-- v2: işlem butonları kopya seçilene kadar gizli -->
      <div id="silIslemSection" style="display:none">
        <button class="actionBtn orangeBtn" onclick="kitapKayipYap()">Kayıp Olarak İşaretle</button>
        <button class="actionBtn redBtn" onclick="kitapSil()">Kitabı Sil</button>
      </div>

      <div id="mesajKutusu" class="mesajKutusu"></div>
    </div>
  `;

  setTimeout(() => {
    alan.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

// ── Çoklu seçim HTML ──────────────────────────────────────────────────────
function _silSecimHtml(raftalar, ilkKitap) {
  const rows = raftalar.map((k, i) => `
    <div class="silKopyaRow" data-idx="${i}"
         style="display:flex;align-items:center;justify-content:space-between;
                padding:12px 14px;border-radius:12px;cursor:pointer;margin-bottom:6px;
                background:#fff;border:1.5px solid #e5e7eb;
                -webkit-tap-highlight-color:transparent;transition:background 0.1s;">
      <span style="font-family:monospace;font-size:15px;font-weight:700;color:#111;">
        ${guvenliYazi(k.kitapKodu || '-')}
      </span>
      <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;
                   background:#d1fae5;color:#065f46;">Rafta</span>
    </div>
  `).join('');

  return `
    <div class="kitapKart">
      <div class="kitapBaslik">${guvenliYazi(ilkKitap.kitapAdi || '-')}</div>
      <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(ilkKitap.isbn || '-')}</div>
      <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(ilkKitap.yazar || '-')}</div>

      <div style="margin:14px 0 8px;font-size:13px;font-weight:700;color:#6b7280;
                  text-transform:uppercase;letter-spacing:0.5px;">
        Rafta Kopyalar (${raftalar.length}) — silmek için birini seçin
      </div>

      <div id="silKopyaSecimListe">${rows}</div>

      <div id="silKopyaSecimOzet" style="margin:10px 0 0;font-size:14px;font-weight:600;
                  color:#6b7280;text-align:center;">
        Kopya seçilmedi
      </div>
    </div>
  `;
}

// ── Çoklu seçim event handlers ────────────────────────────────────────────
function _silSecimKur(raftalar) {
  const rows = document.querySelectorAll('.silKopyaRow');
  rows.forEach(row => {
    row.addEventListener('click', () => {
      const idx     = parseInt(row.dataset.idx, 10);
      const secilen = raftalar[idx];

      rows.forEach(r => { r.style.background = '#fff'; r.style.borderColor = '#e5e7eb'; });
      row.style.background  = '#fee2e2';
      row.style.borderColor = '#ef4444';

      window.seciliSilKitap = secilen;

      const ozet = document.getElementById('silKopyaSecimOzet');
      if (ozet) {
        ozet.textContent = guvenliYazi(secilen.kitapKodu || '-') + ' seçildi';
        ozet.style.color = '#991b1b';
      }

      // İşlem butonlarını göster
      const sec = document.getElementById('silIslemSection');
      if (sec) sec.style.display = 'block';
    });
  });
}

// ── Kitabı Bul ────────────────────────────────────────────────────────────
async function silKitapBul(suppressStatusMessage = false) {
  temizMesaj();
  window.seciliSilKitap = null;

  // İşlem butonlarını gizle
  const islemSec = document.getElementById('silIslemSection');
  if (islemSec) islemSec.style.display = 'none';

  const alan = document.getElementById('silKitapAlani');
  if (alan) alan.innerHTML = '';

  try {
    const isbn = temizIsbn(document.getElementById('silIsbn')?.value || '');
    if (!isbn) {
      mesajGoster('Önce ISBN girin veya okutun', 'warn');
      return;
    }

    const kitaplar = await tumKitaplariGetir();

    // Tüm eşleşen kopyaları bul — find() değil filter()
    const eslesen = kitaplar.filter(k => temizIsbn(k.isbn || '') === isbn);

    if (!eslesen.length) {
      mesajGoster('Bu ISBN ile kayıtlı kitap bulunamadı', 'warn');
      return;
    }

    // Sadece RAFTA kopyalar silinebilir; ÖDÜNÇTE olanlar listelenmez
    const raftalar = eslesen.filter(k => _silNorm(k.durum) === 'RAFTA');

    if (!raftalar.length) {
      // Hiç RAFTA kopya yok
      if (alan) alan.innerHTML = kitapKartHtml(eslesen[0]);
      if (!suppressStatusMessage) {
        const hepsiOduncte = eslesen.every(k => _silNorm(k.durum) === 'ODUNCTE');
        mesajGoster(
          hepsiOduncte
            ? 'Tüm kopyalar ödünçte — silinemez'
            : 'Rafta kopya bulunamadı',
          'warn'
        );
      }
      return;
    }

    if (raftalar.length === 1) {
      // Tek RAFTA kopya — otomatik seç, işlem butonlarını göster
      window.seciliSilKitap = raftalar[0];
      if (alan) alan.innerHTML = kitapKartHtml(raftalar[0]);
      if (islemSec) islemSec.style.display = 'block';
      if (!suppressStatusMessage) mesajGoster('Kitap bulundu', 'success');

    } else {
      // Birden fazla RAFTA kopya — seçim UI
      if (alan) {
        alan.innerHTML = _silSecimHtml(raftalar, eslesen[0]);
        _silSecimKur(raftalar);
      }
      if (!suppressStatusMessage) {
        mesajGoster(raftalar.length + ' rafta kopya bulundu — birini seçin', 'success');
      }
    }

  } catch (err) {
    mesajGoster('Arama hatası: ' + err.message, 'error');
  }
}

// ── Kayıp İşaretle ────────────────────────────────────────────────────────
async function kitapKayipYap() {
  temizMesaj();

  const kitap = window.seciliSilKitap;
  if (!kitap) {
    mesajGoster('Önce kitabı bulun ve kopya seçin', 'warn');
    return;
  }

  if (_silNorm(kitap.durum) === 'KAYIP') {
    mesajGoster('Bu kitap zaten kayıp olarak işaretlenmiş', 'warn');
    return;
  }

  const onay = confirm(
    `${kitap.kitapAdi || 'Bu kitabı'} kayıp olarak işaretlemek istiyor musun?`
  );
  if (!onay) return;

  try {
    const sonuc = await apiPost({ action: 'markLost', id: kitap.id });

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

// ── Kitap Sil ─────────────────────────────────────────────────────────────
async function kitapSil() {
  temizMesaj();

  const kitap = window.seciliSilKitap;
  if (!kitap) {
    mesajGoster('Önce kitabı bulun ve kopya seçin', 'warn');
    return;
  }

  if (_silNorm(kitap.durum) === 'ODUNCTE') {
    mesajGoster('Ödünçte olan kitap silinemez. Kayıp olarak işaretleyebilirsin.', 'error');
    return;
  }

  const onay = confirm(
    `${kitap.kitapAdi || 'Bu kitabı'} (${kitap.kitapKodu || kitap.id}) silmek istediğine emin misin?`
  );
  if (!onay) return;

  try {
    const sonuc = await apiPost({ action: 'deleteBook', id: kitap.id });

    if (!sonuc.ok) {
      mesajGoster(sonuc.error || 'Silme hatası', 'error');
      return;
    }

    mesajGoster(sonuc.message || 'Kitap silindi', 'success');

    document.getElementById('silIsbn').value = '';
    const alan = document.getElementById('silKitapAlani');
    if (alan) alan.innerHTML = '';
    const islemSec = document.getElementById('silIslemSection');
    if (islemSec) islemSec.style.display = 'none';
    window.seciliSilKitap = null;
  } catch (err) {
    mesajGoster('Silme hatası: ' + err.message, 'error');
  }
}
