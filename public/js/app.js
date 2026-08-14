const API_BASE_URL = window.location.origin;
const translations = {
  id: {
    app_name: 'Anonymous Chat',
    tagline: 'Chat anonim dengan aman',
    login: 'Masuk',
    register: 'Daftar',
    logout: 'Keluar',
    email: 'Email',
    password: 'Kata Sandi',
    confirm_password: 'Konfirmasi Kata Sandi',
    forgot_password: 'Lupa Kata Sandi',
    reset_password: 'Atur Ulang Kata Sandi',
    send_reset_link: 'Kirim Tautan Reset',
    verify_email: 'Verifikasi Email',
    verification_sent: 'Email verifikasi telah dikirim',
    settings: 'Pengaturan',
    profile: 'Profil',
    privacy: 'Privasi',
    notifications: 'Notifikasi',
    language: 'Bahasa',
    theme: 'Tampilan',
    blocked_users: 'Pengguna Diblokir',
    security: 'Keamanan',
    data_management: 'Pengelolaan Data',
    delete_account: 'Hapus Akun',
    start_chat: 'Mulai Chat',
    find_friend: 'Cari Teman',
    searching: 'Mencari...',
    stop_searching: 'Hentikan Pencarian',
    match_found: 'Match Ditemukan',
    you_matched_with: 'Anda cocok dengan',
    start_conversation: 'Mulai Percakapan',
    type_message: 'Ketik pesan...',
    send: 'Kirim',
    reply: 'Balas',
    copy: 'Salin',
    delete: 'Hapus',
    report: 'Laporkan',
    block: 'Blokir',
    end_chat: 'Akhiri Chat',
    online: 'Online',
    offline: 'Offline',
    typing: 'Mengetik...',
    delivered: 'Terkirim',
    read: 'Dibaca',
    sent: 'Terkirim',
    message_copied: 'Pesan disalin',
    message_deleted: 'Pesan dihapus',
    report_submitted: 'Laporan terkirim',
    user_blocked: 'Pengguna diblokir',
    chat_ended: 'Chat diakhiri',
    error_occurred: 'Terjadi kesalahan',
    try_again: 'Coba lagi',
    loading: 'Memuat...',
    no_messages: 'Belum ada pesan',
    no_users_found: 'Tidak ada pengguna ditemukan',
    confirm: 'Konfirmasi',
    cancel: 'Batal',
    save: 'Simpan',
    delete_confirm: 'Apakah Anda yakin ingin menghapus?',
    block_confirm: 'Apakah Anda yakin ingin memblokir pengguna ini?',
    end_chat_confirm: 'Apakah Anda yakin ingin mengakhiri chat?',
    report_confirm: 'Apakah Anda yakin ingin melaporkan?',
    report_reason: 'Alasan laporan',
    report_description: 'Deskripsi laporan',
    spam: 'Spam',
    harassment: 'Pelecehan',
    inappropriate: 'Konten tidak pantas',
    other: 'Lainnya',
    language_updated: 'Bahasa diperbarui',
    settings_saved: 'Pengaturan disimpan',
    password_changed: 'Kata sandi berhasil diubah',
    account_deleted: 'Akun berhasil dihapus',
    appeal: 'Ajukan Banding',
    appeal_submitted: 'Banding terkirim',
    appeal_text: 'Teks banding',
    banned_message: 'Akun Anda telah diblokir',
    suspended_message: 'Akun Anda ditangguhkan',
    restricted_message: 'Akun Anda dibatasi',
    verification_required: 'Verifikasi email diperlukan',
    check_email: 'Periksa email Anda untuk tautan verifikasi',
    resend_verification: 'Kirim ulang verifikasi',
    password_requirements: 'Kata sandi harus memiliki minimal 8 karakter, huruf besar, huruf kecil, angka, dan karakter khusus',
    welcome_back: 'Selamat datang kembali',
    create_account: 'Buat akun baru',
    join_message: 'Bergabunglah untuk mulai chat anonim',
    have_account: 'Sudah punya akun?',
    dont_have_account: 'Belum punya akun?',
    dashboard: 'Dasbor',
    users: 'Pengguna',
    conversations: 'Percakapan',
    reports: 'Laporan',
    moderation: 'Moderasi',
    blocks: 'Pemblokiran',
    activity_logs: 'Log Aktivitas',
    system_settings: 'Pengaturan Sistem',
    total_users: 'Total Pengguna',
    active_users: 'Pengguna Aktif',
    banned_users: 'Pengguna Diblokir',
    pending_reports: 'Laporan Tertunda',
    active_conversations: 'Percakapan Aktif',
    messages_24h: 'Pesan 24 Jam',
    new_users_24h: 'Pengguna Baru 24 Jam',
    waiting_users: 'Menunggu Match'
  },
  en: {
    app_name: 'Anonymous Chat',
    tagline: 'Chat anonymously and safely',
    login: 'Login',
    register: 'Register',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    confirm_password: 'Confirm Password',
    forgot_password: 'Forgot Password',
    reset_password: 'Reset Password',
    send_reset_link: 'Send Reset Link',
    verify_email: 'Verify Email',
    verification_sent: 'Verification email has been sent',
    settings: 'Settings',
    profile: 'Profile',
    privacy: 'Privacy',
    notifications: 'Notifications',
    language: 'Language',
    theme: 'Appearance',
    blocked_users: 'Blocked Users',
    security: 'Security',
    data_management: 'Data Management',
    delete_account: 'Delete Account',
    start_chat: 'Start Chat',
    find_friend: 'Find Friend',
    searching: 'Searching...',
    stop_searching: 'Stop Searching',
    match_found: 'Match Found',
    you_matched_with: 'You matched with',
    start_conversation: 'Start Conversation',
    type_message: 'Type a message...',
    send: 'Send',
    reply: 'Reply',
    copy: 'Copy',
    delete: 'Delete',
    report: 'Report',
    block: 'Block',
    end_chat: 'End Chat',
    online: 'Online',
    offline: 'Offline',
    typing: 'Typing...',
    delivered: 'Delivered',
    read: 'Read',
    sent: 'Sent',
    message_copied: 'Message copied',
    message_deleted: 'Message deleted',
    report_submitted: 'Report submitted',
    user_blocked: 'User blocked',
    chat_ended: 'Chat ended',
    error_occurred: 'An error occurred',
    try_again: 'Try again',
    loading: 'Loading...',
    no_messages: 'No messages yet',
    no_users_found: 'No users found',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    delete_confirm: 'Are you sure you want to delete?',
    block_confirm: 'Are you sure you want to block this user?',
    end_chat_confirm: 'Are you sure you want to end this chat?',
    report_confirm: 'Are you sure you want to report?',
    report_reason: 'Report reason',
    report_description: 'Report description',
    spam: 'Spam',
    harassment: 'Harassment',
    inappropriate: 'Inappropriate content',
    other: 'Other',
    language_updated: 'Language updated',
    settings_saved: 'Settings saved',
    password_changed: 'Password changed successfully',
    account_deleted: 'Account deleted successfully',
    appeal: 'Submit Appeal',
    appeal_submitted: 'Appeal submitted',
    appeal_text: 'Appeal text',
    banned_message: 'Your account has been banned',
    suspended_message: 'Your account has been suspended',
    restricted_message: 'Your account is restricted',
    verification_required: 'Email verification required',
    check_email: 'Check your email for verification link',
    resend_verification: 'Resend verification',
    password_requirements: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    welcome_back: 'Welcome back',
    create_account: 'Create new account',
    join_message: 'Join to start anonymous chat',
    have_account: 'Already have an account?',
    dont_have_account: 'Don\'t have an account?',
    dashboard: 'Dashboard',
    users: 'Users',
    conversations: 'Conversations',
    reports: 'Reports',
    moderation: 'Moderation',
    blocks: 'Blocks',
    activity_logs: 'Activity Logs',
    system_settings: 'System Settings',
    total_users: 'Total Users',
    active_users: 'Active Users',
    banned_users: 'Banned Users',
    pending_reports: 'Pending Reports',
    active_conversations: 'Active Conversations',
    messages_24h: 'Messages 24h',
    new_users_24h: 'New Users 24h',
    waiting_users: 'Waiting for Match'
  }
};

class App {
  constructor() {
    this.currentLanguage = localStorage.getItem('language') || 'id';
    this.currentUser = null;
    this.socket = null;
    this.init();
  }

  init() {
    this.applyLanguage();
    this.setupGlobalEventListeners();
    this.checkAuthStatus();
  }

  applyLanguage() {
    const lang = this.currentLanguage;
    document.documentElement.lang = lang;
    
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (translations[lang] && translations[lang][key]) {
        element.textContent = translations[lang][key];
      }
    });

    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      if (translations[lang] && translations[lang][key]) {
        element.placeholder = translations[lang][key];
      }
    });
  }

  setupGlobalEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.modal-overlay') && !e.target.closest('.modal')) {
        this.closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  async checkAuthStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.data.user;
        this.onAuthenticated();
      } else {
        this.onUnauthenticated();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.onUnauthenticated();
    }
  }

  onAuthenticated() {
    document.body.classList.add('authenticated');
    const authRequired = document.querySelectorAll('[data-auth-required]');
    authRequired.forEach(el => el.classList.remove('hidden'));
    
    const authHidden = document.querySelectorAll('[data-auth-hidden]');
    authHidden.forEach(el => el.classList.add('hidden'));
  }

  onUnauthenticated() {
    document.body.classList.remove('authenticated');
    const authRequired = document.querySelectorAll('[data-auth-required]');
    authRequired.forEach(el => el.classList.add('hidden'));
    
    const authHidden = document.querySelectorAll('[data-auth-hidden]');
    authHidden.forEach(el => el.classList.remove('hidden'));
  }

  async apiRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          this.onUnauthenticated();
        }
        throw new Error(data.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  connectSocket() {
    if (this.socket && this.socket.connected) {
      return;
    }

    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      
      const token = this.getCookie('token');
      if (token && this.currentUser) {
        this.socket.emit('authenticate', {
          userId: this.currentUser.id,
          token
        });
      }
    });

    this.socket.on('authenticated', () => {
      console.log('Socket authenticated');
      this.onSocketAuthenticated();
    });

    this.socket.on('auth_error', (data) => {
      console.error('Socket authentication failed:', data.message);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.onSocketDisconnected();
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt:', attemptNumber);
    });
  }

  onSocketAuthenticated() {}
  onSocketDisconnected() {}

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-sm">${message}</span>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeIn 150ms ease reverse';
      setTimeout(() => {
        toast.remove();
      }, 150);
    }, 3000);
  }

  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  showModal(content, options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = content;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    return {
      close: () => {
        overlay.remove();
      },
      modal,
      overlay
    };
  }

  closeModal() {
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(overlay => overlay.remove());
  }

  showConfirm(message, onConfirm, onCancel) {
    const modal = this.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${this.t('confirm')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <p class="mb-3">${message}</p>
      <div class="flex gap-2 justify-end">
        <button class="btn btn-secondary" onclick="app.closeModal(); ${onCancel ? 'app.confirmCancel()' : ''}">
          ${this.t('cancel')}
        </button>
        <button class="btn btn-danger" id="confirm-button">
          ${this.t('confirm')}
        </button>
      </div>
    `);

    document.getElementById('confirm-button').addEventListener('click', () => {
      modal.close();
      if (onConfirm) onConfirm();
    });

    this._confirmCancelCallback = onCancel;
  }

  confirmCancel() {
    if (this._confirmCancelCallback) {
      this._confirmCancelCallback();
      this._confirmCancelCallback = null;
    }
  }

  t(key) {
    return translations[this.currentLanguage][key] || key;
  }

  setLanguage(lang) {
    if (translations[lang]) {
      this.currentLanguage = lang;
      localStorage.setItem('language', lang);
      this.applyLanguage();
    }
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
      return this.t('just_now');
    }

    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m`;
    }

    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h`;
    }

    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d`;
    }

    return date.toLocaleDateString();
  }

  formatFullTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  escapeHTML(str) {
    return this.sanitizeHTML(str);
  }
}

const app = new App();
window.app = app;
