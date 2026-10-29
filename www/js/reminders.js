/* Sesli + görüntülü alarm + tarayıcı bildirimi */
const Reminders = (() => {
  let audioCtx = null;
  let alarmInterval = null;
  let currentAlarmId = null;
  let snoozed = {}; // { txId: timestamp }
  let notifPermission = Notification?.permission === 'granted';

  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  /* Bip sesi çal (alarm) */
  function beep(times = 3, freq = 880, dur = 0.18, gap = 0.22) {
    const s = Store.getSettings();
    if (!s.sound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += gap;
    }
  }

  function playAlarmLoop() {
    stopAlarmLoop();
    const s = Store.getSettings();
    if (!s.sound) return;
    // İlk bip hemen
    beep(4, 1000, 0.2, 0.25);
    // 3 saniyede bir tekrar
    alarmInterval = setInterval(() => {
      const s2 = Store.getSettings();
      if (!s2.sound) return;
      beep(3, 1200, 0.15, 0.2);
    }, 3000);
  }

  function stopAlarmLoop() {
    if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
  }

  /* Görüntülü alarm modalı */
  function showAlarmModal(txs) {
    const s = Store.getSettings();
    if (!s.alarm) return;
    const modal = document.getElementById('alarm-modal');
    const body = document.getElementById('alarm-body');
    body.innerHTML = txs.map(t => `
      <div style="padding:8px;border-bottom:1px solid var(--border-color);">
        <strong>${UI.escape(t.title)}</strong><br>
        <span style="color:var(--text-muted);font-size:.82rem">
          ${t.category ? UI.escape(t.category) + ' • ' : ''}${UI.escape(t.date)} • ${UI.fmt(t.amount)}
        </span>
      </div>
    `).join('');
    modal.classList.add('open');
    currentAlarmId = txs.map(t => t.id);
    playAlarmLoop();
  }

  function closeAlarm() {
    document.getElementById('alarm-modal').classList.remove('open');
    stopAlarmLoop();
    currentAlarmId = null;
  }

  function snooze() {
    if (currentAlarmId) {
      const until = Date.now() + 10 * 60 * 1000;
      currentAlarmId.forEach(id => snoozed[id] = until);
    }
    closeAlarm();
    UI.toast('10 dakika ertelendi', 'info');
  }

  /* Yaklaşan / geçmiş ödemeleri bul */
  function findDue() {
    const data = Transactions.getData();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = [];
    data.transactions.forEach(t => {
      if (t.type !== 'expense' || t.paid || !t.date) return;
      const txDate = new Date(t.date + 'T00:00:00');
      txDate.setHours(0, 0, 0, 0);
      const diff = Math.ceil((txDate - today) / (1000 * 60 * 60 * 24));
      if (diff <= 0) {
        const sn = snoozed[t.id];
        if (sn && sn > Date.now()) return;
        due.push({ ...t, _diff: diff });
      }
    });
    return due;
  }

  /* Tarayıcı bildirimi */
  async function requestNotif() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') { notifPermission = true; return true; }
    if (Notification.permission === 'denied') return false;
    const p = await Notification.requestPermission();
    notifPermission = p === 'granted';
    const s = Store.getSettings();
    s.notif = notifPermission;
    Store.saveSettings(s);
    return notifPermission;
  }

  function sendNotif(title, body) {
    const s = Store.getSettings();
    if (!s.notif || !notifPermission) return;
    try {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%92%B0%3C/text%3E%3C/svg%3E',
            badge: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E%F0%9F%92%B0%3C/text%3E%3C/svg%3E',
            tag: 'butce-alarm-' + Date.now(),
            requireInteraction: true,
            vibrate: [200, 100, 200]
          });
        });
      } else {
        new Notification(title, { body });
      }
    } catch (e) { /* sessiz geç */ }
  }

  /* Ana kontrol — her renderAll sonrası veya interval ile çalışır */
  function checkAndAlarm(silent = false) {
    const due = findDue();
    // Banner güncelle
    const banner = document.getElementById('alert-banner');
    const text = document.getElementById('alert-banner-text');
    if (due.length > 0) {
      banner.style.display = 'flex';
      text.textContent = `${due.length} adet ödeme tarihi geldi/geçti! Bunları ödediyseniz "Ödendi" olarak işaretleyin.`;
    } else {
      banner.style.display = 'none';
    }

    if (due.length > 0 && !silent) {
      // Sesli + görüntülü
      const s = Store.getSettings();
      if (s.alarm) showAlarmModal(due);
      if (s.notif) sendNotif('💰 Ödeme Hatırlatması', `${due.length} işlem için ödeme zamanı geldi!`);
    }
  }

  function bind() {
    document.getElementById('alarm-ack').addEventListener('click', closeAlarm);
    document.getElementById('alarm-snooze').addEventListener('click', snooze);

    // Kullanıcı etkileşiminde audio context aç (tarayıcı politikası)
    document.body.addEventListener('click', () => ensureAudio(), { once: true });

    // Her 30 saniyede kontrol (sekme açıkken)
    setInterval(() => checkAndAlarm(false), 30000);

    // Uygulama görünür olunca kontrol
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkAndAlarm(false);
    });

    // Alarm test butonu
    document.getElementById('btn-test-alarm').addEventListener('click', () => {
      showAlarmModal([{ title: 'Test Alarmı', category: 'Sistem', date: new Date().toISOString().slice(0,10), amount: 0 }]);
      if (Store.getSettings().notif) sendNotif('Test Alarmı', 'Bildirimler çalışıyor.');
    });

    // Bildirim izni toggle
    document.getElementById('notif-toggle').addEventListener('change', async (e) => {
      const s = Store.getSettings();
      if (e.target.checked) {
        const ok = await requestNotif();
        if (!ok) {
          e.target.checked = false;
          UI.toast('Bildirim izni verilmedi', 'error');
          s.notif = false;
        } else {
          s.notif = true;
          UI.toast('Bildirimler açık', 'success');
        }
      } else {
        s.notif = false;
      }
      Store.saveSettings(s);
    });

    document.getElementById('sound-toggle').addEventListener('change', (e) => {
      const s = Store.getSettings(); s.sound = e.target.checked; Store.saveSettings(s);
    });
    document.getElementById('alarm-toggle').addEventListener('change', (e) => {
      const s = Store.getSettings(); s.alarm = e.target.checked; Store.saveSettings(s);
    });
  }

  function requestPermissionOnFirstUse() {
    if ('Notification' in window && Notification.permission === 'default') {
      requestNotif();
    }
  }

  return { bind, checkAndAlarm, requestNotif, sendNotif, beep, requestPermissionOnFirstUse };
})();