class DashboardManager {
  constructor() {
    this.currentSection = 'dashboard';
    this.usersData = [];
    this.reportsData = [];
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.init();
  }

  async init() {
    this.setupNavigation();
    this.setupEventListeners();
    await this.loadDashboardData();
  }

  setupNavigation() {
    const navItems = document.querySelectorAll('.dashboard-nav-item');
    const sections = document.querySelectorAll('.dashboard-section');

    navItems.forEach(item => {
      item.addEventListener('click', async () => {
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

        this.currentSection = targetSection;
        await this.loadSectionData(targetSection);
      });
    });
  }

  setupEventListeners() {
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', app.debounce(() => {
        this.searchUsers(searchInput.value);
      }, 500));
    }

    const statusFilter = document.getElementById('user-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.filterUsers();
      });
    }

    const reportFilter = document.getElementById('report-status-filter');
    if (reportFilter) {
      reportFilter.addEventListener('change', () => {
        this.loadReports(reportFilter.value);
      });
    }

    const refreshButton = document.getElementById('refresh-data-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        this.refreshCurrentSection();
      });
    }
  }

  async loadSectionData(section) {
    switch (section) {
      case 'dashboard':
        await this.loadDashboardData();
        break;
      case 'users':
        await this.loadUsers();
        break;
      case 'conversations':
        await this.loadConversations();
        break;
      case 'reports':
        await this.loadReports();
        break;
      case 'moderation':
        await this.loadModerationLogs();
        break;
      case 'activity':
        await this.loadActivityLogs();
        break;
      default:
        break;
    }
  }

  async loadDashboardData() {
    try {
      const response = await app.apiRequest('/admin/dashboard/stats');
      
      if (response.success) {
        const stats = response.data;
        this.updateDashboardStats(stats);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  updateDashboardStats(stats) {
    const statElements = {
      total_users: document.getElementById('stat-total-users'),
      active_users: document.getElementById('stat-active-users'),
      banned_users: document.getElementById('stat-banned-users'),
      pending_reports: document.getElementById('stat-pending-reports'),
      active_conversations: document.getElementById('stat-active-conversations'),
      messages_24h: document.getElementById('stat-messages-24h'),
      new_users_24h: document.getElementById('stat-new-users-24h'),
      waiting_users: document.getElementById('stat-waiting-users')
    };

    Object.keys(statElements).forEach(key => {
      const element = statElements[key];
      if (element && stats[key] !== undefined) {
        element.textContent = stats[key];
      }
    });

    this.renderChart(stats);
  }

  renderChart(stats) {
    const chartContainer = document.getElementById('user-activity-chart');
    if (!chartContainer) return;

    const maxValue = Math.max(stats.new_users_24h, stats.active_users, 1);
    const bars = [
      { label: app.t('new_users_24h'), value: stats.new_users_24h, color: '#6366F1' },
      { label: app.t('active_users'), value: stats.active_users, color: '#10B981' },
      { label: app.t('messages_24h'), value: stats.messages_24h, color: '#F59E0B' },
      { label: app.t('active_conversations'), value: stats.active_conversations, color: '#EF4444' }
    ];

    chartContainer.innerHTML = `
      <div class="flex items-end justify-between" style="height: 200px; padding: 20px 0;">
        ${bars.map(bar => `
          <div class="flex flex-col items-center gap-2" style="flex: 1;">
            <div style="
              width: 40px;
              height: ${(bar.value / maxValue) * 150}px;
              background: ${bar.color};
              border-radius: 8px 8px 0 0;
              transition: height 0.5s ease;
            "></div>
            <div style="font-size: 12px; color: var(--text-secondary);">${bar.label}</div>
            <div style="font-size: 14px; font-weight: 600;">${bar.value}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async loadUsers() {
    try {
      const response = await app.apiRequest('/admin/users');
      
      if (response.success) {
        this.usersData = response.data.users;
        this.renderUsersTable(response.data.users);
        this.renderPagination(response.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;

    if (users.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">${app.t('no_users_found')}</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = users.map(user => `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="avatar avatar-sm">${user.anonymous_id.charAt(0)}</div>
            <span>${user.anonymous_id}</span>
          </div>
        </td>
        <td>${user.email}</td>
        <td>
          <span class="badge ${this.getStatusBadgeClass(user.status)}">
            ${user.status}
          </span>
        </td>
        <td>${user.warning_count || 0}</td>
        <td>
          <span class="status-dot ${user.is_online ? '' : 'offline'}"></span>
          ${user.is_online ? app.t('online') : app.t('offline')}
        </td>
        <td>${app.formatTime(user.created_at)}</td>
        <td>
          <div class="flex gap-1">
            <button class="icon-button" onclick="dashboardManager.viewUserDetails('${user.id}')" title="${app.t('view')}">
              👁️
            </button>
            <button class="icon-button" onclick="dashboardManager.showModerateUserModal('${user.id}')" title="${app.t('moderate')}">
              ⚙️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  getStatusBadgeClass(status) {
    const statusMap = {
      active: 'badge-success',
      suspended: 'badge-warning',
      banned: 'badge-danger',
      restricted: 'badge-muted'
    };
    return statusMap[status] || 'badge-muted';
  }

  renderPagination(data) {
    const paginationContainer = document.getElementById('users-pagination');
    if (!paginationContainer) return;

    const totalPages = data.totalPages || 1;
    const currentPage = data.page || 1;

    paginationContainer.innerHTML = `
      <div class="pagination-info">
        ${data.total} ${app.t('users')} | ${app.t('page')} ${currentPage} / ${totalPages}
      </div>
      <div class="pagination-buttons">
        <button class="pagination-button" ${currentPage === 1 ? 'disabled' : ''} onclick="dashboardManager.changePage(${currentPage - 1})">
          ←
        </button>
        ${this.generatePageButtons(currentPage, totalPages)}
        <button class="pagination-button" ${currentPage === totalPages ? 'disabled' : ''} onclick="dashboardManager.changePage(${currentPage + 1})">
          →
        </button>
      </div>
    `;
  }

  generatePageButtons(currentPage, totalPages) {
    const buttons = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(`
        <button class="pagination-button ${i === currentPage ? 'active' : ''}" onclick="dashboardManager.changePage(${i})">
          ${i}
        </button>
      `);
    }

    return buttons.join('');
  }

  async changePage(page) {
    this.currentPage = page;
    await this.loadUsers();
  }

  async searchUsers(query) {
    if (query.length < 3) {
      await this.loadUsers();
      return;
    }

    try {
      const response = await app.apiRequest(`/admin/users?search=${encodeURIComponent(query)}`);
      
      if (response.success) {
        this.renderUsersTable(response.data.users);
        this.renderPagination(response.data);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  }

  async filterUsers() {
    const statusFilter = document.getElementById('user-status-filter');
    const status = statusFilter?.value || '';

    if (!status) {
      await this.loadUsers();
      return;
    }

    try {
      const response = await app.apiRequest(`/admin/users?status=${status}`);
      
      if (response.success) {
        this.renderUsersTable(response.data.users);
        this.renderPagination(response.data);
      }
    } catch (error) {
      console.error('Failed to filter users:', error);
    }
  }

  async viewUserDetails(userId) {
    try {
      const response = await app.apiRequest(`/admin/users/${userId}`);
      
      if (response.success) {
        const user = response.data.user;
        const history = response.data.moderationHistory || [];

        const modal = app.showModal(`
          <div class="modal-header">
            <h3 class="modal-title">${app.t('user_details')}</h3>
            <button class="modal-close" onclick="app.closeModal()">×</button>
          </div>
          <div class="user-detail-card">
            <div class="user-detail-header">
              <div class="avatar avatar-lg">${user.anonymous_id.charAt(0)}</div>
              <div class="user-detail-info">
                <div class="user-detail-name">${user.anonymous_id}</div>
                <div class="user-detail-email">${user.email}</div>
              </div>
              <span class="badge ${this.getStatusBadgeClass(user.status)}">${user.status}</span>
            </div>
            <div class="user-detail-stats">
              <div class="user-detail-stat">
                <div class="user-detail-stat-value">${user.warning_count || 0}</div>
                <div class="user-detail-stat-label">${app.t('warnings')}</div>
              </div>
              <div class="user-detail-stat">
                <div class="user-detail-stat-value">${user.report_count || 0}</div>
                <div class="user-detail-stat-label">${app.t('reports')}</div>
              </div>
              <div class="user-detail-stat">
                <div class="user-detail-stat-value">${user.block_count || 0}</div>
                <div class="user-detail-stat-label">${app.t('blocked_by')}</div>
              </div>
            </div>
            <div class="mt-3">
              <h4 class="mb-2">${app.t('moderation_history')}</h4>
              ${history.length > 0 ? `
                <div class="activity-log">
                  ${history.map(log => `
                    <div class="activity-log-item">
                      <div class="activity-log-time">${app.formatTime(log.created_at)}</div>
                      <div class="activity-log-action">
                        <strong>${log.action}</strong>: ${log.details || ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p class="text-muted">${app.t('no_moderation_history')}</p>
              `}
            </div>
          </div>
        `);
      }
    } catch (error) {
      console.error('Failed to view user details:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  showModerateUserModal(userId) {
    const modal = app.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${app.t('moderate_user')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="mb-3">
        <label class="label">${app.t('action')}</label>
        <select id="moderation-action" class="input">
          <option value="warn">${app.t('add_warning')}</option>
          <option value="suspend">${app.t('suspend_user')}</option>
          <option value="ban">${app.t('ban_user')}</option>
          <option value="restrict">${app.t('restrict_user')}</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="label">${app.t('reason')}</label>
        <textarea id="moderation-reason" class="input" rows="3"></textarea>
      </div>
      <button class="btn btn-danger" id="execute-moderation-button">
        ${app.t('execute')}
      </button>
    `);

    document.getElementById('execute-moderation-button').addEventListener('click', async () => {
      const action = document.getElementById('moderation-action').value;
      const reason = document.getElementById('moderation-reason').value;

      if (!reason.trim()) {
        app.showToast(app.t('reason_required'), 'error');
        return;
      }

      try {
        let endpoint = '';
        let method = 'POST';

        switch (action) {
          case 'warn':
            endpoint = `/admin/users/${userId}/warn`;
            break;
          case 'suspend':
            endpoint = `/admin/users/${userId}/suspend`;
            break;
          case 'ban':
            endpoint = `/admin/users/${userId}/ban`;
            break;
          case 'restrict':
            endpoint = `/admin/users/${userId}/restrict`;
            break;
        }

        await app.apiRequest(endpoint, {
          method,
          body: JSON.stringify({ reason })
        });

        modal.close();
        app.showToast(app.t('action_completed'), 'success');
        this.refreshCurrentSection();
      } catch (error) {
        console.error('Failed to moderate user:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }

  async loadConversations() {
    try {
      const response = await app.apiRequest('/admin/conversations');
      
      if (response.success) {
        this.renderConversationsTable(response.data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }

  renderConversationsTable(conversations) {
    const tableBody = document.getElementById('conversations-table-body');
    if (!tableBody) return;

    if (conversations.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted">${app.t('no_conversations')}</td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = conversations.map(conv => `
      <tr>
        <td>${conv.user1_anonymous_id}</td>
        <td>${conv.user2_anonymous_id}</td>
        <td>${conv.message_count || 0}</td>
        <td>${app.formatTime(conv.updated_at)}</td>
        <td>
          <span class="badge badge-success">${conv.status}</span>
        </td>
      </tr>
    `).join('');
  }

  async loadReports(status = 'pending') {
    try {
      const response = await app.apiRequest(`/admin/reports?status=${status}`);
      
      if (response.success) {
        this.reportsData = response.data.reports;
        this.renderReports(response.data.reports);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  }

  renderReports(reports) {
    const container = document.getElementById('reports-container');
    if (!container) return;

    if (reports.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 40px;">
          ${app.t('no_reports')}
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map(report => `
      <div class="report-card">
        <div class="report-card-header">
          <div>
            <h4 class="report-card-title">${report.report_type}</h4>
            <span class="badge ${this.getReportCategoryBadge(report.report_category)}">
              ${report.report_category}
            </span>
          </div>
          <span class="badge ${this.getStatusBadgeClass(report.status)}">
            ${report.status}
          </span>
        </div>
        <div class="report-card-description">
          <strong>${app.t('reporter')}:</strong> ${report.reporter_anonymous_id || 'Unknown'} → 
          <strong>${app.t('reported')}:</strong> ${report.reported_anonymous_id || 'Unknown'}
        </div>
        ${report.description ? `
          <div class="report-card-description">${report.description}</div>
        ` : ''}
        <div class="report-card-actions">
          <button class="btn btn-secondary" onclick="dashboardManager.processReport('${report.id}', 'dismiss')">
            ${app.t('dismiss')}
          </button>
          <button class="btn btn-danger" onclick="dashboardManager.processReport('${report.id}', 'take_action')">
            ${app.t('take_action')}
          </button>
        </div>
      </div>
    `).join('');
  }

  getReportCategoryBadge(category) {
    const categoryMap = {
      spam: 'badge-warning',
      harassment: 'badge-danger',
      inappropriate: 'badge-info',
      other: 'badge-muted'
    };
    return categoryMap[category] || 'badge-muted';
  }

  async processReport(reportId, action) {
    try {
      await app.apiRequest(`/admin/reports/${reportId}/process`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });

      app.showToast(app.t('report_processed'), 'success');
      this.refreshCurrentSection();
    } catch (error) {
      console.error('Failed to process report:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  async loadModerationLogs() {
    try {
      const response = await app.apiRequest('/admin/moderation-logs');
      
      if (response.success) {
        this.renderModerationLogs(response.data.logs);
      }
    } catch (error) {
      console.error('Failed to load moderation logs:', error);
    }
  }

  renderModerationLogs(logs) {
    const container = document.getElementById('moderation-logs-container');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 40px;">
          ${app.t('no_logs')}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="activity-log">
        ${logs.map(log => `
          <div class="activity-log-item">
            <div class="activity-log-time">${app.formatTime(log.created_at)}</div>
            <div class="activity-log-action">
              <span class="activity-log-user">${log.moderator_email || 'Unknown'}</span>
              ${log.action} → ${log.target_email || 'Unknown'}
              ${log.details ? `<div class="text-muted" style="font-size: 12px;">${log.details}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async loadActivityLogs() {
    try {
      const response = await app.apiRequest('/admin/activity-logs');
      
      if (response.success) {
        this.renderActivityLogs(response.data.logs);
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    }
  }

  renderActivityLogs(logs) {
    const container = document.getElementById('activity-logs-container');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding: 40px;">
          ${app.t('no_logs')}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="activity-log">
        ${logs.map(log => `
          <div class="activity-log-item">
            <div class="activity-log-time">${app.formatTime(log.created_at)}</div>
            <div class="activity-log-action">
              <span class="activity-log-user">${log.email || 'Unknown'}</span>
              ${log.action}
              ${log.details ? `<div class="text-muted" style="font-size: 12px;">${JSON.stringify(log.details)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async refreshCurrentSection() {
    await this.loadSectionData(this.currentSection);
  }
}

const dashboardManager = new DashboardManager();
window.dashboardManager = dashboardManager;