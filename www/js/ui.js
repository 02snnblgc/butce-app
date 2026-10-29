/* Render + toast + modal + güvenli HTML */
const UI = (() => {
  function escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function currency() {
    return Store.getSettings().currency || 'TRY';
  }

  function fmt(v) {
    try {
      return Number(v).toLocaleString('tr-TR', { style: 'currency', currency: currency() });
    } catch { return Number(v).toFixed(2) + ' ' + currency(); }
  }

  function toast(msg, type = 'info') {
    const box = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';
    el.innerHTML = `<i class="fa-solid ${icon}"></i> ${escape(msg)}`;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
  }

  function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    const u = Store.getCurrentUser();
    const user = Store.getUser(u);
    document.getElementById('display-username').textContent = u;
    const av = document.getElementById('user-avatar');
    if (user?.profile?.avatar) {
      av.innerHTML = `<img src="${user.profile.avatar}" alt="avatar">`;
    } else {
      av.innerHTML = escape(u.charAt(0).toUpperCase());
    }
    Settings.applyAll();
    // Bugünün tarihini default olarak tx-date'e koy
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    // Tekrarlayan işlemleri otomatik ekle
    Transactions.autoRecurring();
    renderAll();
    Reminders.requestPermissionOnFirstUse();
  }

  function refreshCategories() {
    const type = document.getElementById('tx-type').value;
    const sel = document.getElementById('tx-category');
    if (!sel) return;
    const arr = Categories.list(type);
    const current = sel.value;
    sel.innerHTML = arr.map(c => `<option value="${escape(c)}">${escape(c)}</option>`).join('');
    if (arr.includes(current)) sel.value = current;
  }

  function renderAll() {
    renderTransactions();
    renderSummary();
    renderCategorySummary();
    renderNotes();
    Budget.check();
    Reminders.checkAndAlarm(true);
    refreshCategories();
    Categories.renderManageList();
    const period = document.getElementById('active-period').value;
    document.getElementById('print-period-info').textContent =
      `Dönem: ${period} | Kullanıcı: ${Store.getCurrentUser()}`;
  }

  function renderTransactions() {
    const container = document.getElementById('transaction-container');
    const arr = Transactions.getFiltered();
    const countEl = document.getElementById('tx-count');
    if (countEl) countEl.textContent = arr.length;
    if (!arr.length) {
      container.innerHTML = `<p style="text-align:center;color:var(--text-muted);font-size:.85rem;padding:20px;">Kayıt yok.</p>`;
      return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    container.innerHTML = arr.map(t => {
      let badge = '';
      if (t.type === 'expense' && t.date) {
        const txDate = new Date(t.date + 'T00:00:00'); txDate.setHours(0, 0, 0, 0);
        const diff = Math.ceil((txDate - today) / (1000 * 60 * 60 * 24));
        if (t.paid) {
          badge = '<span class="badge success"><i class="fa-solid fa-check"></i> Ödendi</span>';
        } else if (diff <= 0) {
          badge = '<span class="badge danger"><i class="fa-solid fa-bell"></i> Zamanı Geldi/Geçti</span>';
        } else if (diff <= 3) {
          badge = `<span class="badge warning"><i class="fa-solid fa-clock"></i> Son ${diff} Gün</span>`;
        } else {
          badge = '<span class="badge normal">Bekliyor</span>';
        }
      } else if (t.type === 'income') {
        badge = '<span class="badge success">Gelir</span>';
      }
      return `
        <div class="transaction-item ${t.paid ? 'paid' : ''}">
          <div class="transaction-info">
            <h5>${t.category ? `[${escape(t.category)}] ` : ''}${escape(t.title)}</h5>
            <p>Tarih: ${escape(t.date)} ${t.recurring ? '• 🔁' : ''}</p>
            ${badge}
          </div>
          <div class="transaction-right">
            <span style="font-weight:700;color:${t.type === 'income' ? '#10b981' : '#ef4444'}">
              ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
            </span>
            <div class="tx-actions">
              ${t.type === 'expense' ? `<button data-tx-paid="${t.id}" title="${t.paid ? 'Ödenmedi işaretle' : 'Ödendi işaretle'}"><i class="fa-solid ${t.paid ? 'fa-rotate-left' : 'fa-check'}"></i></button>` : ''}
              <button data-tx-edit="${t.id}" title="Düzenle"><i class="fa-solid fa-pen"></i></button>
              <button data-tx-del="${t.id}" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSummary() {
    const { income, expense, net } = Transactions.sum();
    document.getElementById('total-income').textContent = fmt(income);
    document.getElementById('total-expense').textContent = fmt(expense);
    const netEl = document.getElementById('net-balance');
    netEl.textContent = fmt(net);
    netEl.className = 'amount balance' + (net < 0 ? ' expense' : '');
  }

  function renderCategorySummary() {
    const box = document.getElementById('category-summary');
    const data = Transactions.getData();
    const map = {};
    data.transactions.forEach(t => {
      const key = (t.type === 'income' ? 'in|' : 'ex|') + (t.category || 'Diğer');
      if (!map[key]) map[key] = { type: t.type, name: t.category || 'Diğer', total: 0 };
      map[key].total += Number(t.amount);
    });
    const arr = Object.values(map).sort((a, b) => b.total - a.total);
    if (!arr.length) {
      box.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">Bu dönemde veri yok.</p>';
      return;
    }
    box.innerHTML = arr.map(x => `
      <div class="cat-row ${x.type === 'income' ? 'income' : ''}">
        <span class="cat-name">${x.type === 'income' ? '↑' : '↓'} ${escape(x.name)}</span>
        <span class="cat-amount">${fmt(x.total)}</span>
      </div>
    `).join('');
  }

  function renderNotes() {
    const notes = Transactions.getData().notes || '';
    const el = document.getElementById('period-notes');
    if (el.value !== notes) el.value = notes;
  }

  function bind() {
    const notes = document.getElementById('period-notes');
    let timer = null;
    notes.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const data = Transactions.getData();
        data.notes = notes.value;
        Transactions.saveData(data);
      }, 500);
    });

    // İşlem listesi event delegation
    document.getElementById('transaction-container').addEventListener('click', (e) => {
      const paidBtn = e.target.closest('[data-tx-paid]');
      const editBtn = e.target.closest('[data-tx-edit]');
      const delBtn = e.target.closest('[data-tx-del]');
      if (paidBtn) {
        Transactions.togglePaid(paidBtn.dataset.txPaid);
        renderAll();
        return;
      }
      if (editBtn) {
        Transactions.startEdit(editBtn.dataset.txEdit);
        return;
      }
      if (delBtn) {
        if (confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
          Transactions.remove(delBtn.dataset.txDel);
          toast('İşlem silindi', 'info');
          renderAll();
        }
      }
    });
  }

  return {
    escape, fmt, toast, showApp, refreshCategories, renderAll,
    renderTransactions, renderSummary, renderCategorySummary, renderNotes, bind,
    currency
  };
})();