function ayarlarForm() {
  const alan = document.getElementById('formAlani');
  if (!alan) return;

  alan.innerHTML = `
    <div style="background:#fff; border-radius:22px; padding:20px; box-shadow:0 6px 16px rgba(0,0,0,0.10);">
      <div style="font-size:28px; font-weight:bold; text-align:center; margin-bottom:18px;">⚙️ Ayarlar</div>

      <label style="display:block; font-size:18px; font-weight:bold; margin:14px 0 8px;">Kod Prefix</label>
      <input type="text" placeholder="Örn: KTP" style="width:100%; padding:16px; font-size:16px; border:1px solid #ccc; border-radius:14px;" />

      <label style="display:block; font-size:18px; font-weight:bold; margin:14px 0 8px;">Kod Ayraç</label>
      <input type="text" placeholder="Örn: -" style="width:100%; padding:16px; font-size:16px; border:1px solid #ccc; border-radius:14px;" />

      <label style="display:block; font-size:18px; font-weight:bold; margin:14px 0 8px;">Kod Hane</label>
      <input type="number" placeholder="Örn: 4" style="width:100%; padding:16px; font-size:16px; border:1px solid #ccc; border-radius:14px;" />

      <label style="display:block; font-size:18px; font-weight:bold; margin:14px 0 8px;">Ödünç Gün Sayısı</label>
      <input type="number" placeholder="Örn: 15" style="width:100%; padding:16px; font-size:16px; border:1px solid #ccc; border-radius:14px;" />

      <label style="display:block; font-size:18px; font-weight:bold; margin:14px 0 8px;">Tema</label>
      <select style="width:100%; padding:16px; font-size:16px; border:1px solid #ccc; border-radius:14px; background:#fff;">
        <option>Açık</option>
        <option>Koyu</option>
        <option>Gri</option>
      </select>

      <button style="width:100%; padding:18px; margin-top:18px; font-size:22px; border:none; border-radius:14px; background:#111; color:white; font-weight:bold; cursor:pointer;">
        Kaydet
      </button>
    </div>
  `;
}
