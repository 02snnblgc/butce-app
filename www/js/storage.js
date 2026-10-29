/* Storage + Migration katmanı */
const Store = (() => {
  const DB_KEY = 'bud_db_v2';
  const USER_KEY = 'bud_user';
  const SETTINGS_KEY = 'bud_settings';
  const LEGACY_DB = 'bud_db';
  const LEGACY_CATS = 'bud_custom_categories';

  const DEFAULT_CATEGORIES = {
    income: ['Maaş', 'Ek Gelir', 'Kira Geliri', 'Faiz / Yatırım', 'Diğer Gelir'],
    expense: [
      'ZİRAAT BANKASI TROY','ZİRAAT BANKASI M.CARD','HALK BANKASI TROY','HALK BANKASI M.CARD',
      'TÜRKİYE FİNANS','ELEKTRİK FATURASI','SU FATURASI','DOĞALGAZ FATURASI',
      'SICAK SU DOĞALGAZ FATURASI','İNTERNET FATURASI','SİTE AİDATI',
      'SABİHA TELEFON FATURASI','SİNAN TELEFON FATURASI','HÜDA NUR TELEFON',
      'HÜDA NUR AYLIK','SABİHAYA','SİNANA','TRAŞ İÇİN','İŞYERİ YEMEK','İŞYERİ ÇAY',
      'İŞYERİ SU','ARAÇ SİGORTASI','ARAÇ MUAYENESİ','ARAÇ BAKIMI','ARAÇ LASTİĞİ',
      'Kira / Konut','Mutfak & Market','Eğitim & Kurs','Sağlık & Bakım','Diğer'
    ]
  };

  function readJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  }
  function writeJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  /* Eski yapıyı yeni yapıya çevir */
  function migrate() {
    const legacy = readJSON(LEGACY_DB, null);
    const existing = readJSON(DB_KEY, null);

    // Zaten yeni yapı varsa dokunma
    if (existing && existing.__schema >= 2) return;

    const newDb = { __schema: 2, users: {} };

    if (legacy && typeof legacy === 'object') {
      // Eski yapı: { username: { "2025-01": { transactions:[], notes:"" } } }
      Object.entries(legacy).forEach(([username, periods]) => {
        if (username.startsWith('__')) return;
        const user = ensureUserObject(newDb, username);
        if (!periods || typeof periods !== 'object') return;
        Object.entries(periods).forEach(([period, data]) => {
          if (!/^\d{4}-\d{2}$/.test(period)) return;
          const p = ensurePeriod(user, period);
          p.notes = data.notes || '';
          (data.transactions || []).forEach(tx => {
            p.transactions.push({
              id: genId(),
              type: tx.type === 'income' ? 'income' : 'expense',
              category: tx.category || (tx.type === 'income' ? 'Diğer Gelir' : 'Diğer'),
              title: tx.title || '',
              amount: Number(tx.amount) || 0,
              date: tx.date || '',
              paid: tx.type === 'income' ? true : false, // eski veride bilinmiyor → ödenmemiş
              recurring: false,
              createdAt: Date.now()
            });
          });
        });
      });
    }

    // Custom kategorileri de taşı
    const legacyCats = readJSON(LEGACY_CATS, []);
    if (Array.isArray(legacyCats) && legacyCats.length) {
      // Global değil, her kullanıcıya ekle (ilk kullanıcıya) — basit yaklaşım:
      // Hepsini "expense" olarak kullanıcı bazlı dağıtmak yerine genel kategori havuzuna yaz
      newDb.__globalCustomCats = { income: [], expense: legacyCats };
    }

    writeJSON(DB_KEY, newDb);
  }

  function ensureUserObject(db, username) {
    if (!db.users[username]) {
      db.users[username] = {
        profile: { avatar: null, createdAt: Date.now() },
        pin: null,
        categories: {
          income: [...DEFAULT_CATEGORIES.income],
          expense: [...DEFAULT_CATEGORIES.expense]
        },
        periods: {},
        settings: { currency: 'TRY' }
      };
    }
    return db.users[username];
  }

  function ensurePeriod(user, period) {
    if (!user.periods[period]) {
      user.periods[period] = { transactions: [], notes: '', budgetLimit: 0 };
    }
    return user.periods[period];
  }

  function genId() {
    return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* ==== API ==== */
  function getDb() { return readJSON(DB_KEY, { __schema: 2, users: {} }); }
  function saveDb(db) { writeJSON(DB_KEY, db); }

  function getUser(username) {
    const db = getDb();
    if (!db.users[username]) return null;
    return db.users[username];
  }

  function createUser(username, pin, avatar) {
    const db = getDb();
    const user = ensureUserObject(db, username);
    if (pin) user.pin = hashPin(pin);
    if (avatar) user.profile.avatar = avatar;
    saveDb(db);
    return user;
  }

  function saveUser(username, userObj) {
    const db = getDb();
    db.users[username] = userObj;
    saveDb(db);
  }

  function getPeriod(username, period) {
    const user = getUser(username);
    if (!user) return null;
    return user.periods[period] || null;
  }

  function savePeriod(username, period, data) {
    const db = getDb();
    const user = ensureUserObject(db, username);
    user.periods[period] = data;
    saveDb(db);
  }

  /* Basit hash (güvenlik amaçlı değil, sadece PIN saklamak için) */
  function hashPin(pin) {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h) + pin.charCodeAt(i);
      h |= 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }
  function verifyPin(username, pin) {
    const user = getUser(username);
    if (!user || !user.pin) return false;
    return user.pin === hashPin(pin);
  }

  /* ==== Auth ==== */
  function getCurrentUser() { return localStorage.getItem(USER_KEY); }
  function setCurrentUser(u) {
    if (u) localStorage.setItem(USER_KEY, u);
    else localStorage.removeItem(USER_KEY);
  }

  /* ==== Settings ==== */
  function getSettings() {
    return readJSON(SETTINGS_KEY, {
      theme: 'light', accent: 'lavender', currency: 'TRY',
      notif: false, sound: true, alarm: true
    });
  }
  function saveSettings(s) { writeJSON(SETTINGS_KEY, s); }

  return {
    migrate, getDb, getUser, createUser, saveUser,
    getPeriod, savePeriod, verifyPin, hashPin, genId,
    getCurrentUser, setCurrentUser,
    getSettings, saveSettings,
    DEFAULT_CATEGORIES,
    readJSON, writeJSON
  };
})();

// Sayfa yüklenir yüklenmez migrate et
Store.migrate();