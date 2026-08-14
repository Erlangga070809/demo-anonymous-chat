class MatchManager {
  constructor() {
    this.isSearching = false;
    this.searchStartTime = null;
    this.searchTimer = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupSocketEvents();
    this.startSearchTimer();
  }

  setupEventListeners() {
    const startButton = document.getElementById('start-match-button');
    if (startButton) {
      startButton.addEventListener('click', () => this.startSearch());
    }

    const cancelButton = document.getElementById('cancel-match-button');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.cancelSearch());
    }

    const rematchButton = document.getElementById('rematch-button');
    if (rematchButton) {
      rematchButton.addEventListener('click', () => this.startSearch());
    }
  }

  setupSocketEvents() {
    if (!app.socket) return;

    app.socket.on('matching_started', () => {
      this.handleSearchStarted();
    });

    app.socket.on('matching_cancelled', () => {
      this.handleSearchCancelled();
    });

    app.socket.on('match_found', (data) => {
      this.handleMatchFound(data);
    });

    app.socket.on('matching_error', (data) => {
      this.handleSearchError(data);
    });
  }

  startSearch() {
    if (this.isSearching) return;

    app.socket.emit('start_matching');
    this.isSearching = true;
    this.searchStartTime = Date.now();
    this.showSearchingState();
  }

  cancelSearch() {
    if (!this.isSearching) return;

    app.socket.emit('cancel_matching');
    this.isSearching = false;
    this.hideSearchingState();
  }

  handleSearchStarted() {
    this.isSearching = true;
    this.searchStartTime = Date.now();
    this.showSearchingState();
  }

  handleSearchCancelled() {
    this.isSearching = false;
    this.hideSearchingState();
  }

  handleMatchFound(data) {
    this.isSearching = false;
    this.hideSearchingState();
    this.showMatchFoundState(data);
  }

  handleSearchError(data) {
    this.isSearching = false;
    this.hideSearchingState();
    app.showToast(data.message || app.t('error_occurred'), 'error');
  }

  showSearchingState() {
    const searchAnimation = document.getElementById('search-animation');
    const searchStatus = document.getElementById('search-status');
    const cancelButton = document.getElementById('cancel-match-button');
    const startButton = document.getElementById('start-match-button');

    if (searchAnimation) {
      searchAnimation.innerHTML = `
        <div class="match-animation">
          <div class="match-circle"></div>
          <div class="match-circle"></div>
          <div class="match-circle"></div>
          <div class="match-icon">🔍</div>
        </div>
      `;
      searchAnimation.classList.remove('hidden');
    }

    if (searchStatus) {
      searchStatus.textContent = app.t('searching');
      searchStatus.classList.add('soft-pulse');
    }

    if (cancelButton) cancelButton.classList.remove('hidden');
    if (startButton) startButton.classList.add('hidden');

    this.startSearchTimer();
  }

  hideSearchingState() {
    const searchAnimation = document.getElementById('search-animation');
    const searchStatus = document.getElementById('search-status');
    const cancelButton = document.getElementById('cancel-match-button');
    const startButton = document.getElementById('start-match-button');

    if (searchAnimation) searchAnimation.classList.add('hidden');
    if (searchStatus) {
      searchStatus.textContent = '';
      searchStatus.classList.remove('soft-pulse');
    }

    if (cancelButton) cancelButton.classList.add('hidden');
    if (startButton) startButton.classList.remove('hidden');

    this.stopSearchTimer();
  }

  showMatchFoundState(data) {
    const matchFound = document.getElementById('match-found');
    const matchInfo = document.getElementById('match-info');
    const startConversationButton = document.getElementById('start-conversation-button');

    if (matchFound) matchFound.classList.remove('hidden');

    if (matchInfo) {
      matchInfo.innerHTML = `
        <div class="text-center">
          <div class="avatar avatar-lg" style="margin: 0 auto 16px;">
            ${data.matchedUser.anonymousId.charAt(0)}
          </div>
          <h3 style="margin-bottom: 8px;">${app.t('you_matched_with')}</h3>
          <p class="text-muted" style="font-size: 18px;">${data.matchedUser.anonymousId}</p>
        </div>
      `;
    }

    if (startConversationButton) {
      startConversationButton.classList.remove('hidden');
      startConversationButton.addEventListener('click', () => {
        matchFound.classList.add('hidden');
        chatManager.handleMatchFound(data);
      });
    }

    setTimeout(() => {
      if (matchFound) matchFound.classList.add('hidden');
      chatManager.handleMatchFound(data);
    }, 5000);
  }

  startSearchTimer() {
    this.stopSearchTimer();
    
    this.searchTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.searchStartTime) / 1000);
      this.updateSearchTime(elapsed);
    }, 1000);
  }

  stopSearchTimer() {
    if (this.searchTimer) {
      clearInterval(this.searchTimer);
      this.searchTimer = null;
    }
  }

  updateSearchTime(seconds) {
    const timeElement = document.getElementById('search-time');
    if (timeElement) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      timeElement.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }
}

const matchManager = new MatchManager();
window.matchManager = matchManager;
