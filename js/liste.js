// js/liste.js — v69
// v69: 4 düzeltme
//   1. ADET: _normIsbn() — temizIsbn/KutuphaneCamera bağımlılığı kaldırıldı,
//            tüm sayım tek tutarlı fonksiyonla; console.log ile debug
//   2. KAPAT: detay panelde sticky footer büyük Kapat butonu (mobil thumb-friendly)
//   3. AUTOCOMPLETE: yazar + yayınevi inputları için akıllı dropdown (detayAc)
//   4. AUTOCOMPLETE: ödünç alan inputu için geçmiş kişi önerileri (_oduncModalGoster)
// v68: loanBook modal, ISBN detayda, A-Z kompakt, ayarlar entegrasyonu
// v67: Tam UX yenileme — liste ekranı
// v65: ISBN normalize, flex-column panel
// v63: kapakHtml localStorage, detayAc overlay, bookUpdate

// ── State ─────────────────────────────────────────────────────────────────
let books = [];
let durumFiltre = { 'RAFTA': true, 'ÖDÜNÇTE': true };

const TR_ALFABE = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

// ── ISBN Normalize — YEREL, temizIsbn'den bağımsız ───────────────────────
// Root cause fix: temizIsbn → KutuphaneCamera.temizKod zincirini bypass eder.
// _isbnSayimHesapla, renderList ve detayAc hep bu fonksiyonu kullanır → tutarlı key.
function _normIsbn(raw) {
  return String(raw || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
}

// ── Yardımcılar ───────────────────────────────────────────────────────────
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
  const temiz = _normIsbn(isbn);
  if (!temiz) return '';
  return 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(temiz) + '-M.jpg';
}

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

// ISBN sayım — _normIsbn ile tutarlı, temizIsbn'e bağımlılık YOK
function _isbnSayimHesapla(kitaplar) {
  const sayim = {};
  for (const b of kitaplar) {
    const isbn = _normIsbn(b.isbn);
    if (!isbn) continue;
    sayim[isbn] = (sayim[isbn] || 0) + 1;
  }
  return sayim;
}

// ── Autocomplete ──────────────────────────────────────────────────────────
// position:fixed kullanır → overflow-y:auto klipleme sorununu aşar
function _autocompleteSetup(inputEl, suggestions) {
  if (!inputEl || !suggestions || !suggestions.length) return;

  // Eski dropdown varsa temizle
  document.querySelectorAll('._acDrop[data-forinput="' + inputEl.id + '"]').forEach(d => d.remove());

  const drop = document.createElement('div');
  drop.className = '_acDrop';
  drop.dataset.forinput = inputEl.id;
  drop.style.cssText = [
    'display:none;position:fixed;',
    'background:#fff;',
    'border:1.5px solid #d1d5db;border-radius:12px;',
    'box-shadow:0 6px 20px rgba(0,0,0,0.14);',
    'z-index:9900;',
    'max-height:180px;overflow-y:auto;'
  ].join('');
  document.body.appendChild(drop);

  function _reposition() {
    const r = inputEl.getBoundingClientRect();
    drop.style.top   = (r.bottom + 3) + 'px';
    drop.style.left  = r.left + 'px';
    drop.style.width = r.width + 'px';
  }

  function _showDrop(items) {
    if (!items.length) { drop.style.display = 'none'; return; }
    drop.innerHTML = items.slice(0, 8).map(item =>
      `<div style="padding:10px 14px;font-size:14px;cursor:pointer;
                   border-bottom:1px solid #f3f4f6;color:#111;
                   -webkit-tap-highlight-color:transparent;"
           data-val="${safeAttr(item)}">${guvenliYazi(item)}</div>`
    ).join('');
    drop.style.display = 'block';
    _reposition();

    drop.querySelectorAll('[data-val]').forEach(el => {
      function _pick() {
        inputEl.value = el.dataset.val;
        drop.style.display = 'none';
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.addEventListener('mousedown',  (e) => { e.preventDefault(); _pick(); });
      el.addEventListener('touchstart', (e) => { e.preventDefault(); _pick(); }, { passive: false });
    });
  }

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLocaleLowerCase('tr');
    if (!q) { drop.style.display = 'none'; return; }
    _showDrop(suggestions.filter(s => s.toLocaleLowerCase('tr').includes(q)));
  });

  inputEl.addEventListener('focus', () => {
    const q = inputEl.value.trim().toLocaleLowerCase('tr');
    if (q) _showDrop(suggestions.filter(s => s.toLocaleLowerCase('tr').includes(q)));
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => { drop.style.display = 'none'; }, 220);
  });
}

// Tüm _acDrop'ları temizle (overlay kapanınca çağrılır)
function _autocompleteTemizle() {
  document.querySelectorAll('._acDrop').forEach(d => d.remove());
}

// ── Üst Bar: Durum Filtresi ───────────────────────────────────────────────
function _topBarRender() {
  const r = document.getElementById('filtrRafta');
  const o = document.getElementById('filtrOdunc');
  if (r) {
    r.style.background = durumFiltre['RAFTA'] ? '#047857' : '#374151';
    r.style.color      = '#fff';
    r.style.opacity    = durumFiltre['RAFTA'] ? '1' : '0.45';
  }
  if (o) {
    o.style.background = durumFiltre['ÖDÜNÇTE'] ? '#b91c1c' : '#374151';
    o.style.color      = '#fff';
    o.style.opacity    = durumFiltre['ÖDÜNÇTE'] ? '1' : '0.45';
  }
}

function _toggleDurum(durum) {
  durumFiltre[durum] = !durumFiltre[durum];
  _topBarRender();
  renderList();
}

// ── A-Z Bar ───────────────────────────────────────────────────────────────
function _azBarKur() {
  const bar = document.getElementById('azBar');
  if (!bar) return;

  bar.innerHTML = TR_ALFABE.split('').map(h =>
    `<span class="azLetter" data-harf="${h}">${h}</span>`
  ).join('');

  bar.addEventListener('touchstart', _azTouch, { passive: false });
  bar.addEventListener('touchmove',  _azTouch, { passive: false });
  bar.addEventListener('touchend',   _azTouchEnd, { passive: false });

  bar.querySelectorAll('.azLetter').forEach(el => {
    el.addEventListener('click', () => {
      _jumpToLetter(el.dataset.harf);
      _harfOverlayGoster(el.dataset.harf);
    });
  });
}

let _azOverlayTimer = null;

function _azTouch(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const bar   = document.getElementById('azBar');
  if (!bar) return;
  const rect     = bar.getBoundingClientRect();
  const y        = Math.max(0, Math.min(rect.height, touch.clientY - rect.top));
  const fraction = y / rect.height;
  const idx      = Math.min(TR_ALFABE.length - 1, Math.floor(fraction * TR_ALFABE.length));
  const harf     = TR_ALFABE[idx];
  _jumpToLetter(harf);
  _harfOverlayGoster(harf);
}

function _azTouchEnd() {
  clearTimeout(_azOverlayTimer);
  _azOverlayTimer = setTimeout(() => {
    const overlay = document.getElementById('azOverlay');
    if (overlay) overlay.style.display = 'none';
  }, 600);
}

function _jumpToLetter(harf) {
  const cards = document.querySelectorAll('#list [data-kitap-adi]');
  for (const card of cards) {
    const adi = (card.dataset.kitapAdi || '').toLocaleUpperCase('tr');
    if (adi.startsWith(harf)) {
      const rect      = card.getBoundingClientRect();
      const scrollTop = window.pageYOffset + rect.top - 120;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      return;
    }
  }
}

function _harfOverlayGoster(harf) {
  const overlay = document.getElementById('azOverlay');
  if (!overlay) return;
  overlay.textContent   = harf;
  overlay.style.display = 'flex';
  clearTimeout(_azOverlayTimer);
  _azOverlayTimer = setTimeout(() => {
    overlay.style.display = 'none';
  }, 800);
}

// ── Yükleme ───────────────────────────────────────────────────────────────
async function loadBooks() {
  listeMesajTemizle();
  try {
    books = await tumKitaplariGetir();
    // DEBUG: Konsola yazdır — tarayıcı konsolunda kontrol et
    const dbg = _isbnSayimHesapla(books);
    console.log('[liste] books:', books.length, '| isbnSayim:', JSON.stringify(dbg));
    renderList();
  } catch (err) {
    listeMesaj('Liste hatası: ' + err.message, 'error');
  }
}

// ── Render ────────────────────────────────────────────────────────────────
function renderList() {
  const q    = (document.getElementById('search')?.value || '').trim().toLocaleLowerCase('tr');
  const list = document.getElementById('list');
  if (!list) return;

  let filtered = books.filter(book => {
    if (!q) return true;
    return (
      (book.kitapAdi || '').toLocaleLowerCase('tr').includes(q) ||
      (book.yazar    || '').toLocaleLowerCase('tr').includes(q) ||
      (book.yayinevi || '').toLocaleLowerCase('tr').includes(q)
    );
  });

  filtered = filtered.filter(book => {
    const d = String(book.durum || 'RAFTA').toUpperCase();
    if (d === 'ÖDÜNÇTE') return durumFiltre['ÖDÜNÇTE'];
    return durumFiltre['RAFTA'];
  });

  filtered = [...filtered].sort((a, b) =>
    (a.kitapAdi || '').toLocaleLowerCase('tr').localeCompare(
      (b.kitapAdi || '').toLocaleLowerCase('tr'), 'tr'
    )
  );

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">Kayıtlı kitap bulunamadı</div>';
    return;
  }

  // ISBN sayımı — _normIsbn ile, tüm books üzerinden (filtresiz)
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

    // _normIsbn — temizIsbn kullanmıyor, doğrudan local fonksiyon
    const isbnKey    = _normIsbn(book.isbn);
    const adetSayisi = isbnKey ? (isbnSayim[isbnKey] || 1) : 0;

    const adetBadge = isbnKey
      ? `<span style="
            display:inline-block;margin-bottom:5px;
            background:#dbeafe;color:#1d4ed8;
            padding:2px 8px;border-radius:999px;
            font-size:11px;font-weight:700;
          ">📚 ${adetSayisi} adet</span>`
      : `<span style="
            display:inline-block;margin-bottom:5px;
            background:#f3f4f6;color:#9ca3af;
            padding:2px 8px;border-radius:999px;
            font-size:11px;font-weight:600;
          ">📌 ISBN yok</span>`;

    return `
      <div class="card" data-kitap-adi="${safeAttr(book.kitapAdi || '')}">
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

// ── Detay Overlay ─────────────────────────────────────────────────────────
function detayAc(id) {
  const book = books.find(b => Number(b.id) === Number(id));
  if (!book) return;

  const durum      = String(book.durum || 'RAFTA').toUpperCase();
  const localKapak = localStorage.getItem('kapak_' + book.id);

  const kapakSrc = localKapak
    ? safeAttr(localKapak)
    : book.isbn
      ? safeAttr('https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(_normIsbn(book.isbn)) + '-M.jpg')
      : '';

  const statusClass = durum === 'ÖDÜNÇTE' ? 'oduncte' : durum === 'KAYIP' ? 'kayip' : 'rafta';

  const loanBtn   = durum === 'RAFTA'
    ? `<button onclick="detayKapat();loanBook(${Number(book.id)})" style="${_detayBtnStyle('#0b57d0')}">📤 Ödünç Ver</button>`
    : '';
  const returnBtn = durum === 'ÖDÜNÇTE'
    ? `<button onclick="returnBook(${Number(book.id)});detayKapat()" style="${_detayBtnStyle('#047857')}">📥 İade Al</button>`
    : '';

  // Adet — _normIsbn ile, tutarlı
  const isbnKey    = _normIsbn(book.isbn);
  const isbnSayim  = _isbnSayimHesapla(books);
  const adetSayisi = isbnKey ? (isbnSayim[isbnKey] || 1) : 0;

  const adetSatiri = isbnKey
    ? `<div style="
          display:inline-flex;align-items:center;gap:5px;
          background:#dbeafe;color:#1d4ed8;
          padding:4px 10px;border-radius:999px;
          font-size:12px;font-weight:700;margin-bottom:8px;
        ">📚 Toplam ${adetSayisi} adet</div>`
    : `<div style="
          display:inline-flex;align-items:center;gap:5px;
          background:#f3f4f6;color:#9ca3af;
          padding:4px 10px;border-radius:999px;
          font-size:12px;font-weight:600;margin-bottom:8px;
        ">📌 ISBN yok</div>`;

  const isbnSatiri = book.isbn
    ? `<div style="font-size:13px;color:#6b7280;margin-bottom:6px;font-family:monospace;">ISBN: ${guvenliYazi(book.isbn)}</div>`
    : '';

  // Autocomplete için veri (duplicate filter)
  const yazarOneriler    = [...new Set(books.map(b => b.yazar   ).filter(Boolean))].sort((a,b) => a.localeCompare(b,'tr'));
  const yayiOneriler     = [...new Set(books.map(b => b.yayinevi).filter(Boolean))].sort((a,b) => a.localeCompare(b,'tr'));

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

      <!-- ── Header (sticky, scroll edilemez) ── -->
      <div style="
        flex-shrink:0;
        background:#fff;border-radius:22px 22px 0 0;
        display:flex;align-items:center;justify-content:space-between;
        padding:12px 16px 10px;
        border-bottom:1px solid #f3f4f6;
      ">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:4px;border-radius:2px;background:#d1d5db"></div>
          <span style="font-size:15px;font-weight:700;color:#111">Kitap Detayı</span>
        </div>
        <button onclick="detayKapat()" style="
          width:36px;height:36px;border:none;border-radius:50%;
          background:#f3f4f6;color:#374151;font-size:18px;
          cursor:pointer;display:flex;align-items:center;justify-content:center;
          -webkit-tap-highlight-color:transparent;
        ">✕</button>
      </div>

      <!-- ── Scrollable içerik ── -->
      <div style="flex:1;overflow-y:auto;padding:0 0 4px 0;">

        <!-- Kapak + üst bilgi -->
        <div style="display:flex;gap:16px;align-items:flex-start;padding:16px 18px">
          <div style="flex-shrink:0;position:relative;cursor:pointer"
               onclick="document.getElementById('detayKapakInput').click()"
               title="Kapak fotoğrafı ekle">
            ${kapakSrc
              ? `<img id="detayKapakImg" src="${kapakSrc}" alt="Kapak"
                  style="width:80px;height:116px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;display:block;"
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
            ${isbnSatiri}
            <span class="status ${statusClass}" style="font-size:12px;padding:5px 10px">${guvenliYazi(durum)}</span>
          </div>
        </div>

        <!-- Eylem butonları -->
        ${(loanBtn || returnBtn)
          ? `<div style="display:grid;grid-template-columns:${loanBtn && returnBtn ? '1fr 1fr' : '1fr'};gap:8px;padding:0 18px 14px">${loanBtn}${returnBtn}</div>`
          : ''}

        <!-- Düzenleme formu -->
        <div style="padding:0 18px 18px">
          <div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Bilgileri Düzenle</div>

          <label style="${_detayLabelStyle()}">Kitap Adı</label>
          <input id="detayEditAdi" type="text" value="${safeAttr(book.kitapAdi || '')}" style="${_detayInputStyle()}" autocomplete="off">

          <label style="${_detayLabelStyle()}">Yazar</label>
          <div style="position:relative">
            <input id="detayEditYazar" type="text" value="${safeAttr(book.yazar || '')}" style="${_detayInputStyle()}" autocomplete="off">
          </div>

          <label style="${_detayLabelStyle()}">Yayınevi</label>
          <div style="position:relative">
            <input id="detayEditYayinevi" type="text" value="${safeAttr(book.yayinevi || '')}" style="${_detayInputStyle()}" autocomplete="off">
          </div>

          <label style="${_detayLabelStyle()}">Yayın Yılı</label>
          <input id="detayEditYil" type="text" value="${safeAttr(book.yayinYili || '')}" style="${_detayInputStyle()}" autocomplete="off">

          <label style="${_detayLabelStyle()}">Not</label>
          <textarea id="detayEditNot" style="${_detayInputStyle()}min-height:80px;resize:vertical;">${guvenliYazi(book.not || '')}</textarea>

          <div id="detayMesaj" style="display:none;margin-top:10px;padding:10px 14px;border-radius:10px;font-size:15px;font-weight:bold"></div>

          <button onclick="detayKaydet(${Number(book.id)})" style="${_detayBtnStyle('#047857')}margin-top:14px;">💾 Kaydet</button>
        </div>

      </div><!-- /scrollable -->

      <!-- ── Footer: Kapat butonu — sticky, her zaman görünür ── -->
      <div style="
        flex-shrink:0;
        padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
        border-top:1px solid #f3f4f6;
        background:#fff;
      ">
        <button onclick="detayKapat()" style="
          display:block;width:100%;padding:15px;
          font-size:17px;font-weight:700;
          border:none;border-radius:14px;
          background:#1f2937;color:#fff;cursor:pointer;
          -webkit-tap-highlight-color:transparent;
          letter-spacing:0.3px;
        ">✕ Kapat</button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // Açılış animasyonu
  const panel = overlay.querySelector('#detayPanel');
  if (panel) {
    panel.style.transform  = 'translateY(100%)';
    panel.style.transition = 'transform 0.25s ease';
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });
  }

  // Autocomplete kurulumu (DOM'a eklendikten sonra)
  _autocompleteSetup(document.getElementById('detayEditYazar'),    yazarOneriler);
  _autocompleteSetup(document.getElementById('detayEditYayinevi'), yayiOneriler);
}

function detayKapat() {
  _autocompleteTemizle();
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
  const adiEl   = document.getElementById('detayEditAdi');
  const yazarEl = document.getElementById('detayEditYazar');
  const yayEl   = document.getElementById('detayEditYayinevi');
  const yilEl   = document.getElementById('detayEditYil');
  const notEl   = document.getElementById('detayEditNot');
  const mesajEl = document.getElementById('detayMesaj');

  const _bh = typeof basHarfBuyut === 'function' ? basHarfBuyut : function(s) { return s; };
  const adi   = _bh((adiEl?.value   || '').trim());
  const yazar = _bh((yazarEl?.value || '').trim());

  if (!adi || !yazar) {
    if (mesajEl) {
      mesajEl.style.display    = 'block';
      mesajEl.style.background = '#fee2e2';
      mesajEl.style.color      = '#991b1b';
      mesajEl.textContent      = 'Kitap adı ve yazar zorunlu';
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
        mesajEl.style.display    = 'block';
        mesajEl.style.background = '#fee2e2';
        mesajEl.style.color      = '#991b1b';
        mesajEl.textContent      = result.error || 'Kayıt hatası';
      }
      return;
    }
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
      mesajEl.style.display    = 'block';
      mesajEl.style.background = '#fee2e2';
      mesajEl.style.color      = '#991b1b';
      mesajEl.textContent      = 'Kayıt hatası: ' + err.message;
    }
  }
}

function detayKapakSecildi(bookId, inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    localStorage.setItem('kapak_' + bookId, dataUrl);
    const img = document.getElementById('detayKapakImg');
    if (img && img.tagName === 'IMG') {
      img.src = dataUrl;
    } else if (img) {
      const newImg = document.createElement('img');
      newImg.id = 'detayKapakImg';
      newImg.src = dataUrl;
      newImg.style.cssText = 'width:80px;height:116px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;display:block;';
      img.replaceWith(newImg);
    }
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

// ── Ödünç Modal ───────────────────────────────────────────────────────────
function _oduncModalGoster(defaultGun) {
  return new Promise((resolve) => {
    const old = document.getElementById('oduncOverlay');
    if (old) old.remove();

    // Geçmiş ödünç alanlar — autocomplete için
    const oduncAlanlar = [...new Set(books.map(b => b.oduncAlan).filter(Boolean))].sort((a,b) => a.localeCompare(b,'tr'));

    const overlay = document.createElement('div');
    overlay.id = 'oduncOverlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:3000;',
      'background:rgba(0,0,0,0.55);',
      'display:flex;align-items:flex-end;justify-content:center;'
    ].join('');

    overlay.innerHTML = `
      <div id="oduncPanel" style="
        background:#fff;border-radius:22px 22px 0 0;
        width:100%;max-width:500px;
        display:flex;flex-direction:column;
        box-shadow:0 -8px 32px rgba(0,0,0,0.18);
      ">
        <!-- Header -->
        <div style="
          flex-shrink:0;
          padding:14px 16px 12px;
          border-bottom:1px solid #f3f4f6;
          display:flex;align-items:center;gap:10px;
        ">
          <div style="width:36px;height:4px;border-radius:2px;background:#d1d5db"></div>
          <span style="font-size:16px;font-weight:700;color:#111">📤 Ödünç Ver</span>
        </div>

        <!-- Form -->
        <div style="padding:16px 20px 8px;overflow-y:auto;">
          <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">
            Ödünç Alan
          </label>
          <input
            id="oduncAlanInput"
            type="text"
            placeholder="Kişi adı..."
            autocomplete="off"
            autocapitalize="words"
            style="
              width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;
              border:1.5px solid #d1d5db;border-radius:12px;background:#fff;outline:none;
              display:block;margin-bottom:16px;
            "
          >

          <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">
            Kaç Gün Ödünç?
          </label>
          <input
            id="oduncGunInput"
            type="number"
            min="1"
            max="365"
            value="${Number(defaultGun) || 15}"
            style="
              width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;
              border:1.5px solid #d1d5db;border-radius:12px;background:#fff;outline:none;
              display:block;margin-bottom:6px;
            "
          >
          <div id="oduncIadeTarihGoster" style="font-size:13px;color:#6b7280;margin-bottom:12px;min-height:18px;"></div>

          <div id="oduncMesaj" style="
            display:none;padding:10px 14px;border-radius:10px;
            font-size:14px;font-weight:bold;margin-bottom:10px;
            background:#fee2e2;color:#991b1b;
          "></div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:0">
            <button id="oduncIptalBtn" style="
              border:none;border-radius:12px;padding:15px;
              font-size:15px;font-weight:bold;
              background:#f3f4f6;color:#374151;cursor:pointer;
              -webkit-tap-highlight-color:transparent;
            ">İptal</button>
            <button id="oduncOnayBtn" style="
              border:none;border-radius:12px;padding:15px;
              font-size:15px;font-weight:bold;
              background:#0b57d0;color:#fff;cursor:pointer;
              -webkit-tap-highlight-color:transparent;
            ">Ödünç Ver</button>
          </div>
        </div>

        <!-- Footer safe area -->
        <div style="flex-shrink:0;height:calc(env(safe-area-inset-bottom,0px) + 16px)"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Açılış animasyonu
    const panel = overlay.querySelector('#oduncPanel');
    panel.style.transform  = 'translateY(100%)';
    panel.style.transition = 'transform 0.25s ease';
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });

    // Autocomplete — geçmiş ödünç alanlar
    _autocompleteSetup(document.getElementById('oduncAlanInput'), oduncAlanlar);

    // İlk odak
    setTimeout(() => document.getElementById('oduncAlanInput')?.focus(), 320);

    // İade tarihi güncelle
    function _guncelleIadeTarih() {
      const gun = parseInt(document.getElementById('oduncGunInput')?.value, 10) || 0;
      const el  = document.getElementById('oduncIadeTarihGoster');
      if (!el) return;
      if (gun > 0) {
        const d = new Date();
        d.setDate(d.getDate() + gun);
        el.textContent = `İade tarihi: ${d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}`;
      } else {
        el.textContent = '';
      }
    }
    _guncelleIadeTarih();
    document.getElementById('oduncGunInput')?.addEventListener('input', _guncelleIadeTarih);

    function _kapat(result) {
      _autocompleteTemizle();
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => overlay.remove(), 250);
      resolve(result);
    }

    document.getElementById('oduncIptalBtn').addEventListener('click', () => _kapat(null));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _kapat(null); });

    function _onay() {
      const borrower = (document.getElementById('oduncAlanInput')?.value || '').trim();
      const gun      = parseInt(document.getElementById('oduncGunInput')?.value, 10);
      const mesajEl  = document.getElementById('oduncMesaj');

      if (!borrower) {
        if (mesajEl) { mesajEl.style.display = 'block'; mesajEl.textContent = 'Ödünç alan kişi adı zorunlu'; }
        document.getElementById('oduncAlanInput')?.focus();
        return;
      }
      if (!gun || gun < 1 || gun > 365) {
        if (mesajEl) { mesajEl.style.display = 'block'; mesajEl.textContent = 'Gün sayısı 1–365 arasında olmalı'; }
        document.getElementById('oduncGunInput')?.focus();
        return;
      }
      _kapat({ borrower, gun });
    }

    document.getElementById('oduncOnayBtn').addEventListener('click', _onay);
    document.getElementById('oduncAlanInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('oduncGunInput')?.focus();
    });
    document.getElementById('oduncGunInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _onay();
    });
  });
}

// ── Ödünç / İade ──────────────────────────────────────────────────────────
async function loanBook(id) {
  listeMesajTemizle();

  let defaultGun = 15;
  try {
    const userKey = typeof getUserKey === 'function' ? getUserKey() : 'demo-user';
    const s = await apiPost({ action: 'settingsGet', userKey });
    if (s.ok && s.data && s.data.oduncGunSayisi > 0) defaultGun = s.data.oduncGunSayisi;
  } catch (_) {}

  const sonuc = await _oduncModalGoster(defaultGun);
  if (!sonuc) return;

  const { borrower, gun } = sonuc;
  const iadeGun = new Date();
  iadeGun.setDate(iadeGun.getDate() + gun);
  const returnDate = iadeGun.toISOString().slice(0, 10);

  try {
    const result = await apiPost({ action: 'loanBook', id, borrower, returnDate });
    if (!result.ok) { listeMesaj(result.error || 'Ödünç verme hatası', 'error'); return; }
    listeMesaj(result.message || 'Kitap ödünç verildi', 'success');
    await loadBooks();
  } catch (err) {
    listeMesaj('Ödünç verme hatası: ' + err.message, 'error');
  }
}

async function returnBook(id) {
  listeMesajTemizle();
  try {
    const result = await apiPost({ action: 'returnBook', id });
    if (!result.ok) { listeMesaj(result.error || 'İade hatası', 'error'); return; }
    listeMesaj(result.message || 'Kitap iade alındı', 'success');
    await loadBooks();
  } catch (err) {
    listeMesaj('İade hatası: ' + err.message, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
(function _init() {
  const filtrRafta = document.getElementById('filtrRafta');
  const filtrOdunc = document.getElementById('filtrOdunc');
  if (filtrRafta) filtrRafta.addEventListener('click', () => _toggleDurum('RAFTA'));
  if (filtrOdunc) filtrOdunc.addEventListener('click', () => _toggleDurum('ÖDÜNÇTE'));

  const scrollTopBtn = document.getElementById('scrollTopBtn');
  if (scrollTopBtn) scrollTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', renderList);
    searchInput.addEventListener('keyup',  renderList);
  }

  _topBarRender();
  _azBarKur();
  loadBooks();
})();
