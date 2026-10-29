/* Tema, para birimi, ayarlar, PIN değiştir */
const Settings = (() => {
  function applyAll() {
    const s = Store.getSettings();
    document.documentElement.setAttribute('data-theme', s.theme);
    document.documentElement.setAttribute('data-accent', s.accent);
    updateThemeIcon(s.theme);
    const cur = document.getElementById('currency-select');
    if (cur) cur.value = s.currency;
    const nt = document.getElementById('notif-toggle');
    if (nt) nt.checked = !!s.notif;
    const st = document.getElementById('sound-toggle');
    if (st) st.checked = s.sound !== false;
    const at = document.getElementById('alarm-toggle');
    if (at) at.checked = s.alarm !== false;
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }

  function toggleTheme() {
    const s = Store.getSettings();
    s.theme = s.theme === 'light' ? 'dark' : 'light';
    Store.saveSettings(s);
    applyAll();
  }

  function setAccent(accent) {
    const s = Store.getSettings();
    s.accent = accent;
    Store.saveSettings(s);
    applyAll();
  }

  function setCurrency(c) {
    const s = Store.getSettings();
    s.currency = c;
    Store.saveSettings(s);
    UI.renderAll();
  }

  function bind() {
    document.getElementById('currency-select').addEventListener('change', (e) => setCurrency(e.target.value));

    document.querySelectorAll('.theme-circle').forEach(el => {
      el.addEventListener('click', () => setAccent(el.dataset.accent));
    });

    document.getElementById('btn-change-pin').addEventListener('click', () => {
      const p1 = document.getElementById('new-pin').value.trim();
      const p2 = document.getElementById('new-pin-confirm').value.trim();
      if (p1.length < 4 || p1.length > 6) { UI.toast('PIN 4-6 haneli olmalı', 'error'); return; }
      if (p1 !== p2) { UI.toast('PIN\'ler eşleşmiyor', 'error'); return; }
      const u = Store.getCurrentUser();
      const user = Store.getUser(u);
      user.pin = Store.hashPin(p1);
      Store.saveUser(u, user);
      document.getElementById('new-pin').value = '';
      document.getElementById('new-pin-confirm').value = '';
      UI.toast('PIN güncellendi', 'success');
    });

    // Modal kapat
    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', (e) => e.target.closest('.modal').classList.remove('open'));
    });

    // Modal dışına tıklama
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
    });

    // Kategori ekle/sil
    document.querySelectorAll('[data-add-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.addCat;
        const input = document.getElementById(type === 'income' ? 'new-income-cat' : 'new-expense-cat');
        if (Categories.add(type, input.value)) input.value = '';
      });
    });

    // Kategori silme (event delegation)
    document.getElementById('category-modal').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat-remove]');
      if (!btn) return;
      const type = btn.dataset.catRemove;
      const name = btn.dataset.catName;
      if (confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?`)) {
        Categories.remove(type, name);
      }
    });
  }

  return { applyAll, toggleTheme, setAccent, bind, updateThemeIcon };
})();