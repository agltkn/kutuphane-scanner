// js/liste.js — v66
// v64:
//   • _isbnSayimHesapla(): books üzerinden ISBN bazlı kopya sayısı
//   • renderList: adet > 1 ise kart üzerinde "📚 X adet" badge
//   • detayAc: üst kısımda "Toplam X adet" + sticky "✕ Kapat" header
//   • Kapat butonu: sticky, büyük tıklama alanı, her durumda görünür
// v63:
//   • kapakHtml: localStorage kapak önce kontrol edilir ('kapak_' + book.id)
//   • Kartlar tıklanabilir — cardTop alanına onclick="detayAc(id)" eklendi
//   • detayAc(id): slide-up overlay, kitap detay + düzenleme paneli
//   • detayKapat(): overlay kaldırır
//   • detayKaydet(id): bookUpdate API çağrısı
//   • detayKapakSecildi(bookId, input): file → localStorage

let books = [];

function safeAttr(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function listeMesaj(text, type = 'success') {
  const el = document.getElementById('message');
  if (!el) return;
  el.className = 'message ' + type;
  el.innerHTML = guvenliYazi(text);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function listeMesajTemizle() {
  const el = document.getElementById('message');
  if (!el) return;
  el.className = 'message';
  el.innerHTML = '';
}

function kapakUrlOlustur(isbn) {
  const temiz = temizIsbn(isbn);
  if (!temiz) return '';
  return 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(temiz) + '-M.jpg';
}

// v63: localStorage kapak önce — yoksa OpenLibrary URL
function kapakHtml(book) {
  const localKapak = localStorage.getItem('kapak_' + book.id);
  if (localKapak) {
    return `<img class="coverImg" src="${safeAttr(localKapak)}" alt="Kapak" loading="lazy">`;
  }
  const url = kapakUrlOlustur(book.isbn || '');
  if (!url) return `<div class="coverPlaceholder">📘</div>`;
  return `
    <img
      class="coverImg"
      src="${safeAttr(url)}"
      alt="Kapak"
      loading="lazy"
      referrerpolicy="no-referrer"
      onerror="this.outerHTML='<div class=&quot;coverPlaceholder&quot;>📘</div>'"
    >
  `;
}

// v65: ISBN bazlı kopya sayısı — temizIsbn() ile normalize ederek say
function _isbnSayimHesapla(kitaplar) {
  const sayim = {};
  for (const b of kitaplar) {
    const isbn = typeof temizIsbn === 'function'
      ? temizIsbn(b.isbn || '')
      : (b.isbn || '').replace(/[^0-9X]/gi, '').toUpperCase();
    if (!isbn) continue;
    sayim[isbn] = (sayim[isbn] || 0) + 1;
  }
  return sayim;
}

async function loadBooks() {
  listeMesajTemizle();

  try {
    books = await tumKitaplariGetir();
    renderList();
  } catch (err) {
    listeMesaj('Liste hatası: ' + err.message, 'error');
  }
}

function renderList() {
  const q    = (document.getElementById('search')?.value || '').trim().toLowerCase();
  const list = document.getElementById('list');
  if (!list) return;

  let filtered = books;

  if (q) {
    filtered = books.filter(book =>
      (book.kitapKodu || '').toLowerCase().includes(q) ||
      (book.kitapAdi  || '').toLowerCase().includes(q) ||
      (book.yazar     || '').toLowerCase().includes(q) ||
      (book.isbn      || '').toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">Kayıtlı kitap bulunamadı</div>';
    return;
  }

  // v64: tüm kitap listesinden ISBN sayımı (filtrelenmiş değil — gerçek stok)
  const isbnSayim = _isbnSayimHesapla(books);

  list.innerHTML = filtered.map(book => {
    const durum = String(book.durum || 'RAFTA').toUpperCase();

    let statusClass = 'rafta';
    if (durum === 'ÖDÜNÇTE') statusClass = 'oduncte';
    if (durum === 'KAYIP')   statusClass = 'kayip';

    const borrower   = book.oduncAlan   || '-';
    const loanDate   = book.oduncTarihi || '-';
    const returnDate = book.iadeTarihi  || '-';

    const loanButton = durum === 'RAFTA'
      ? `<button class="btn btnLoan" onclick="event.stopPropagation();loanBook(${Number(book.id)})">Ödünç Ver</button>`
      : `<button class="btn btnLoan btnDisabled" disabled>Ödünç Verilemez</button>`;

    const returnButton = durum === 'ÖDÜNÇTE'
      ? `<button class="btn btnReturn" onclick="event.stopPropagation();returnBook(${Number(book.id)})">İade Al</button>`
      : `<button class="btn btnReturn btnDisabled" disabled>İade Beklemiyor</button>`;

    // v66: adet badge — her zaman göster (1 adet dahil)
    const isbn       = typeof temizIsbn === 'function' ? temizIsbn(book.isbn || '') : (book.isbn || '').replace(/[^0-9X]/gi, '').toUpperCase();
    const adetSayisi = isbn ? (isbnSayim[isbn] || 1) : 1;
    const adetBadge  = `<span style="
        display:inline-block;margin-bottom:5px;
        background:#dbeafe;color:#1d4ed8;
        padding:2px 8px;border-radius:999px;
        font-size:11px;font-weight:700;
      ">📚 ${adetSayisi} adet</span>`;

    return `
      <div class="card">
        <!-- v63: cardTop tıklanabilir → detay overlay -->
        <div class="cardTop" onclick="detayAc(${Number(book.id)})" style="cursor:pointer">
          <div class="coverWrap">
            ${kapakHtml(book)}
          </div>

          <div class="cardBody">
            <div class="codeBadge">${guvenliYazi(book.kitapKodu || '-')}</div>
            ${adetBadge}
            <div class="title">${guvenliYazi(book.kitapAdi || '-')}</div>
            <div class="line"><strong>Yazar:</strong> ${guvenliYazi(book.yazar || '-')}</div>
            <div class="line"><strong>ISBN:</strong> ${guvenliYazi(book.isbn || '-')}</div>
            <div class="line"><strong>Yayınevi:</strong> ${guvenliYazi(book.yayinevi || '-')}</div>
            <div class="line"><strong>Yıl:</strong> ${guvenliYazi(book.yayinYili || '-')}</div>
            <div class="line"><strong>Ödünç Alan:</strong> ${guvenliYazi(borrower)}</div>
            <div class="line"><strong>Ödünç Tarihi:</strong> ${guvenliYazi(loanDate)}</div>
            <div class="line"><strong>İade Tarihi:</strong> ${guvenliYazi(returnDate)}</div>
            <div class="status ${statusClass}">${guvenliYazi(durum)}</div>
          </div>
        </div>

        <div class="actions">
          ${loanButton}
          ${returnButton}
        </div>
      </div>
    `;
  }).join('');
}

// ── Detay Overlay ────────────────────────────────────────────────────────
function detayAc(id) {
  const book = books.find(b => Number(b.id) === Number(id));
  if (!book) return;

  const durum = String(book.durum || 'RAFTA').toUpperCase();
  const localKapak = localStorage.getItem('kapak_' + book.id);

  const kapakSrc = localKapak
    ? safeAttr(localKapak)
    : book.isbn
      ? safeAttr('https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(temizIsbn(book.isbn)) + '-M.jpg')
      : '';

  const statusClass = durum === 'ÖDÜNÇTE' ? 'oduncte' : durum === 'KAYIP' ? 'kayip' : 'rafta';

  const loanBtn   = durum === 'RAFTA'    ? `<button onclick="loanBook(${Number(book.id)});detayKapat()" style="${_detayBtnStyle('#0b57d0')}">📤 Ödünç Ver</button>` : '';
  const returnBtn = durum === 'ÖDÜNÇTE'  ? `<button onclick="returnBook(${Number(book.id)});detayKapat()" style="${_detayBtnStyle('#047857')}">📥 İade Al</button>` : '';

  // v66: adet sayısı — her zaman göster (1 adet dahil)
  const isbn       = typeof temizIsbn === 'function' ? temizIsbn(book.isbn || '') : (book.isbn || '').replace(/[^0-9X]/gi, '').toUpperCase();
  const isbnSayim  = _isbnSayimHesapla(books);
  const adetSayisi = isbn ? (isbnSayim[isbn] || 1) : 1;
  const adetSatiri = `<div style="
      display:inline-flex;align-items:center;gap:5px;
      background:#dbeafe;color:#1d4ed8;
      padding:4px 10px;border-radius:999px;
      font-size:12px;font-weight:700;margin-bottom:8px;
    ">📚 Toplam ${adetSayisi} adet</div>`;

  // Remove any existing overlay
  const old = document.getElementById('detayOverlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'detayOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) detayKapat();
  });

  overlay.innerHTML = `
    <div id="detayPanel" style="
      background:#fff;border-radius:22px 22px 0 0;
      width:100%;max-width:700px;max-height:92vh;
      display:flex;flex-direction:column;
      box-shadow:0 -8px 32px rgba(0,0,0,0.18);
    ">

      <!-- v65: flex-column header — sticky değil, flex-shrink:0 ile her zaman görünür -->
      <!-- position:sticky + overflow-y:auto mobilde (özellikle iOS Safari) güvenilmez -->
      <div style="
        flex-shrink:0;
        background:#fff;border-radius:22px 22px 0 0;
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px 10px;
        border-bottom:1px solid #f3f4f6;
      ">
        <!-- drag handle -->
        <div style="display:flex;align-items:center;padding-left:4px">
          <div style="width:40px;height:4px;border-radius:2px;background:#d1d5db"></div>
        </div>
        <!-- kapat butonu — koyu arka plan, yüksek kontrast, mobil uyumlu -->
        <button onclick="detayKapat()" style="
          display:flex;align-items:center;gap:6px;
          padding:10px 20px;font-size:15px;font-weight:700;
          border:none;border-radius:20px;
          background:#1f2937;color:#fff;cursor:pointer;
          min-height:44px;min-width:100px;
        ">✕ Kapat</button>
      </div>

      <!-- v65: sadece bu div scroll olur -->
      <div style="flex:1;overflow-y:auto;padding:0 0 env(safe-area-inset-bottom,0) 0;">

      <!-- kapak + üst bilgi -->
      <div style="display:flex;gap:16px;align-items:flex-start;padding:16px 18px 16px">
        <!-- kapak alanı: tıklayınca fotoğraf seç -->
        <div style="flex-shrink:0;position:relative;cursor:pointer" onclick="document.getElementById('detayKapakInput').click()" title="Kapak fotoğrafı ekle">
          ${kapakSrc
            ? `<img id="detayKapakImg" src="${kapakSrc}" alt="Kapak" style="width:80px;height:116px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;display:block;"
                referrerpolicy="no-referrer"
                onerror="this.outerHTML='<div id=&quot;detayKapakImg&quot; style=&quot;width:80px;height:116px;border-radius:12px;border:1px solid #e5e7eb;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:28px;&quot;>📘</div>'">`
            : `<div id="detayKapakImg" style="width:80px;height:116px;border-radius:12px;border:1px solid #e5e7eb;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:28px;">📘</div>`}
          <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.55);border-radius:6px;padding:2px 5px;font-size:11px;color:#fff">📷</div>
          <input id="detayKapakInput" type="file" accept="image/*" style="display:none"
            onchange="detayKapakSecildi(${Number(book.id)}, this)">
        </div>

        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:#9ca3af;font-weight:600;margin-bottom:4px">${guvenliYazi(book.kitapKodu || '')}</div>
          ${adetSatiri}
          <div style="font-size:20px;font-weight:bold;line-height:1.3;margin-bottom:6px;word-break:break-word">${guvenliYazi(book.kitapAdi || '-')}</div>
          <div style="font-size:14px;color:#555;margin-bottom:4px">${guvenliYazi(book.yazar || '-')}</div>
          <span class="status ${statusClass}" style="font-size:12px;padding:5px 10px">${guvenliYazi(durum)}</span>
        </div>
      </div>

      <!-- eylem butonları -->
      ${(loanBtn || returnBtn) ? `<div style="display:grid;grid-template-columns:${loanBtn && returnBtn ? '1fr 1fr' : '1fr'};gap:8px;padding:0 18px 14px">${loanBtn}${returnBtn}</div>` : ''}

      <!-- düzenleme formu -->
      <div style="padding:0 18px 18px">
        <div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Bilgileri Düzenle</div>

        <label style="${_detayLabelStyle()}">Kitap Adı</label>
        <input id="detayEditAdi" type="text" value="${safeAttr(book.kitapAdi || '')}" style="${_detayInputStyle()}">

        <label style="${_detayLabelStyle()}">Yazar</label>
        <input id="detayEditYazar" type="text" value="${safeAttr(book.yazar || '')}" style="${_detayInputStyle()}">

        <label style="${_detayLabelStyle()}">Yayınevi</label>
        <input id="detayEditYayinevi" type="text" value="${safeAttr(book.yayinevi || '')}" style="${_detayInputStyle()}">

        <label style="${_detayLabelStyle()}">Yayın Yılı</label>
        <input id="detayEditYil" type="text" value="${safeAttr(book.yayinYili || '')}" style="${_detayInputStyle()}">

        <label style="${_detayLabelStyle()}">Not</label>
        <textarea id="detayEditNot" style="${_detayInputStyle()}min-height:80px;resize:vertical;">${guvenliYazi(book.not || '')}</textarea>

        <div id="detayMesaj" style="display:none;margin-top:10px;padding:10px 14px;border-radius:10px;font-size:15px;font-weight:bold"></div>

        <button onclick="detayKaydet(${Number(book.id)})" style="${_detayBtnStyle('#047857')}margin-top:14px;">💾 Kaydet</button>
      </div>

      </div><!-- /scrollable -->
    </div>
  `;

  document.body.appendChild(overlay);

  // Slide-up animation
  const panel = overlay.querySelector('#detayPanel');
  if (panel) {
    panel.style.transform = 'translateY(100%)';
    panel.style.transition = 'transform 0.25s ease';
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });
  }
}

function detayKapat() {
  const overlay = document.getElementById('detayOverlay');
  if (!overlay) return;
  const panel = overlay.querySelector('#detayPanel');
  if (panel) {
    panel.style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 250);
  } else {
    overlay.remove();
  }
}

async function detayKaydet(id) {
  const adiEl    = document.getElementById('detayEditAdi');
  const yazarEl  = document.getElementById('detayEditYazar');
  const yayEl    = document.getElementById('detayEditYayinevi');
  const yilEl    = document.getElementById('detayEditYil');
  const notEl    = document.getElementById('detayEditNot');
  const mesajEl  = document.getElementById('detayMesaj');

  const _bh = typeof basHarfBuyut === 'function' ? basHarfBuyut : function(s){ return s; };

  const adi   = _bh((adiEl?.value   || '').trim());
  const yazar = _bh((yazarEl?.value || '').trim());

  if (!adi || !yazar) {
    if (mesajEl) {
      mesajEl.style.display = 'block';
      mesajEl.style.background = '#fee2e2';
      mesajEl.style.color = '#991b1b';
      mesajEl.textContent = 'Kitap adı ve yazar zorunlu';
    }
    return;
  }

  const payload = {
    action:    'bookUpdate',
    id,
    kitapAdi:  adi,
    yazar,
    yayinevi:  (yayEl?.value || '').trim(),
    yayinYili: (yilEl?.value || '').trim(),
    notText:   (notEl?.value || '').trim()
  };

  try {
    const result = await apiPost(payload);
    if (!result.ok) {
      if (mesajEl) {
        mesajEl.style.display = 'block';
        mesajEl.style.background = '#fee2e2';
        mesajEl.style.color = '#991b1b';
        mesajEl.textContent = result.error || 'Kayıt hatası';
      }
      return;
    }

    // Yerel books dizisini güncelle
    const book = books.find(b => Number(b.id) === Number(id));
    if (book) {
      book.kitapAdi  = adi;
      book.yazar     = yazar;
      book.yayinevi  = (yayEl?.value  || '').trim();
      book.yayinYili = (yilEl?.value  || '').trim();
      book.not       = (notEl?.value  || '').trim();
    }

    detayKapat();
    renderList();
    listeMesaj(result.message || 'Kitap güncellendi', 'success');
  } catch (err) {
    if (mesajEl) {
      mesajEl.style.display = 'block';
      mesajEl.style.background = '#fee2e2';
      mesajEl.style.color = '#991b1b';
      mesajEl.textContent = 'Kayıt hatası: ' + err.message;
    }
  }
}

// v63: dosya seç → data URL → localStorage → kapak img güncelle
function detayKapakSecildi(bookId, inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    localStorage.setItem('kapak_' + bookId, dataUrl);
    // Overlay kapak resmi güncelle
    const img = document.getElementById('detayKapakImg');
    if (img && img.tagName === 'IMG') {
      img.src = dataUrl;
    } else if (img) {
      // placeholder div → img ile değiştir
      const newImg = document.createElement('img');
      newImg.id    = 'detayKapakImg';
      newImg.src   = dataUrl;
      newImg.style.cssText = 'width:80px;height:116px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;display:block;';
      img.replaceWith(newImg);
    }
    // Liste kartını güncelle (renderList tetiklemeden sadece img src yenile)
    renderList();
  };
  reader.readAsDataURL(file);
}

// ── Stil yardımcıları ─────────────────────────────────────────────────────
function _detayBtnStyle(bg) {
  return `display:block;width:100%;padding:14px;font-size:16px;font-weight:bold;
    border:none;border-radius:14px;background:${bg};color:#fff;cursor:pointer;`;
}
function _detayLabelStyle() {
  return 'display:block;font-size:14px;font-weight:600;color:#374151;margin:12px 0 5px;';
}
function _detayInputStyle() {
  return 'width:100%;box-sizing:border-box;padding:12px 14px;font-size:15px;' +
    'border:1px solid #d1d5db;border-radius:12px;background:#fff;outline:none;display:block;';
}

// ── Ödünç / İade ──────────────────────────────────────────────────────────
async function loanBook(id) {
  listeMesajTemizle();

  const borrower = prompt('Kitabı kime veriyorsun?');
  if (borrower === null) return;

  const cleanBorrower = borrower.trim();
  if (!cleanBorrower) {
    listeMesaj('Ödünç alan kişi adı zorunlu', 'warn');
    return;
  }

  try {
    const result = await apiPost({
      action: 'loanBook',
      id,
      borrower: cleanBorrower
    });

    if (!result.ok) {
      listeMesaj(result.error || 'Ödünç verme hatası', 'error');
      return;
    }

    listeMesaj(result.message || 'Kitap ödünç verildi', 'success');
    await loadBooks();
  } catch (err) {
    listeMesaj('Ödünç verme hatası: ' + err.message, 'error');
  }
}

async function returnBook(id) {
  listeMesajTemizle();

  try {
    const result = await apiPost({
      action: 'returnBook',
      id
    });

    if (!result.ok) {
      listeMesaj(result.error || 'İade hatası', 'error');
      return;
    }

    listeMesaj(result.message || 'Kitap iade alındı', 'success');
    await loadBooks();
  } catch (err) {
    listeMesaj('İade hatası: ' + err.message, 'error');
  }
}

loadBooks();
