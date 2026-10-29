/* Bootstrap */
document.addEventListener('DOMContentLoaded', () => {
  // Tema
  Settings.applyAll();

  // Ayarlar bar hamburger
  document.getElementById('hamburger-btn').addEventListener('click', () => {
    document.getElementById('settings-bar').classList.toggle('open');
  });

  // Üstteki aksiyon butonları
  document.getElementById('settings-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'export-pdf') window.print();
    if (action === 'toggle-theme') Settings.toggleTheme();
    if (action === 'open-settings') document.getElementById('settings-modal').classList.add('open');
    if (action === 'export-json') exportJSON();
    if (action === 'logout') { Store.setCurrentUser(null); location.reload(); }
  });

  // İçe aktarma
  document.getElementById('import-file').addEventListener('change', importJSON);

  // Dönem seçici
  const periodInput = document.getElementById('active-period');
  const today = new Date();
  periodInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  periodInput.addEventListener('change', UI.renderAll);

  // Önceki/sonraki ay
  document.getElementById('prev-month').addEventListener('click', () => shiftPeriod(-1));
  document.getElementById('next-month').addEventListener('click', () => shiftPeriod(1));

  function shiftPeriod(delta) {
    const [y, m] = periodInput.value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    periodInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    Transactions.autoRecurring();
    UI.renderAll();
  }

  // Alt bileşenler
  Auth.bind();
  Transactions.bind();
  Budget.bind();
  Reminders.bind();
  Settings.bind();
  UI.bind();

  // Bütçe limit modalı — kategori modalı butonundan ayrı olarak ayarlardan da erişilebilir
  // Ayarlar modalına bütçe butonu ekle (dinamik)
  const settingsContent = document.querySelector('#settings-modal .modal-content');
  const budgetBtn = document.createElement('button');
  budgetBtn.className = 'btn btn-secondary';
  budgetBtn.innerHTML = '<i class="fa-solid fa-gauge-high"></i> Bu Dönemin Bütçe Limiti';
  budgetBtn.style.marginTop = '10px';
  budgetBtn.addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('open');
    Budget.openModal();
  });
  settingsContent.insertBefore(budgetBtn, settingsContent.querySelector('[data-close-modal]'));

  // Kategori yönetimi butonu
  document.querySelectorAll('[data-action="manage-categories"]').forEach(btn => {
    btn.addEventListener('click', () => {
      Categories.renderManageList();
      document.getElementById('category-modal').classList.add('open');
    });
  });

  // Oturum varsa otomatik giriş
  if (Store.getCurrentUser()) {
    UI.showApp();
  }
});

/* ==== Export / Import ==== */
function exportJSON() {
  const u = Store.getCurrentUser();
  const db = Store.getDb();
  const userData = db.users[u];
  const payload = {
    version: 2,
    username: u,
    exportedAt: new Date().toISOString(),
    user: userData
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = `butce_yedek_${u}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  UI.toast('Yedek indirildi', 'success');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      const currentU = Store.getCurrentUser();
      const db = Store.getDb();

      // Yeni format (v2)
      if (parsed.version === 2 && parsed.user) {
        if (parsed.username !== currentU) {
          if (!confirm(`Bu yedek "${parsed.username}" kullanıcısına ait. Mevcut hesabınıza (${currentU}) ait verilerin ÜZERİNE yazılsın mı?`)) return;
        }
        db.users[currentU] = parsed.user;
        Store.saveDb(db);
      }
      // Eski format: doğrudan { username: {...} }
      else if (parsed.db || parsed.users) {
        const src = parsed.db || parsed.users;
        if (src[currentU]) {
          db.users[currentU] = src[currentU];
          Store.saveDb(db);
        } else {
          UI.toast('Yedekte bu kullanıcıya ait veri yok', 'error');
          return;
        }
      }
      // Tam eski format (legacy) — migrate etmek için bud_dm_v2'ye yaz
      else {
        const newDb = { __schema: 2, users: {} };
        Object.entries(parsed).forEach(([username, periods]) => {
          if (username.startsWith('__')) return;
          newDb.users[username] = {
            profile: { avatar: null, createdAt: Date.now() },
            pin: null,
            categories: {
              income: [...Store.DEFAULT_CATEGORIES.income],
              expense: [...Store.DEFAULT_CATEGORIES.expense]
            },
            periods: {},
            settings: { currency: 'TRY' }
          };
          Object.entries(periods).forEach(([period, data]) => {
            if (!/^\d{4}-\d{2}$/.test(period)) return;
            newDb.users[username].periods[period] = {
              transactions: (data.transactions || []).map(tx => ({
                id: Store.genId(),
                type: tx.type,
                category: tx.category || '',
                title: tx.title || '',
                amount: Number(tx.amount) || 0,
                date: tx.date || '',
                paid: false, recurring: false, createdAt: Date.now()
              })),
              notes: data.notes || '',
              budgetLimit: 0
            };
          });
        });
        Store.saveDb(newDb);
      }
      UI.toast('Veriler içe aktarıldı', 'success');
      UI.renderAll();
    } catch (err) {
      UI.toast('Geçersiz yedek dosyası', 'error');
    }
  };
  reader.readAsText(file);
}

/* Service Worker kaydı (PWA + arka plan bildirim) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}