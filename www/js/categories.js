/* Kategori yönetimi */
const Categories = (() => {
  function getUser() {
    const u = Store.getCurrentUser();
    return u ? Store.getUser(u) : null;
  }

  function list(type) {
    const user = getUser();
    return user?.categories?.[type] || [];
  }

  function add(type, name) {
    name = name.trim();
    if (!name) return false;
    const u = Store.getCurrentUser();
    const user = Store.getUser(u);
    if (!user) return false;
    const arr = user.categories[type] || [];
    if (arr.includes(name)) { UI.toast('Bu kategori zaten var', 'error'); return false; }
    arr.push(name);
    user.categories[type] = arr;
    Store.saveUser(u, user);
    UI.refreshCategories();
    UI.toast('Kategori eklendi', 'success');
    return true;
  }

  function remove(type, name) {
    const u = Store.getCurrentUser();
    const user = Store.getUser(u);
    if (!user) return;
    user.categories[type] = (user.categories[type] || []).filter(c => c !== name);
    Store.saveUser(u, user);
    UI.refreshCategories();
    UI.toast('Kategori silindi', 'info');
  }

  function renderManageList() {
    const incBox = document.getElementById('cat-list-income');
    const expBox = document.getElementById('cat-list-expense');
    if (!incBox) return;
    const income = list('income');
    const expense = list('expense');
    incBox.innerHTML = income.map(c => `
      <div class="cat-manage-item"><span>${UI.escape(c)}</span>
      <button data-cat-remove="income" data-cat-name="${UI.escape(c)}"><i class="fa-solid fa-trash"></i></button></div>
    `).join('') || '<p style="font-size:.8rem;color:var(--text-muted)">Kategori yok</p>';
    expBox.innerHTML = expense.map(c => `
      <div class="cat-manage-item"><span>${UI.escape(c)}</span>
      <button data-cat-remove="expense" data-cat-name="${UI.escape(c)}"><i class="fa-solid fa-trash"></i></button></div>
    `).join('') || '<p style="font-size:.8rem;color:var(--text-muted)">Kategori yok</p>';
  }

  return { list, add, remove, renderManageList };
})();