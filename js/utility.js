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

async function kameraBaslat(options) {
  const {
    inputId,
    successMessage = 'ISBN okundu: ',
    onDetected,
    fps = 5,
    qrWidth = 280,
    qrHeight = 90
  } = options || {};

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
        fps: fps,
        qrbox: { width: qrWidth, height: qrHeight },
        aspectRatio: 1.7778
      },
      onDetected: async (isbn) => {
        const input = document.getElementById(inputId);
        if (input) input.value = isbn;

        mesajGoster(successMessage + isbn, 'success');
        await kameraKapat();

        if (typeof onDetected === 'function') {
          await onDetected(isbn);
        }
      }
    });
  } catch (err) {
    await kameraKapat();
    mesajGoster('Kamera açılamadı: ' + (err.message || err), 'error');
  }
}

async function tumKitaplariGetir() {
  const sonuc = await apiPost({ action: 'booksList' });
  if (!sonuc.ok) {
    throw new Error(sonuc.error || 'Kitap listesi alınamadı');
  }
  return sonuc.data || [];
}

function kitapKartHtml(kitap, extraRows = '') {
  const durum = String(kitap.durum || 'RAFTA').toUpperCase();

  let badgeClass = 'rafta';
  if (durum === 'ÖDÜNÇTE' || durum === 'KAYIP') {
    badgeClass = 'oduncte';
  }

  return `
    <div class="kitapKart">
      <div class="kitapBaslik">${guvenliYazi(kitap.kitapAdi || '-')}</div>
      <div class="kitapSatir"><strong>Kitap Kodu:</strong> ${guvenliYazi(kitap.kitapKodu || '-')}</div>
      <div class="kitapSatir"><strong>Yazar:</strong> ${guvenliYazi(kitap.yazar || '-')}</div>
      <div class="kitapSatir"><strong>ISBN:</strong> ${guvenliYazi(kitap.isbn || '-')}</div>
      <div class="kitapSatir"><strong>Yayınevi:</strong> ${guvenliYazi(kitap.yayinevi || '-')}</div>
      <div class="kitapSatir"><strong>Yıl:</strong> ${guvenliYazi(kitap.yayinYili || '-')}</div>
      ${extraRows}
      <div class="durumBadge ${badgeClass}">${guvenliYazi(durum)}</div>
    </div>
  `;
}
