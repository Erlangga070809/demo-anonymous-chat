class SettingsManager {
  constructor() {
    this.currentUser = null;
    this.blockedUsers = [];
    this.init();
  }

  async init() {
    await this.loadUserData();
    this.setupEventListeners();
    this.setupNavigation();
  }

  async loadUserData() {
    try {
      const response = await app.apiRequest('/auth/me');
      
      if (response.success) {
        this.currentUser = response.data.user;
        this.displayUserInfo();
        this.loadSettings();
        this.loadBlockedUsers();
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  displayUserInfo() {
    const anonymousId = document.getElementById('anonymous-id');
    const email = document.getElementById('user-email');
    const status = document.getElementById('user-status');

    if (anonymousId) anonymousId.textContent = this.currentUser.anonymousId;
    if (email) email.textContent = this.currentUser.email;
    
    if (status) {
      const statusMap = {
        active: { text: 'Active', class: 'badge-success' },
        suspended: { text: 'Suspended', class: 'badge-danger' },
        banned: { text: 'Banned', class: 'badge-danger' },
        restricted: { text: 'Restricted', class: 'badge-warning' }
      };

      const statusInfo = statusMap[this.currentUser.status] || statusMap.active;
      status.innerHTML = `<span class="badge ${statusInfo.class}">${statusInfo.text}</span>`;
    }
  }

  loadSettings() {
    const settings = this.currentUser.settings || {};
    
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.value = settings.language || 'id';
    }

    const notificationsToggle = document.getElementById('notifications-toggle');
    if (notificationsToggle) {
      notificationsToggle.checked = settings.notifications !== false;
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.checked = settings.sound !== false;
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = settings.theme || 'light';
    }
  }

  async loadBlockedUsers() {
    try {
      const response = await app.apiRequest('/users/blocked');
      
      if (response.success) {
        this.blockedUsers = response.data.blockedUsers;
        this.displayBlockedUsers();
      }
    } catch (error) {
      console.error('Failed to load blocked users:', error);
    }
  }

  displayBlockedUsers() {
    const blockedUsersList = document.getElementById('blocked-users-list');
    if (!blockedUsersList) return;

    if (this.blockedUsers.length === 0) {
      blockedUsersList.innerHTML = `
        <div class="text-center text-muted" style="padding: 20px;">
          ${app.t('no_users_found')}
        </div>
      `;
      return;
    }

    blockedUsersList.innerHTML = this.blockedUsers.map(user => `
      <div class="flex items-center justify-between" style="padding: 12px; border-bottom: 1px solid var(--border-light);">
        <div class="flex items-center gap-2">
          <div class="avatar avatar-sm">${user.anonymous_id.charAt(0)}</div>
          <div>
            <div style="font-weight: 500;">${user.anonymous_id}</div>
            <div class="text-muted" style="font-size: 12px;">${app.formatTime(user.created_at)}</div>
          </div>
        </div>
        <button class="btn btn-secondary" onclick="settingsManager.unblockUser('${user.blocked_id}')">
          ${app.t('unblock')}
        </button>
      </div>
    `).join('');
  }

  setupEventListeners() {
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.addEventListener('change', (e) => {
        this.updateLanguage(e.target.value);
      });
    }

    const notificationsToggle = document.getElementById('notifications-toggle');
    if (notificationsToggle) {
      notificationsToggle.addEventListener('change', () => {
        this.updateSettings();
      });
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('change', () => {
        this.updateSettings();
      });
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        this.updateSettings();
      });
    }

    const saveSettingsButton = document.getElementById('save-settings-button');
    if (saveSettingsButton) {
      saveSettingsButton.addEventListener('click', () => {
        this.updateSettings();
      });
    }

    const deleteAccountButton = document.getElementById('delete-account-button');
    if (deleteAccountButton) {
      deleteAccountButton.addEventListener('click', () => {
        this.showDeleteAccountModal();
      });
    }

    const changePasswordButton = document.getElementById('change-password-button');
    if (changePasswordButton) {
      changePasswordButton.addEventListener('click', () => {
        this.showChangePasswordModal();
      });
    }

    const exportDataButton = document.getElementById('export-data-button');
    if (exportDataButton) {
      exportDataButton.addEventListener('click', () => {
        this.exportData();
      });
    }

    const appealButton = document.getElementById('appeal-button');
    if (appealButton) {
      appealButton.addEventListener('click', () => {
        this.showAppealModal();
      });
    }

    const privacySettings = document.querySelectorAll('.privacy-toggle');
    privacySettings.forEach(toggle => {
      toggle.addEventListener('change', () => {
        this.updatePrivacySettings();
      });
    });
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');

    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetSection = item.getAttribute('data-section');

        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        sections.forEach(section => {
          if (section.id === `${targetSection}-section`) {
            section.classList.remove('hidden');
          } else {
            section.classList.add('hidden');
          }
        });
      });
    });
  }

  async updateLanguage(language) {
    try {
      await app.apiRequest('/auth/settings', {
        method: 'PUT',
        body: JSON.stringify({ language })
      });

      app.setLanguage(language);
      app.showToast(app.t('language_updated'), 'success');
    } catch (error) {
      console.error('Failed to update language:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  async updateSettings() {
    const languageSelect = document.getElementById('language-select');
    const notificationsToggle = document.getElementById('notifications-toggle');
    const soundToggle = document.getElementById('sound-toggle');
    const themeSelect = document.getElementById('theme-select');

    const settings = {
      language: languageSelect?.value || 'id',
      notifications: notificationsToggle?.checked !== false,
      sound: soundToggle?.checked !== false,
      theme: themeSelect?.value || 'light'
    };

    try {
      await app.apiRequest('/auth/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      app.showToast(app.t('settings_saved'), 'success');
    } catch (error) {
      console.error('Failed to update settings:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  async updatePrivacySettings() {
    const showOnlineStatus = document.getElementById('show-online-status')?.checked;
    const allowMessagesFromStrangers = document.getElementById('allow-messages-from-strangers')?.checked;
    const shareTypingStatus = document.getElementById('share-typing-status')?.checked;
    const shareReadReceipts = document.getElementById('share-read-receipts')?.checked;

    try {
      await app.apiRequest('/users/privacy', {
        method: 'PUT',
        body: JSON.stringify({
          showOnlineStatus,
          allowMessagesFromStrangers,
          shareTypingStatus,
          shareReadReceipts
        })
      });

      app.showToast(app.t('settings_saved'), 'success');
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  async unblockUser(userId) {
    app.showConfirm(app.t('unblock_confirm'), async () => {
      try {
        await app.apiRequest(`/users/block/${userId}`, {
          method: 'DELETE'
        });

        app.showToast(app.t('user_unblocked'), 'success');
        this.loadBlockedUsers();
      } catch (error) {
        console.error('Failed to unblock user:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }

  showDeleteAccountModal() {
    const modal = app.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${app.t('delete_account')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <p class="mb-3 text-danger" style="color: #EF4444;">
        ${app.t('delete_account_warning')}
      </p>
      <div class="mb-3">
        <label class="label">${app.t('password')}</label>
        <input type="password" id="delete-password" class="input" placeholder="${app.t('enter_password')}">
      </div>
      <button class="btn btn-danger" id="confirm-delete-button">
        ${app.t('delete_account')}
      </button>
    `);

    document.getElementById('confirm-delete-button').addEventListener('click', async () => {
      const password = document.getElementById('delete-password').value;

      if (!password) {
        app.showToast(app.t('password_required'), 'error');
        return;
      }

      app.showConfirm(app.t('delete_confirm'), async () => {
        try {
          await app.apiRequest('/auth/account', {
            method: 'DELETE',
            body: JSON.stringify({ password })
          });

          modal.close();
          app.showToast(app.t('account_deleted'), 'success');
          
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 2000);
        } catch (error) {
          console.error('Failed to delete account:', error);
          app.showToast(app.t('error_occurred'), 'error');
        }
      });
    });
  }

  showChangePasswordModal() {
    const modal = app.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${app.t('change_password')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="mb-3">
        <label class="label">${app.t('current_password')}</label>
        <input type="password" id="current-password" class="input">
      </div>
      <div class="mb-3">
        <label class="label">${app.t('new_password')}</label>
        <input type="password" id="new-password" class="input">
      </div>
      <div class="mb-3">
        <label class="label">${app.t('confirm_new_password')}</label>
        <input type="password" id="confirm-new-password" class="input">
      </div>
      <button class="btn btn-primary" id="change-password-confirm-button">
        ${app.t('change_password')}
      </button>
    `);

    document.getElementById('change-password-confirm-button').addEventListener('click', async () => {
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmNewPassword = document.getElementById('confirm-new-password').value;

      if (newPassword !== confirmNewPassword) {
        app.showToast(app.t('passwords_dont_match'), 'error');
        return;
      }

      try {
        await app.apiRequest('/auth/change-password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword })
        });

        modal.close();
        app.showToast(app.t('password_changed'), 'success');
      } catch (error) {
        console.error('Failed to change password:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }

  async exportData() {
    try {
      const response = await app.apiRequest('/users/export-data');
      
      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `user-data-${Date.now()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        app.showToast(app.t('data_exported'), 'success');
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  showAppealModal() {
    const modal = app.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${app.t('appeal')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="mb-3">
        <label class="label">${app.t('appeal_text')}</label>
        <textarea id="appeal-text" class="input" rows="5" placeholder="${app.t('appeal_placeholder')}"></textarea>
      </div>
      <button class="btn btn-primary" id="submit-appeal-button">
        ${app.t('submit')}
      </button>
    `);

    document.getElementById('submit-appeal-button').addEventListener('click', async () => {
      const appealText = document.getElementById('appeal-text').value;

      if (!appealText.trim()) {
        app.showToast(app.t('appeal_text_required'), 'error');
        return;
      }

      try {
        await app.apiRequest('/reports/appeal', {
          method: 'POST',
          body: JSON.stringify({ appealText })
        });

        modal.close();
        app.showToast(app.t('appeal_submitted'), 'success');
      } catch (error) {
        console.error('Failed to submit appeal:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }
}

const settingsManager = new SettingsManager();
window.settingsManager = settingsManager;
