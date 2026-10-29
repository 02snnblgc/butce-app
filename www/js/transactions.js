/* İşlem CRUD + filtre + sıralama + kopyalama + tekrarlama */
const Transactions = (() => {
  let editingId = null;

  function currentPeriodKey() {
    return document.getElementById('active-period').value;
  }

  function getData() {
    const u = Store.getCurrentUser();
    const period = currentPeriodKey();
    const p = Store.getPeriod(u, period);
    return p || { transactions: [], notes: '', budgetLimit: 0 };
  }

  function saveData(data) {
    const u = Store.getCurrentUser();
    Store.savePeriod(u, currentPeriodKey(), data);
  }

  function add(tx) {
    const data = getData();
    const id = Store.genId();
    data.transactions.push({ ...tx, id, createdAt: Date.now() });
    saveData(data);
    return id;
  }

  function update(id, patch) {
    const data = getData();
    const idx = data.transactions.findIndex(t => t.id === id);
    if (idx < 0) return;
    data.transactions[idx] = { ...data.transactions[idx], ...patch };
    saveData(data);
  }

  function remove(id) {
    const data = getData();
    data.transactions = data.transactions.filter(t => t.id !== id);
    saveData(data);
  }

  function togglePaid(id) {
    const data = getData();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return;
    tx.paid = !tx.paid;
    saveData(data);
  }

  function getFiltered() {
    let arr = [...getData().transactions];
    const search = (document.getElementById('filter-search').value || '').toLowerCase();
    const type = document.getElementById('filter-type').value;
    const paid = document.getElementById('filter-paid').value;
    const sort = document.getElementById('filter-sort').value;

    if (search) arr = arr.filter(t =>
      (t.title || '').toLowerCase().includes(search) ||
      (t.category || '').toLowerCase().includes(search));
    if (type) arr = arr.filter(t => t.type === type);
    if (paid === 'paid') arr = arr.filter(t => t.paid);
    if (paid === 'unpaid') arr = arr.filter(t => !t.paid);

    arr.sort((a, b) => {
      if (sort === 'date-asc') return (a.date || '').localeCompare(b.date || '');
      if (sort === 'date-desc') return (b.date || '').localeCompare(a.date || '');
      if (sort === 'amount-asc') return a.amount - b.amount;
      if (sort === 'amount-desc') return b.amount - a.amount;
      return 0;
    });
    return arr;
  }

  function sum() {
    const data = getData();
    let income = 0, expense = 0;
    data.transactions.forEach(t => {
      if (t.type === 'income') income += Number(t.amount);
      else expense += Number(t.amount);
    });
    return { income, expense, net: income - expense };
  }

  /* Önceki aydaki tekrarlayan / sabit giderleri kopyala */
  function copyPreviousMonth() {
    const u = Store.getCurrentUser();
    const period = currentPeriodKey();
    const [y, m] = period.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prev = Store.getPeriod(u, prevPeriod);
    if (!prev || !prev.transactions.length) {
      UI.toast('Önceki ay verisi yok', 'error');
      return;
    }
    const cur = getData();
    const existingTitles = new Set(cur.transactions.map(t => t.title + '|' + t.category));
    let added = 0;
    prev.transactions.forEach(t => {
      if (!t.recurring) return;
      const key = t.title + '|' + t.category;
      if (existingTitles.has(key)) return;
      cur.transactions.push({
        id: Store.genId(),
        type: t.type,
        category: t.category,
        title: t.title,
        amount: t.amount,
        date: period + '-' + String(new Date().getDate()).padStart(2, '0'),
        paid: false,
        recurring: true,
        createdAt: Date.now()
      });
      added++;
    });
    saveData(cur);
    UI.toast(`${added} tekrarlayan işlem kopyalandı`, added ? 'success' : 'info');
    UI.renderAll();
  }

  /* Her ay tekrarlanan işlemlerin bu aya otomatik eklenmesi */
  function autoRecurring() {
    const u = Store.getCurrentUser();
    const db = Store.getDb();
    const user = db.users[u];
    if (!user) return;
    const periods = Object.keys(user.periods).sort();
    const curPeriod = currentPeriodKey();
    // Bir önceki dönemdeki recurring olanları bu döneme ekle (henüz eklenmemişse)
    const idx = periods.indexOf(curPeriod);
    if (idx <= 0) return;
    const prevPeriod = periods[idx - 1];
    if (prevPeriod === curPeriod) return;
    const prev = user.periods[prevPeriod];
    const cur = user.periods[curPeriod] || { transactions: [], notes: '', budgetLimit: 0 };
    const existingTitles = new Set((cur.transactions || []).map(t => t.title + '|' + t.category));
    let added = 0;
    (prev.transactions || []).forEach(t => {
      if (!t.recurring) return;
      const key = t.title + '|' + t.category;
      if (existingTitles.has(key)) return;
      cur.transactions.push({
        id: Store.genId(),
        type: t.type, category: t.category, title: t.title,
        amount: t.amount, date: curPeriod + '-01',
        paid: false, recurring: true, createdAt: Date.now()
      });
      added++;
    });
    user.periods[curPeriod] = cur;
    Store.saveUser(u, user);
    if (added) UI.toast(`${added} tekrarlayan işlem otomatik eklendi`, 'info');
  }

  function bind() {
    const form = document.getElementById('transaction-form');
    const typeSel = document.getElementById('tx-type');
    const catWrap = document.getElementById('category-wrap');
    const cancelBtn = document.getElementById('tx-cancel-edit');

    typeSel.addEventListener('change', () => {
      catWrap.style.display = typeSel.value === 'expense' ? 'block' : 'none';
      UI.refreshCategories();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = document.getElementById('tx-submit-btn');
      btn.disabled = true;
      try {
        const type = typeSel.value;
        const category = type === 'expense' ? document.getElementById('tx-category').value : null;
        const title = document.getElementById('tx-title').value.trim();
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const date = document.getElementById('tx-date').value;
        const paid = document.getElementById('tx-paid').checked;
        const recurring = document.getElementById('tx-recurring').checked;

        if (!title || !amount || !date) { UI.toast('Tüm alanları doldurun', 'error'); return; }

        if (editingId) {
          update(editingId, { type, category, title, amount, date, paid, recurring });
          UI.toast('İşlem güncellendi', 'success');
          editingId = null;
        } else {
          add({ type, category, title, amount, date, paid, recurring });
          UI.toast('İşlem eklendi', 'success');
        }
        form.reset();
        document.getElementById('tx-date').value = date;
        cancelBtn.style.display = 'none';
        btn.textContent = 'Kaydet';
        catWrap.style.display = typeSel.value === 'expense' ? 'block' : 'none';
        UI.renderAll();
      } finally {
        btn.disabled = false;
      }
    });

    cancelBtn.addEventListener('click', () => {
      editingId = null;
      form.reset();
      cancelBtn.style.display = 'none';
      document.getElementById('tx-submit-btn').textContent = 'Kaydet';
      document.getElementById('edit-id').value = '';
    });

    // Filtre değişince render
    ['filter-search', 'filter-type', 'filter-paid', 'filter-sort'].forEach(id => {
      document.getElementById(id).addEventListener('input', UI.renderTransactions);
    });

    document.getElementById('btn-copy-prev-month').addEventListener('click', copyPreviousMonth);
  }

  function startEdit(id) {
    const data = getData();
    const tx = data.transactions.find(t => t.id === id);
    if (!tx) return;
    editingId = id;
    document.getElementById('tx-type').value = tx.type;
    document.getElementById('tx-title').value = tx.title;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-paid').checked = !!tx.paid;
    document.getElementById('tx-recurring').checked = !!tx.recurring;
    document.getElementById('category-wrap').style.display = tx.type === 'expense' ? 'block' : 'none';
    UI.refreshCategories();
    if (tx.category) document.getElementById('tx-category').value = tx.category;
    document.getElementById('tx-submit-btn').textContent = 'Güncelle';
    document.getElementById('tx-cancel-edit').style.display = 'inline-block';
    document.getElementById('tx-title').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { bind, add, update, remove, togglePaid, getData, saveData, getFiltered, sum, copyPreviousMonth, autoRecurring, startEdit };
})();