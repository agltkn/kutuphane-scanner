// js/liste.js — v84
// v84: Detay ekranı UI iyileştirmeleri
//   1. Kopya durumu renkleri: RAFTA=yeşil, ÖDÜNÇTE=sarı (kırmızıdan değiştirildi)
//   2. Per-kopya İade butonu: window.confirm() onayı eklendi (önce sormadan iade etmiyordu)
//   3. Detay başlık: kitap adı daha büyük/kalın (24px/800), yazar normal, ISBN küçük+gri
// v83: İade seçim modali multi-select + onay butonu
//   1. _iadeSecimModal: tıklama artık direkt iade yapmaz, toggle seçim yapar
//   2. Seçili satırlar: yeşil arka plan + ✓ işareti
//   3. Alt butonlar: [İptal] | [İade Al (X)] — X = seçili sayısı
//   4. "İade Al" butonu seçim yoksa disabled
//   5. returnBook: her zaman modal açılır (tek kopya dahil), seçilen tümü iade edilir
// v82: ASCII-safe durum karşılaştırması (_durumNorm → 'ODUNCTE')
// v81: Detay kopya satır aralığı azaltıldı (5px 8px / 2px)
// v80: UI ve akış düzeltmeleri
// v79: ISBN bazlı gruplama

// ── State ─────────────────────────────────────────────────────────────────
let books     = [];
let gruplar   = [];
let _dispGrup = [];
let _detayGrupIdx = -1;

let durumFiltre = { 'RAFTA': true, 'ODUNCTE': true };

const TR_ALFABE = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';

// ── Durum normalize ────────────────────────────────────────────────────────
function _durumNorm(raw) {
  const s = String(raw || '').trim();
  if (!s || s.toUpperCase() === 'RAFTA') return 'RAFTA';
  if (s.toUpperCase() === 'KAYIP')       return 'KAYIP';
  const c0 = s.charCodeAt(0);
  if (c0 === 214 || c0 === 246) return 'ODUNCTE';
  if (s.toUpperCase().indexOf('D\u00DCN') !== -1) return 'ODUNCTE';
  return 'RAFTA';
}

// ── ISBN Normalize ─────────────────────────────────────────────────────────
function _normIsbn(raw) {
  return String(raw || '').toUpperCase().replace(/[^0-9X]/g, '').trim();
}

// ── Gruplama ──────────────────────────────────────────────────────────────
function _grupla(kitaplar) {
  const map = new Map();
  for (const b of kitaplar) {
    const isbn = _normIsbn(b.isbn);
    const fallback = [
      String(b.kitapAdi || '').toLocaleLowerCase('tr').trim(),
      String(b.yazar    || '').toLocaleLowerCase('tr').trim(),
      String(b.yayinevi || '').toLocaleLowerCase('tr').trim()
    ].join('||');
    const key = isbn || fallback || ('id:' + b.id);
    if (!map.has(key)) {
      map.set(key, {
        grupKey:   key,
        isbn:      b.isbn      || '',
        kitapAdi:  b.kitapAdi  || '',
        yazar:     b.yazar     || '',
        yayinevi:  b.yayinevi  || '',
        yayinYili: b.yayinYili || '',
        kopya:  [],
        toplam: 0, rafta: 0, oduncte: 0, kayip: 0
      });
    }
    const g = map.get(key);
    const normDurum = _durumNorm(b.durum);
    g.kopya.push(Object.assign({}, b, { durum: normDurum }));
    g.toplam++;
    if      (normDurum === 'ODUNCTE') g.oduncte++;
    else if (normDurum === 'KAYIP')   g.kayip++;
    else                              g.rafta++;
  }
  return [...map.values()];
}

// ── Yardımcılar ───────────────────────────────────────────────────────────
function safeAttr(text) {
  return String(text || '')
    .replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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

function _kapakHtmlGrup(g) {
  const ilkId = g.kopya[0]?.id;
  const local = ilkId ? localStorage.getItem('kapak_' + ilkId) : null;
  if (local) return `<img class="coverImg" src="${safeAttr(local)}" alt="Kapak" loading="lazy">`;
  const url = kapakUrlOlustur(g.isbn);
  if (!url) return `<div class="coverPlaceholder">📘</div>`;
  return `<img class="coverImg" src="${safeAttr(url)}" alt="Kapak" loading="lazy"
    referrerpolicy="no-referrer"
    onerror="this.outerHTML='<div class=&quot;coverPlaceholder&quot;>📘</div>'">`;
}

function _durumBadge(g) {
  const p = [];
  if (g.rafta   > 0) p.push(g.rafta   + ' Rafta');
  if (g.oduncte > 0) p.push(g.oduncte + ' Ödünçte');
  if (g.kayip   > 0) p.push(g.kayip   + ' Kayıp');
  let bg, fg;
  if      (g.oduncte > 0 && g.rafta === 0 && g.kayip === 0) { bg = '#fee2e2'; fg = '#991b1b'; }
  else if (g.oduncte > 0 || g.kayip > 0)                    { bg = '#fef3c7'; fg = '#92400e'; }
  else                                                        { bg = '#d1fae5'; fg = '#065f46'; }
  return { tekst: p.join(' • '), bg, fg };
}

// ── Stil yardımcıları ─────────────────────────────────────────────────────
function _detayLabelStyle() {
  return 'display:block;font-size:14px;font-weight:600;color:#374151;margin:12px 0 5px;';
}
function _detayInputStyle() {
  return 'width:100%;box-sizing:border-box;padding:12px 14px;font-size:15px;' +
    'border:1px solid #d1d5db;border-radius:12px;background:#fff;outline:none;display:block;';
}

// ── Autocomplete ──────────────────────────────────────────────────────────
function _autocompleteSetup(inputEl, suggestions) {
  if (!inputEl || !suggestions || !suggestions.length) return;
  document.querySelectorAll('._acDrop[data-forinput="' + inputEl.id + '"]').forEach(d => d.remove());
  const drop = document.createElement('div');
  drop.className = '_acDrop';
  drop.dataset.forinput = inputEl.id;
  drop.style.cssText = 'display:none;position:fixed;background:#fff;' +
    'border:1.5px solid #d1d5db;border-radius:12px;' +
    'box-shadow:0 6px 20px rgba(0,0,0,0.14);z-index:9900;max-height:180px;overflow-y:auto;';
  document.body.appendChild(drop);

  function _reposition() {
    const r = inputEl.getBoundingClientRect();
    drop.style.top = (r.bottom + 3) + 'px';
    drop.style.left = r.left + 'px';
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
      el.addEventListener('mousedown',  e => { e.preventDefault(); _pick(); });
      el.addEventListener('touchstart', e => { e.preventDefault(); _pick(); }, { passive: false });
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
  inputEl.addEventListener('blur', () => { setTimeout(() => { drop.style.display = 'none'; }, 220); });
}

function _autocompleteTemizle() {
  document.querySelectorAll('._acDrop').forEach(d => d.remove());
}

// ── Üst Bar ───────────────────────────────────────────────────────────────
function _topBarRender() {
  const r = document.getElementById('filtrRafta');
  const o = document.getElementById('filtrOdunc');
  if (r) { r.style.background = durumFiltre['RAFTA']   ? '#047857' : '#374151'; r.style.color = '#fff'; r.style.opacity = durumFiltre['RAFTA']   ? '1' : '0.45'; }
  if (o) { o.style.background = durumFiltre['ODUNCTE'] ? '#b91c1c' : '#374151'; o.style.color = '#fff'; o.style.opacity = durumFiltre['ODUNCTE'] ? '1' : '0.45'; }
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
  bar.addEventListener('touchstart', _azTouch,    { passive: false });
  bar.addEventListener('touchmove',  _azTouch,    { passive: false });
  bar.addEventListener('touchend',   _azTouchEnd, { passive: false });
  bar.querySelectorAll('.azLetter').forEach(el =>
    el.addEventListener('click', () => { _jumpToLetter(el.dataset.harf); _harfOverlayGoster(el.dataset.harf); })
  );
}

let _azOverlayTimer = null;

function _azTouch(e) {
  e.preventDefault();
  const bar = document.getElementById('azBar');
  if (!bar) return;
  const touch    = e.touches[0];
  const rect     = bar.getBoundingClientRect();
  const y        = Math.max(0, Math.min(rect.height, touch.clientY - rect.top));
  const idx      = Math.min(TR_ALFABE.length - 1, Math.floor((y / rect.height) * TR_ALFABE.length));
  _jumpToLetter(TR_ALFABE[idx]);
  _harfOverlayGoster(TR_ALFABE[idx]);
}

function _azTouchEnd() {
  clearTimeout(_azOverlayTimer);
  _azOverlayTimer = setTimeout(() => {
    const ov = document.getElementById('azOverlay');
    if (ov) ov.style.display = 'none';
  }, 600);
}

function _jumpToLetter(harf) {
  const cards = document.querySelectorAll('#list [data-kitap-adi]');
  for (const card of cards) {
    if ((card.dataset.kitapAdi || '').toLocaleUpperCase('tr').startsWith(harf)) {
      window.scrollTo({ top: Math.max(0, window.pageYOffset + card.getBoundingClientRect().top - 120), behavior: 'smooth' });
      return;
    }
  }
}

function _harfOverlayGoster(harf) {
  const ov = document.getElementById('azOverlay');
  if (!ov) return;
  ov.textContent = harf;
  ov.style.display = 'flex';
  clearTimeout(_azOverlayTimer);
  _azOverlayTimer = setTimeout(() => { ov.style.display = 'none'; }, 800);
}

// ── Yükleme ───────────────────────────────────────────────────────────────
async function loadBooks() {
  listeMesajTemizle();
  try {
    books   = await tumKitaplariGetir();
    gruplar = _grupla(books);
    console.log('[liste] books:', books.length, '| gruplar:', gruplar.length);
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

  let filtered = gruplar.filter(g => {
    const durumOk = (durumFiltre['RAFTA'] && g.rafta > 0) || (durumFiltre['ODUNCTE'] && g.oduncte > 0);
    if (!durumOk) return false;
    if (!q) return true;
    return (
      (g.kitapAdi || '').toLocaleLowerCase('tr').includes(q) ||
      (g.yazar    || '').toLocaleLowerCase('tr').includes(q) ||
      (g.yayinevi || '').toLocaleLowerCase('tr').includes(q) ||
      (g.isbn     || '').includes(q)
    );
  });

  filtered = [...filtered].sort((a, b) =>
    (a.kitapAdi || '').toLocaleLowerCase('tr').localeCompare((b.kitapAdi || '').toLocaleLowerCase('tr'), 'tr')
  );

  _dispGrup = filtered;

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">Kayıtlı kitap bulunamadı</div>';
    return;
  }

  list.innerHTML = filtered.map((g, i) => {
    const badge = _durumBadge(g);

    const loanBtn = g.rafta > 0
      ? `<button class="btn btnLoan"     onclick="event.stopPropagation();loanBook(${i})">📤 Ödünç Ver</button>`
      : `<button class="btn btnDisabled" disabled>Ödünç Verilemez</button>`;

    const retBtn = g.oduncte > 0
      ? `<button class="btn btnReturn"   onclick="event.stopPropagation();returnBook(${i})">📥 İade Al</button>`
      : `<button class="btn btnDisabled" disabled>İade Beklemiyor</button>`;

    return `
      <div class="card" data-kitap-adi="${safeAttr(g.kitapAdi || '')}">
        <div class="cardTop" onclick="detayAc(${i})" style="cursor:pointer">
          <div class="coverWrap">${_kapakHtmlGrup(g)}</div>
          <div class="cardBody">
            <span style="display:inline-flex;align-items:center;gap:4px;margin-bottom:6px;
                         background:${badge.bg};color:${badge.fg};
                         padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">
              📚 ${g.toplam} adet &bull; ${guvenliYazi(badge.tekst)}
            </span>
            <div class="title">${guvenliYazi(g.kitapAdi || '-')}</div>
            <div class="line"><strong>Yazar:</strong> ${guvenliYazi(g.yazar || '-')}</div>
            ${g.isbn     ? `<div class="line"><strong>ISBN:</strong> ${guvenliYazi(g.isbn)}</div>` : ''}
            ${g.yayinevi ? `<div class="line"><strong>Yayınevi:</strong> ${guvenliYazi(g.yayinevi)}</div>` : ''}
          </div>
        </div>
        <div class="actions">
          ${loanBtn}
          ${retBtn}
        </div>
      </div>
    `;
  }).join('');
}

// ── Detay Overlay ─────────────────────────────────────────────────────────
function detayAc(grupIdx) {
  const g = _dispGrup[grupIdx];
  if (!g) return;
  _detayGrupIdx = grupIdx;

  const badge  = _durumBadge(g);
  const ilkId  = g.kopya[0]?.id;
  const local  = ilkId ? localStorage.getItem('kapak_' + ilkId) : null;
  const kapakSrc = local
    ? safeAttr(local)
    : g.isbn
      ? safeAttr('https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(_normIsbn(g.isbn)) + '-M.jpg')
      : '';

  const yazarOner = [...new Set(books.map(b => b.yazar   ).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  const yayiOner  = [...new Set(books.map(b => b.yayinevi).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));

  const kopyaHtml = g.kopya.map(k => {
    const d      = String(k.durum || 'RAFTA');
    const dClass = d === 'ODUNCTE' ? 'oduncte' : d === 'KAYIP' ? 'kayip' : 'rafta';
    const dMetin = d === 'ODUNCTE' ? 'Ödünçte' : d === 'KAYIP' ? 'Kayıp' : 'Rafta';
    let ekBilgi  = '';
    if (d === 'ODUNCTE' && k.oduncAlan) {
      const tarih = k.oduncTarihi
        ? new Date(k.oduncTarihi).toLocaleDateString('tr-TR', { day:'numeric', month:'numeric', year:'numeric' })
        : '';
      ekBilgi = guvenliYazi(k.oduncAlan + (tarih ? ' · ' + tarih : ''));
    }
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;
                  border-radius:10px;background:#f9fafb;margin-bottom:2px;">
        <span style="font-family:monospace;font-size:13px;font-weight:700;
                     color:#374151;flex-shrink:0;">${guvenliYazi(k.kitapKodu || '-')}</span>
        <span class="status ${dClass}" style="font-size:11px;padding:3px 8px;flex-shrink:0;">${dMetin}</span>
        <span style="font-size:11px;color:#6b7280;flex:1;min-width:0;word-break:break-word;">${ekBilgi}</span>
        ${d === 'ODUNCTE'
          ? `<button onclick="event.stopPropagation();_iadeKopyaIade(${Number(k.id)})"
                     style="flex-shrink:0;padding:4px 10px;font-size:12px;font-weight:700;
                            border:none;border-radius:8px;background:#047857;color:#fff;
                            cursor:pointer;-webkit-tap-highlight-color:transparent;">
               İade
             </button>`
          : ''}
      </div>`;
  }).join('');

  document.getElementById('detayOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'detayOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.55);' +
    'display:flex;align-items:flex-end;justify-content:center;';
  overlay.addEventListener('click', e => { if (e.target === overlay) detayKapat(); });

  overlay.innerHTML = `
    <div id="detayPanel" style="
      background:#fff;border-radius:22px 22px 0 0;
      width:100%;max-width:700px;max-height:92vh;
      display:flex;flex-direction:column;
      box-shadow:0 -8px 32px rgba(0,0,0,0.18);">

      <div style="flex-shrink:0;background:#fff;border-radius:22px 22px 0 0;
                  display:flex;align-items:center;justify-content:space-between;
                  padding:12px 16px 10px;border-bottom:1px solid #f3f4f6;">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:4px;border-radius:2px;background:#d1d5db"></div>
          <span style="font-size:15px;font-weight:700;color:#111">Kitap Detayı</span>
        </div>
        <button onclick="detayKapat()" style="
          width:36px;height:36px;border:none;border-radius:50%;
          background:#f3f4f6;color:#374151;font-size:18px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          -webkit-tap-highlight-color:transparent;">✕</button>
      </div>

      <div style="flex:1;min-height:0;overflow-y:auto;padding:0 0 4px 0;">

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
            <div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.55);
                        border-radius:6px;padding:2px 5px;font-size:11px;color:#fff">📷</div>
            <input id="detayKapakInput" type="file" accept="image/*" style="display:none"
              onchange="detayKapakSecildi(${Number(ilkId)}, this)">
          </div>
          <div style="flex:1;min-width:0">
            <span style="display:inline-flex;align-items:center;gap:4px;margin-bottom:6px;
                         background:${badge.bg};color:${badge.fg};
                         padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">
              📚 ${g.toplam} adet &bull; ${guvenliYazi(badge.tekst)}
            </span>
            <div style="font-size:24px;font-weight:800;line-height:1.25;margin-bottom:6px;word-break:break-word;color:#111;">
              ${guvenliYazi(g.kitapAdi || '-')}
            </div>
            <div style="font-size:15px;color:#374151;margin-bottom:6px;">${guvenliYazi(g.yazar || '-')}</div>
            ${g.yayinevi ? `<div style="font-size:14px;color:#6b7280;margin-bottom:4px;">${guvenliYazi(g.yayinevi)}</div>` : ''}
            ${g.isbn     ? `<div style="font-size:11px;color:#9ca3af;font-family:monospace;letter-spacing:0.3px;">ISBN ${guvenliYazi(g.isbn)}</div>` : ''}
          </div>
        </div>

        <div style="padding:0 18px 18px">
          <div style="font-size:13px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
            Kopyalar (${g.toplam})
          </div>
          ${kopyaHtml}
        </div>

        <div style="padding:0 18px 18px;border-top:1px solid #f3f4f6">
          <div style="font-size:13px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:0.5px;margin:14px 0 12px">
            Bilgileri Düzenle
          </div>

          <label style="${_detayLabelStyle()}">Kitap Adı</label>
          <input id="detayEditAdi" type="text" value="${safeAttr(g.kitapAdi || '')}"
                 style="${_detayInputStyle()}" autocomplete="off">

          <label style="${_detayLabelStyle()}">Yazar</label>
          <div style="position:relative">
            <input id="detayEditYazar" type="text" value="${safeAttr(g.yazar || '')}"
                   style="${_detayInputStyle()}" autocomplete="off">
          </div>

          <label style="${_detayLabelStyle()}">Yayınevi</label>
          <div style="position:relative">
            <input id="detayEditYayinevi" type="text" value="${safeAttr(g.yayinevi || '')}"
                   style="${_detayInputStyle()}" autocomplete="off">
          </div>

          <label style="${_detayLabelStyle()}">Yayın Yılı</label>
          <input id="detayEditYil" type="text" value="${safeAttr(g.yayinYili || '')}"
                 style="${_detayInputStyle()}" autocomplete="off">

          <div id="detayMesaj" style="display:none;margin-top:10px;padding:10px 14px;
                                       border-radius:10px;font-size:15px;font-weight:bold"></div>
        </div>

      </div>

      <div style="
        flex-shrink:0;
        padding:10px 14px calc(10px + env(safe-area-inset-bottom,0px));
        border-top:1px solid #f3f4f6;background:#fff;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">

          ${g.rafta > 0
            ? `<button onclick="_detayLoan()" style="
                padding:13px 6px;font-size:13px;font-weight:700;line-height:1.2;
                border:none;border-radius:12px;background:#0b57d0;color:#fff;
                cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:center;">
                📤 Ödünç<br>Ver
              </button>`
            : `<button disabled style="
                padding:13px 6px;font-size:13px;font-weight:700;line-height:1.2;
                border:none;border-radius:12px;background:#e5e7eb;color:#9ca3af;
                cursor:not-allowed;text-align:center;">
                📤 Ödünç<br>Ver
              </button>`}

          <button onclick="detayKaydet()" style="
            padding:13px 6px;font-size:13px;font-weight:700;line-height:1.2;
            border:none;border-radius:12px;background:#047857;color:#fff;
            cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:center;">
            💾 Kaydet
          </button>

          <button onclick="detayKapat()" style="
            padding:13px 6px;font-size:13px;font-weight:700;line-height:1.2;
            border:none;border-radius:12px;background:#1f2937;color:#fff;
            cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:center;">
            ✕ Kapat
          </button>

        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const panel = overlay.querySelector('#detayPanel');
  if (panel) {
    panel.style.transform  = 'translateY(100%)';
    panel.style.transition = 'transform 0.25s ease';
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });
  }

  _autocompleteSetup(document.getElementById('detayEditYazar'),    yazarOner);
  _autocompleteSetup(document.getElementById('detayEditYayinevi'), yayiOner);
}

function _detayLoan() {
  if (_detayGrupIdx < 0) return;
  const idx = _detayGrupIdx;
  detayKapat();
  loanBook(idx);
}

async function _iadeKopyaIade(bookId) {
  if (!window.confirm('Bu kopyayı iade almak istediğinize emin misiniz?')) return;
  try {
    const result = await apiPost({ action: 'returnBook', id: bookId });
    if (!result.ok) {
      const mesajEl = document.getElementById('detayMesaj');
      if (mesajEl) {
        mesajEl.style.display    = 'block';
        mesajEl.style.background = '#fee2e2';
        mesajEl.style.color      = '#991b1b';
        mesajEl.textContent      = result.error || 'İade hatası';
      } else {
        listeMesaj(result.error || 'İade hatası', 'error');
      }
      return;
    }
    detayKapat();
    listeMesaj(result.message || 'Kitap iade alındı', 'success');
    await loadBooks();
  } catch (err) {
    const mesajEl = document.getElementById('detayMesaj');
    if (mesajEl) {
      mesajEl.style.display    = 'block';
      mesajEl.style.background = '#fee2e2';
      mesajEl.style.color      = '#991b1b';
      mesajEl.textContent      = 'İade hatası: ' + err.message;
    }
  }
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

async function detayKaydet() {
  const g = _dispGrup[_detayGrupIdx];
  if (!g) return;

  const mesajEl = document.getElementById('detayMesaj');
  function _hata(msg) {
    if (!mesajEl) return;
    mesajEl.style.display    = 'block';
    mesajEl.style.background = '#fee2e2';
    mesajEl.style.color      = '#991b1b';
    mesajEl.textContent      = msg;
  }

  const _bh      = typeof basHarfBuyut === 'function' ? basHarfBuyut : s => s;
  const adi      = _bh((document.getElementById('detayEditAdi')?.value      || '').trim());
  const yazar    = _bh((document.getElementById('detayEditYazar')?.value    || '').trim());
  const yayinevi  = (document.getElementById('detayEditYayinevi')?.value || '').trim();
  const yayinYili = (document.getElementById('detayEditYil')?.value      || '').trim();

  if (!adi || !yazar) { _hata('Kitap adı ve yazar zorunlu'); return; }

  try {
    const results = await Promise.all(
      g.kopya.map(k => apiPost({ action: 'bookUpdate', id: k.id, kitapAdi: adi, yazar, yayinevi, yayinYili, notText: k.not || '' }))
    );
    const hata = results.find(r => !r.ok);
    if (hata) { _hata(hata.error || 'Kayıt hatası'); return; }

    g.kitapAdi = adi; g.yazar = yazar; g.yayinevi = yayinevi; g.yayinYili = yayinYili;
    g.kopya.forEach(k => { k.kitapAdi = adi; k.yazar = yazar; k.yayinevi = yayinevi; k.yayinYili = yayinYili; });
    g.kopya.forEach(k => {
      const b = books.find(b => Number(b.id) === Number(k.id));
      if (b) { b.kitapAdi = adi; b.yazar = yazar; b.yayinevi = yayinevi; b.yayinYili = yayinYili; }
    });

    detayKapat();
    renderList();
    listeMesaj(results[0]?.message || 'Kitap güncellendi', 'success');
  } catch (err) {
    _hata('Kayıt hatası: ' + err.message);
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

// ── Ödünç Modal ───────────────────────────────────────────────────────────
function _oduncModalGoster(defaultGun) {
  return new Promise(resolve => {
    document.getElementById('oduncOverlay')?.remove();
    const oduncAlanlar = [...new Set(books.map(b => b.oduncAlan).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));

    const overlay = document.createElement('div');
    overlay.id = 'oduncOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.55);' +
      'display:flex;align-items:flex-end;justify-content:center;';
    overlay.innerHTML = `
      <div id="oduncPanel" style="background:#fff;border-radius:22px 22px 0 0;
        width:100%;max-width:500px;display:flex;flex-direction:column;
        box-shadow:0 -8px 32px rgba(0,0,0,0.18);">
        <div style="flex-shrink:0;padding:14px 16px 12px;border-bottom:1px solid #f3f4f6;
                    display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:4px;border-radius:2px;background:#d1d5db"></div>
          <span style="font-size:16px;font-weight:700;color:#111">📤 Ödünç Ver</span>
        </div>
        <div style="padding:16px 20px 8px;overflow-y:auto;">
          <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">Ödünç Alan</label>
          <input id="oduncAlanInput" type="text" placeholder="Kişi adı..." autocomplete="off" autocapitalize="words"
            style="width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;
                   border:1.5px solid #d1d5db;border-radius:12px;background:#fff;outline:none;
                   display:block;margin-bottom:16px;">
          <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">Kaç Gün Ödünç?</label>
          <input id="oduncGunInput" type="number" min="1" max="365" value="${Number(defaultGun)||15}"
            style="width:100%;box-sizing:border-box;padding:13px 14px;font-size:16px;
                   border:1.5px solid #d1d5db;border-radius:12px;background:#fff;outline:none;
                   display:block;margin-bottom:6px;">
          <div id="oduncIadeTarihGoster" style="font-size:13px;color:#6b7280;margin-bottom:12px;min-height:18px;"></div>
          <div id="oduncMesaj" style="display:none;padding:10px 14px;border-radius:10px;
                                       font-size:14px;font-weight:bold;margin-bottom:10px;
                                       background:#fee2e2;color:#991b1b;"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <button id="oduncIptalBtn" style="border:none;border-radius:12px;padding:15px;
              font-size:15px;font-weight:bold;background:#f3f4f6;color:#374151;cursor:pointer;
              -webkit-tap-highlight-color:transparent;">İptal</button>
            <button id="oduncOnayBtn" style="border:none;border-radius:12px;padding:15px;
              font-size:15px;font-weight:bold;background:#0b57d0;color:#fff;cursor:pointer;
              -webkit-tap-highlight-color:transparent;">Ödünç Ver</button>
          </div>
        </div>
        <div style="flex-shrink:0;height:calc(env(safe-area-inset-bottom,0px) + 16px)"></div>
      </div>`;

    document.body.appendChild(overlay);

    const panel = overlay.querySelector('#oduncPanel');
    panel.style.transform  = 'translateY(100%)';
    panel.style.transition = 'transform 0.25s ease';
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });

    _autocompleteSetup(document.getElementById('oduncAlanInput'), oduncAlanlar);
    setTimeout(() => document.getElementById('oduncAlanInput')?.focus(), 320);

    function _guncelleIade() {
      const gun = parseInt(document.getElementById('oduncGunInput')?.value, 10) || 0;
      const el  = document.getElementById('oduncIadeTarihGoster');
      if (!el) return;
      if (gun > 0) {
        const d = new Date(); d.setDate(d.getDate() + gun);
        el.textContent = 'İade tarihi: ' + d.toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' });
      } else { el.textContent = ''; }
    }
    _guncelleIade();
    document.getElementById('oduncGunInput')?.addEventListener('input', _guncelleIade);

    function _kapat(result) {
      _autocompleteTemizle();
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => overlay.remove(), 250);
      resolve(result);
    }
    document.getElementById('oduncIptalBtn').addEventListener('click', () => _kapat(null));
    overlay.addEventListener('click', e => { if (e.target === overlay) _kapat(null); });

    function _onay() {
      const borrower = (document.getElementById('oduncAlanInput')?.value || '').trim();
      const gun      = parseInt(document.getElementById('oduncGunInput')?.value, 10);
      const mesajEl  = document.getElementById('oduncMesaj');
      if (!borrower) {
        if (mesajEl) { mesajEl.style.display = 'block'; mesajEl.textContent = 'Ödünç alan kişi adı zorunlu'; }
        document.getElementById('oduncAlanInput')?.focus(); return;
      }
      if (!gun || gun < 1 || gun > 365) {
        if (mesajEl) { mesajEl.style.display = 'block'; mesajEl.textContent = 'Gün sayısı 1–365 arasında olmalı'; }
        document.getElementById('oduncGunInput')?.focus(); return;
      }
      _kapat({ borrower, gun });
    }
    document.getElementById('oduncOnayBtn').addEventListener('click', _onay);
    document.getElementById('oduncAlanInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('oduncGunInput')?.focus(); });
    document.getElementById('oduncGunInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') _onay(); });
  });
}

// ── İade Seçim Modali — v83: multi-select + onay butonu ───────────────────
// Sadece ODUNCTE kopyalar gösterilir. RAFTA asla gösterilmez.
// Tıklama → toggle seçim. Seçili satır: yeşil + ✓
// Alt footer: [İptal] | [İade Al (X)] — X = seçili sayısı, X=0 ise disabled.
// Promise → seçilen kopya dizisi (boş iptal = null)
function _iadeSecimModal(oduncteKopyalar) {
  return new Promise(resolve => {
    document.getElementById('iadeSecimOverlay')?.remove();

    // Seçili satır indeksleri (oduncteKopyalar dizisindeki index)
    const selectedIdxs = new Set();

    const overlay = document.createElement('div');
    overlay.id = 'iadeSecimOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:3500;background:rgba(0,0,0,0.55);' +
      'display:flex;align-items:flex-end;justify-content:center;';

    overlay.innerHTML = `
      <div id="iadeSecimPanel" style="
        background:#fff;border-radius:22px 22px 0 0;
        width:100%;max-width:500px;
        display:flex;flex-direction:column;
        max-height:70vh;
        box-shadow:0 -8px 32px rgba(0,0,0,0.18);">

        <!-- Başlık -->
        <div style="flex-shrink:0;padding:16px 18px 12px;border-bottom:1px solid #f3f4f6;
                    display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:4px;border-radius:2px;background:#d1d5db"></div>
          <span style="font-size:16px;font-weight:700;color:#111">📥 İade Edilecek Kopya(ları) Seçin</span>
        </div>

        <!-- Kopya listesi -->
        <div id="iadeSecimList" style="flex:1;min-height:0;overflow-y:auto;"></div>

        <!-- Footer butonları -->
        <div style="flex-shrink:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
                    border-top:1px solid #f3f4f6;
                    display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <button id="iadeIptalBtn" style="
            padding:13px;font-size:15px;font-weight:700;
            border:none;border-radius:12px;
            background:#f3f4f6;color:#374151;cursor:pointer;
            -webkit-tap-highlight-color:transparent;">İptal</button>
          <button id="iadeOnayBtn" disabled style="
            padding:13px;font-size:15px;font-weight:700;
            border:none;border-radius:12px;
            background:#e5e7eb;color:#9ca3af;cursor:not-allowed;
            -webkit-tap-highlight-color:transparent;">İade Al (0)</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const panel   = overlay.querySelector('#iadeSecimPanel');
    const listEl  = overlay.querySelector('#iadeSecimList');
    const onayBtn = overlay.querySelector('#iadeOnayBtn');

    // ── Satırları render et ───────────────────────────────────────────────
    function _renderRows() {
      listEl.innerHTML = oduncteKopyalar.map((k, i) => {
        const secili = selectedIdxs.has(i);
        const tarih  = k.oduncTarihi
          ? new Date(k.oduncTarihi).toLocaleDateString('tr-TR', { day:'numeric', month:'numeric', year:'numeric' })
          : '';
        const label  = [k.kitapKodu, k.oduncAlan, tarih].filter(Boolean).join(' — ');

        return `
          <div data-row-idx="${i}" style="
            display:flex;align-items:center;justify-content:space-between;
            padding:14px 18px;
            border-bottom:1px solid #f3f4f6;
            cursor:pointer;
            background:${secili ? '#d1fae5' : '#fff'};
            color:${secili ? '#065f46' : '#111'};
            -webkit-tap-highlight-color:transparent;
            transition:background 0.12s;">
            <span style="font-size:15px;font-weight:600;">${guvenliYazi(label)}</span>
            ${secili
              ? '<span style="font-size:20px;font-weight:900;color:#047857;flex-shrink:0;margin-left:8px;">✓</span>'
              : '<span style="font-size:20px;color:transparent;flex-shrink:0;margin-left:8px;">✓</span>'}
          </div>`;
      }).join('');

      // Tıklama → toggle
      listEl.querySelectorAll('[data-row-idx]').forEach(row => {
        row.addEventListener('click', () => {
          const idx = parseInt(row.dataset.rowIdx, 10);
          if (selectedIdxs.has(idx)) {
            selectedIdxs.delete(idx);
          } else {
            selectedIdxs.add(idx);
          }
          _renderRows();
          _updateOnayBtn();
        });
      });
    }

    // ── Onay butonu güncelle ──────────────────────────────────────────────
    function _updateOnayBtn() {
      const count = selectedIdxs.size;
      if (count === 0) {
        onayBtn.disabled         = true;
        onayBtn.style.background = '#e5e7eb';
        onayBtn.style.color      = '#9ca3af';
        onayBtn.style.cursor     = 'not-allowed';
        onayBtn.textContent      = 'İade Al (0)';
      } else {
        onayBtn.disabled         = false;
        onayBtn.style.background = '#047857';
        onayBtn.style.color      = '#fff';
        onayBtn.style.cursor     = 'pointer';
        onayBtn.textContent      = `İade Al (${count})`;
      }
    }

    // İlk render
    _renderRows();

    // Animate in
    panel.style.transform  = 'translateY(100%)';
    panel.style.transition = 'transform 0.25s ease';
    requestAnimationFrame(() => { panel.style.transform = 'translateY(0)'; });

    // ── Kapat yardımcısı ──────────────────────────────────────────────────
    function _kapat(result) {
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => overlay.remove(), 250);
      resolve(result);
    }

    // İptal
    overlay.querySelector('#iadeIptalBtn').addEventListener('click', () => _kapat(null));
    // Overlay dışı tıklama
    overlay.addEventListener('click', e => { if (e.target === overlay) _kapat(null); });
    // Onay — seçilen kopyaları dizi olarak döndür
    onayBtn.addEventListener('click', () => {
      if (selectedIdxs.size === 0) return;
      const secilen = [...selectedIdxs].sort().map(i => oduncteKopyalar[i]);
      _kapat(secilen);
    });
  });
}

// ── Ödünç / İade ──────────────────────────────────────────────────────────
async function loanBook(grupIdx) {
  listeMesajTemizle();
  const g = _dispGrup[grupIdx];
  if (!g) return;

  const hedef = g.kopya.find(k => k.durum === 'RAFTA');
  if (!hedef) { listeMesaj('Rafta kopya bulunamadı', 'error'); return; }

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
    const result = await apiPost({ action: 'loanBook', id: hedef.id, borrower, returnDate });
    if (!result.ok) { listeMesaj(result.error || 'Ödünç verme hatası', 'error'); return; }
    listeMesaj(result.message || 'Kitap ödünç verildi', 'success');
    await loadBooks();
  } catch (err) {
    listeMesaj('Ödünç verme hatası: ' + err.message, 'error');
  }
}

// v83: returnBook — her zaman seçim modali açılır (tek kopya dahil)
// Modal → Promise<kopya[]|null>
// Seçilen her kopya için returnBook API çağrısı yapılır.
async function returnBook(grupIdx) {
  listeMesajTemizle();
  const g = _dispGrup[grupIdx];
  if (!g) { console.warn('[returnBook] geçersiz grupIdx:', grupIdx); return; }

  // Sadece ODUNCTE kopyalar — RAFTA asla dahil edilmez
  const oduncteKopyalar = g.kopya.filter(k => k.durum === 'ODUNCTE');
  console.log('[returnBook] grup:', g.kitapAdi,
    '| kopyalar:', g.kopya.map(k => k.kitapKodu + ':' + k.durum),
    '| oduncte:', oduncteKopyalar.length);

  if (!oduncteKopyalar.length) { listeMesaj('Ödünçte kopya bulunamadı', 'error'); return; }

  // Her zaman modal aç — kullanıcı seçip onaylar
  const secilenler = await _iadeSecimModal(oduncteKopyalar);
  if (!secilenler || !secilenler.length) return;  // İptal

  try {
    // Seçilen tüm kopyaları iade et
    const results = await Promise.all(
      secilenler.map(k => apiPost({ action: 'returnBook', id: k.id }))
    );
    const hata = results.find(r => !r.ok);
    if (hata) { listeMesaj(hata.error || 'İade hatası', 'error'); return; }

    const count = secilenler.length;
    const mesaj = count === 1
      ? (results[0].message || 'Kitap iade alındı')
      : `${count} kitap iade alındı`;
    listeMesaj(mesaj, 'success');
    await loadBooks();
  } catch (err) {
    listeMesaj('İade hatası: ' + err.message, 'error');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
(function _init() {
  document.getElementById('filtrRafta')?.addEventListener('click', () => _toggleDurum('RAFTA'));
  document.getElementById('filtrOdunc')?.addEventListener('click', () => _toggleDurum('ODUNCTE'));
  document.getElementById('scrollTopBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const searchInput = document.getElementById('search');
  if (searchInput) {
    searchInput.addEventListener('input', renderList);
    searchInput.addEventListener('keyup',  renderList);
  }

  _topBarRender();
  _azBarKur();
  loadBooks();
})();
