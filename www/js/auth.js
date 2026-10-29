/* PIN + Profil fotoğrafı giriş katmanı */
const Auth = (() => {
  let pendingAvatar = null;

  function bind() {
    const form = document.getElementById('login-form');
    const userInput = document.getElementById('username-input');
    const pinInput = document.getElementById('pin-input');
    const pinConfirm = document.getElementById('pin-confirm');
    const confirmGroup = document.getElementById('pin-confirm-group');
    const hint = document.getElementById('auth-hint');
    const avatarFile = document.getElementById('avatar-file');
    const avatarPreview = document.getElementById('avatar-preview');

    // Avatar önizleme
    avatarFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) {
        UI.toast('Fotoğraf 500KB\'den büyük olamaz', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        pendingAvatar = ev.target.result;
        avatarPreview.innerHTML = `<img src="${pendingAvatar}" alt="avatar">`;
      };
      reader.readAsDataURL(file);
    });

    // Kullanıcı adı yazılınca yeni mi mevcut mu anla
    userInput.addEventListener('input', () => {
      const u = userInput.value.trim();
      const existing = Store.getUser(u);
      if (existing) {
        confirmGroup.style.display = 'none';
        hint.textContent = 'Mevcut kullanıcı — PIN ile giriş yapın.';
        pendingAvatar = null;
      } else {
        confirmGroup.style.display = 'block';
        hint.textContent = 'Yeni kullanıcı oluşturulacak — PIN belirleyin.';
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = userInput.value.trim();
      const pin = pinInput.value.trim();
      if (!username || pin.length < 4 || pin.length > 6) {
        UI.toast('PIN 4-6 haneli olmalı', 'error');
        return;
      }
      const existing = Store.getUser(username);
      if (existing) {
        if (!Store.verifyPin(username, pin)) {
          UI.toast('PIN hatalı!', 'error');
          return;
        }
        if (pendingAvatar) {
          existing.profile.avatar = pendingAvatar;
          Store.saveUser(username, existing);
        }
      } else {
        const confirm = pinConfirm.value.trim();
        if (confirm !== pin) {
          UI.toast('PIN\'ler eşleşmiyor', 'error');
          return;
        }
        Store.createUser(username, pin, pendingAvatar);
      }
      Store.setCurrentUser(username);
      UI.showApp();
    });
  }

  return { bind };
})();