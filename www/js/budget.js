/* Bütçe limiti kontrolü */
const Budget = (() => {
  function getLimit() {
    return Transactions.getData().budgetLimit || 0;
  }
  function setLimit(v) {
    const data = Transactions.getData();
    data.budgetLimit = Number(v) || 0;
    Transactions.saveData(data);
  }
  function check() {
    const limit = getLimit();
    const banner = document.getElementById('budget-banner');
    const text = document.getElementById('budget-banner-text');
    if (!limit || limit <= 0) { banner.style.display = 'none'; return; }
    const { expense } = Transactions.sum();
    if (expense > limit) {
      banner.style.display = 'flex';
      text.textContent = `Bütçe aşıldı! Limit: ${UI.fmt(limit)} — Gider: ${UI.fmt(expense)} (Aşım: ${UI.fmt(expense - limit)})`;
    } else if (expense > limit * 0.8) {
      banner.style.display = 'flex';
      text.textContent = `Bütçenin %${Math.round(expense / limit * 100)}'ini kullandınız. Kalan: ${UI.fmt(limit - expense)}`;
    } else {
      banner.style.display = 'none';
    }
  }
  function bind() {
    document.getElementById('btn-save-budget').addEventListener('click', () => {
      const v = document.getElementById('budget-limit').value;
      setLimit(v);
      UI.toast('Bütçe limiti kaydedildi', 'success');
      UI.renderAll();
    });
  }
  function openModal() {
    document.getElementById('budget-limit').value = getLimit() || '';
    document.getElementById('budget-modal').classList.add('open');
  }
  return { getLimit, setLimit, check, bind, openModal };
})();