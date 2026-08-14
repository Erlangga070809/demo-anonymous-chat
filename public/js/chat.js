class ChatManager {
  constructor() {
    this.currentConversation = null;
    this.currentMatch = null;
    this.messages = [];
    this.typingTimeout = null;
    this.replyingTo = null;
    this.emojiPickerVisible = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupSocketEvents();
    this.loadInitialState();
  }

  setupEventListeners() {
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
      messageInput.addEventListener('input', () => this.handleTyping());
      messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    const sendButton = document.getElementById('send-button');
    if (sendButton) {
      sendButton.addEventListener('click', () => this.sendMessage());
    }

    const attachButton = document.getElementById('attach-button');
    if (attachButton) {
      attachButton.addEventListener('click', () => this.showAttachOptions());
    }

    const emojiButton = document.getElementById('emoji-button');
    if (emojiButton) {
      emojiButton.addEventListener('click', () => this.toggleEmojiPicker());
    }

    const startMatchButton = document.getElementById('start-match-button');
    if (startMatchButton) {
      startMatchButton.addEventListener('click', () => this.startMatching());
    }

    const cancelMatchButton = document.getElementById('cancel-match-button');
    if (cancelMatchButton) {
      cancelMatchButton.addEventListener('click', () => this.cancelMatching());
    }

    const endChatButton = document.getElementById('end-chat-button');
    if (endChatButton) {
      endChatButton.addEventListener('click', () => this.endConversation());
    }

    const blockButton = document.getElementById('block-button');
    if (blockButton) {
      blockButton.addEventListener('click', () => this.blockUser());
    }

    const reportButton = document.getElementById('report-button');
    if (reportButton) {
      reportButton.addEventListener('click', () => this.showReportModal());
    }

    document.addEventListener('click', (e) => {
      if (this.emojiPickerVisible && !e.target.closest('.emoji-picker') && !e.target.closest('#emoji-button')) {
        this.hideEmojiPicker();
      }

      if (e.target.closest('.message')) {
        const messageElement = e.target.closest('.message');
        const messageId = messageElement.getAttribute('data-message-id');
        
        if (e.target.closest('.message-image')) {
          this.showImagePreview(e.target.src);
        } else if (e.target.closest('.voice-play-button')) {
          this.toggleVoicePlayback(e.target.closest('.voice-play-button'));
        } else if (e.target.closest('.reaction-badge')) {
          const reaction = e.target.getAttribute('data-reaction');
          this.toggleReaction(messageId, reaction);
        }
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.message-bubble') || e.target.closest('.message')) {
        e.preventDefault();
        const messageElement = e.target.closest('.message');
        const messageId = messageElement.getAttribute('data-message-id');
        this.showContextMenu(e.clientX, e.clientY, messageId);
      }
    });
  }

  setupSocketEvents() {
    if (!app.socket) return;

    app.socket.on('match_found', (data) => {
      this.handleMatchFound(data);
    });

    app.socket.on('new_message', (data) => {
      this.handleNewMessage(data);
    });

    app.socket.on('message_sent', (data) => {
      this.handleMessageSent(data);
    });

    app.socket.on('user_typing', (data) => {
      this.handleUserTyping(data);
    });

    app.socket.on('message_delivered_confirmation', (data) => {
      this.handleMessageDeliveredConfirmation(data);
    });

    app.socket.on('message_read_confirmation', (data) => {
      this.handleMessageReadConfirmation(data);
    });

    app.socket.on('conversation_ended', (data) => {
      this.handleConversationEnded(data);
    });

    app.socket.on('reaction_added', (data) => {
      this.handleReactionAdded(data);
    });

    app.socket.on('reaction_removed', (data) => {
      this.handleReactionRemoved(data);
    });

    app.socket.on('user_status_changed', (data) => {
      this.handleUserStatusChanged(data);
    });
  }

  async loadInitialState() {
    try {
      const response = await app.apiRequest('/chat/messages/current');
      
      if (response.success && response.data.conversation) {
        this.currentConversation = response.data.conversation;
        this.currentMatch = response.data.match;
        this.displayConversation();
        
        const messagesResponse = await app.apiRequest(`/chat/messages/${this.currentConversation.id}`);
        if (messagesResponse.success) {
          this.messages = messagesResponse.data.messages;
          this.renderMessages();
        }
      }
    } catch (error) {
      console.error('Failed to load initial state:', error);
    }
  }

  async startMatching() {
    try {
      const matchScreen = document.getElementById('match-screen');
      const chatScreen = document.getElementById('chat-screen');
      
      if (matchScreen) matchScreen.classList.remove('hidden');
      if (chatScreen) chatScreen.classList.add('hidden');

      app.socket.emit('start_matching');
    } catch (error) {
      console.error('Failed to start matching:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  async cancelMatching() {
    try {
      app.socket.emit('cancel_matching');
      
      const matchScreen = document.getElementById('match-screen');
      const chatScreen = document.getElementById('chat-screen');
      
      if (matchScreen) matchScreen.classList.add('hidden');
      if (chatScreen) chatScreen.classList.remove('hidden');
    } catch (error) {
      console.error('Failed to cancel matching:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  handleMatchFound(data) {
    this.currentMatch = data;
    this.currentConversation = { id: data.conversationId };
    
    const matchScreen = document.getElementById('match-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    if (matchScreen) matchScreen.classList.add('hidden');
    if (chatScreen) chatScreen.classList.remove('hidden');

    this.displayMatchInfo(data.matchedUser);
    app.showToast(app.t('match_found'), 'success');
    
    this.loadMessages(data.conversationId);
  }

  displayMatchInfo(matchedUser) {
    const matchInfo = document.getElementById('match-info');
    if (matchInfo) {
      matchInfo.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="avatar">${matchedUser.anonymousId.charAt(0)}</div>
          <div>
            <div class="chat-header-name">${matchedUser.anonymousId}</div>
            <div class="chat-header-status">
              <span class="status-dot"></span>
              <span>${app.t('online')}</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  async loadMessages(conversationId) {
    try {
      const response = await app.apiRequest(`/chat/messages/${conversationId}`);
      
      if (response.success) {
        this.messages = response.data.messages;
        this.renderMessages();
        this.markConversationAsRead();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  renderMessages() {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;

    messagesContainer.innerHTML = '';

    if (this.messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          <div class="chat-empty-icon">💬</div>
          <div class="chat-empty-title">${app.t('no_messages')}</div>
          <div class="chat-empty-description">${app.t('type_message')}</div>
        </div>
      `;
      return;
    }

    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      messagesContainer.appendChild(messageElement);
    });

    this.scrollToBottom();
  }

  createMessageElement(message) {
    const isSent = message.sender_id === app.currentUser.id;
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.setAttribute('data-message-id', message.id);

    let content = '';

    if (message.reply_to_message_id) {
      const replyMessage = this.messages.find(m => m.id === message.reply_to_message_id);
      if (replyMessage) {
        content += `
          <div class="message reply-preview">
            <div class="reply-author">${replyMessage.sender_anonymous_id}</div>
            <div class="reply-content">${this.getMessagePreview(replyMessage)}</div>
          </div>
        `;
      }
    }

    if (message.message_type === 'text') {
      content += `<div class="message-bubble">${app.escapeHTML(message.content)}</div>`;
    } else if (message.message_type === 'image') {
      content += `
        <div class="message-bubble">
          <img src="${message.media_url}" class="message-image" alt="Image message" loading="lazy">
        </div>
      `;
    } else if (message.message_type === 'voice') {
      content += `
        <div class="message-bubble">
          <div class="message-voice">
            <button class="voice-play-button" data-audio-url="${message.media_url}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <div class="voice-waveform">
              ${this.generateWaveform()}
            </div>
            <span class="voice-duration">${message.media_duration || 0}s</span>
          </div>
        </div>
      `;
    }

    const timeString = app.formatTime(message.created_at);
    const statusIcon = isSent ? this.getStatusIcon(message) : '';

    content += `
      <div class="message-time">
        <span>${timeString}</span>
        ${statusIcon}
      </div>
    `;

    if (message.reactions && message.reactions.length > 0) {
      content += `<div class="message-reactions">`;
      message.reactions.forEach(reaction => {
        content += `
          <span class="reaction-badge" data-reaction="${reaction}">
            ${reaction}
          </span>
        `;
      });
      content += `</div>`;
    }

    messageElement.innerHTML = content;
    return messageElement;
  }

  getMessagePreview(message) {
    if (message.message_type === 'text') {
      return message.content;
    } else if (message.message_type === 'image') {
      return '📷 Image';
    } else if (message.message_type === 'voice') {
      return '🎤 Voice message';
    }
    return '';
  }

  getStatusIcon(message) {
    if (message.is_read) {
      return `
        <span class="message-status" title="${app.t('read')}">
          <svg viewBox="0 0 24 24" fill="currentColor" style="color: #10B981;">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
          </svg>
        </span>
      `;
    } else if (message.delivered_at) {
      return `
        <span class="message-status" title="${app.t('delivered')}">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
          </svg>
        </span>
      `;
    } else {
      return `
        <span class="message-status" title="${app.t('sent')}">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </span>
      `;
    }
  }

  generateWaveform() {
    const bars = [];
    const heights = [8, 16, 24, 12, 20, 28, 16, 8, 24, 12, 20, 8, 16, 24, 12];
    
    heights.forEach((height, index) => {
      bars.push(`
        <div class="voice-waveform-bar" style="height: ${height}px; animation-delay: ${index * 0.1}s;"></div>
      `);
    });

    return bars.join('');
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  handleTyping() {
    if (!this.currentConversation) return;

    clearTimeout(this.typingTimeout);

    app.socket.emit('typing', {
      conversationId: this.currentConversation.id,
      isTyping: true
    });

    this.typingTimeout = setTimeout(() => {
      app.socket.emit('typing', {
        conversationId: this.currentConversation.id,
        isTyping: false
      });
    }, 1000);
  }

  handleUserTyping(data) {
    if (data.conversationId !== this.currentConversation?.id) return;

    const typingIndicator = document.getElementById('typing-indicator');
    
    if (data.isTyping) {
      if (typingIndicator) {
        typingIndicator.classList.remove('hidden');
      }
      
      clearTimeout(this.typingIndicatorTimeout);
      this.typingIndicatorTimeout = setTimeout(() => {
        if (typingIndicator) {
          typingIndicator.classList.add('hidden');
        }
      }, 3000);
    } else {
      if (typingIndicator) {
        typingIndicator.classList.add('hidden');
      }
    }
  }

  async sendMessage() {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();

    if (!content || !this.currentConversation) return;

    const messageData = {
      conversationId: this.currentConversation.id,
      content,
      messageType: 'text',
      replyToMessageId: this.replyingTo
    };

    app.socket.emit('send_message', messageData);

    messageInput.value = '';
    this.replyingTo = null;
    this.hideReplyPreview();
    this.adjustTextareaHeight();
  }

  handleMessageSent(data) {
    const message = data.message;
    
    if (message.conversation_id !== this.currentConversation?.id) return;

    const existingIndex = this.messages.findIndex(m => m.id === message.id);
    
    if (existingIndex === -1) {
      this.messages.push({
        ...message,
        sender_anonymous_id: app.currentUser.anonymousId
      });
      this.renderMessages();
    }
  }

  handleNewMessage(data) {
    const message = data.message;
    
    if (message.conversation_id !== this.currentConversation?.id) return;

    const existingIndex = this.messages.findIndex(m => m.id === message.id);
    
    if (existingIndex === -1) {
      this.messages.push(message);
      this.renderMessages();
      this.markMessageAsRead(message.id);
    }
  }

  handleMessageDeliveredConfirmation(data) {
    const message = this.messages.find(m => m.id === data.messageId);
    if (message) {
      message.delivered_at = new Date().toISOString();
      this.renderMessages();
    }
  }

  handleMessageReadConfirmation(data) {
    const message = this.messages.find(m => m.id === data.messageId);
    if (message) {
      message.is_read = true;
      message.read_at = new Date().toISOString();
      this.renderMessages();
    }
  }

  async markMessageAsRead(messageId) {
    app.socket.emit('message_read', {
      messageId,
      conversationId: this.currentConversation.id
    });
  }

  async markConversationAsRead() {
    if (!this.currentConversation) return;

    try {
      await app.apiRequest(`/chat/messages/${this.currentConversation.id}/read`, {
        method: 'PUT'
      });
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  }

  handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  adjustTextareaHeight() {
    const textarea = document.getElementById('message-input');
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    }
  }

  showAttachOptions() {
    const modal = app.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${app.t('attach_file')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="flex gap-2 mb-3">
        <button class="btn btn-primary" id="upload-image-button">
          📷 ${app.t('image')}
        </button>
        <button class="btn btn-primary" id="record-voice-button">
          🎤 ${app.t('voice')}
        </button>
      </div>
      <input type="file" id="file-input" accept="image/*" class="hidden">
    `);

    document.getElementById('upload-image-button').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.uploadImage(file);
        modal.close();
      }
    });

    document.getElementById('record-voice-button').addEventListener('click', () => {
      this.startVoiceRecording();
      modal.close();
    });
  }

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        const messageData = {
          conversationId: this.currentConversation.id,
          content: data.data.url,
          messageType: 'image'
        };

        app.socket.emit('send_message', messageData);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  startVoiceRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      app.showToast('Voice recording not supported', 'error');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          this.uploadVoiceMessage(blob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();

        const modal = app.showModal(`
          <div class="modal-header">
            <h3 class="modal-title">${app.t('recording')}</h3>
          </div>
          <div class="text-center mb-3">
            <div class="soft-pulse" style="font-size: 48px;">🎤</div>
          </div>
          <button class="btn btn-danger" id="stop-recording-button">
            ${app.t('stop')}
          </button>
        `);

        document.getElementById('stop-recording-button').addEventListener('click', () => {
          mediaRecorder.stop();
          modal.close();
        });
      })
      .catch(error => {
        console.error('Failed to access microphone:', error);
        app.showToast('Failed to access microphone', 'error');
      });
  }

  async uploadVoiceMessage(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'voice-message.webm');

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        const messageData = {
          conversationId: this.currentConversation.id,
          content: data.data.url,
          messageType: 'voice',
          mediaDuration: this.getAudioDuration(blob)
        };

        app.socket.emit('send_message', messageData);
      }
    } catch (error) {
      console.error('Failed to upload voice message:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  getAudioDuration(blob) {
    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(blob));
      audio.addEventListener('loadedmetadata', () => {
        resolve(Math.round(audio.duration));
      });
    });
  }

  toggleVoicePlayback(button) {
    const audioUrl = button.getAttribute('data-audio-url');
    const audio = new Audio(audioUrl);

    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    `;

    audio.play();

    audio.onended = () => {
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
    };
  }

  toggleEmojiPicker() {
    if (this.emojiPickerVisible) {
      this.hideEmojiPicker();
    } else {
      this.showEmojiPicker();
    }
  }

  showEmojiPicker() {
    const emojiPicker = document.createElement('div');
    emojiPicker.className = 'emoji-picker';
    emojiPicker.id = 'emoji-picker';

    const emojis = ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤔', '😅', '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🤝', '❤️', '💔', '🎉', '🔥', '⭐', '💯'];

    emojis.forEach(emoji => {
      const button = document.createElement('button');
      button.className = 'emoji-button';
      button.textContent = emoji;
      button.addEventListener('click', () => {
        const messageInput = document.getElementById('message-input');
        messageInput.value += emoji;
        messageInput.focus();
        this.adjustTextareaHeight();
      });
      emojiPicker.appendChild(button);
    });

    const chatInputArea = document.querySelector('.chat-input-area');
    chatInputArea.appendChild(emojiPicker);
    this.emojiPickerVisible = true;
  }

  hideEmojiPicker() {
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiPicker) {
      emojiPicker.remove();
    }
    this.emojiPickerVisible = false;
  }

  showContextMenu(x, y, messageId) {
    this.closeContextMenu();

    const contextMenu = document.createElement('div');
    contextMenu.className = 'message-context-menu';
    contextMenu.id = 'message-context-menu';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;

    const message = this.messages.find(m => m.id === messageId);
    if (!message) return;

    contextMenu.innerHTML = `
      <button class="context-menu-item" id="reply-button">
        <span>↩️</span> ${app.t('reply')}
      </button>
      <button class="context-menu-item" id="copy-button">
        <span>📋</span> ${app.t('copy')}
      </button>
      <button class="context-menu-item" id="react-button">
        <span>😊</span> React
      </button>
      ${message.sender_id === app.currentUser.id ? `
        <button class="context-menu-item danger" id="delete-button">
          <span>🗑️</span> ${app.t('delete')}
        </button>
      ` : `
        <button class="context-menu-item danger" id="report-button">
          <span>⚠️</span> ${app.t('report')}
        </button>
      `}
    `;

    document.body.appendChild(contextMenu);

    document.getElementById('reply-button').addEventListener('click', () => {
      this.setReplyTo(messageId);
      this.closeContextMenu();
    });

    document.getElementById('copy-button').addEventListener('click', () => {
      this.copyMessage(message);
      this.closeContextMenu();
    });

    document.getElementById('react-button').addEventListener('click', () => {
      this.showReactionPicker(messageId, x, y);
      this.closeContextMenu();
    });

    const deleteButton = document.getElementById('delete-button');
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        this.deleteMessage(messageId);
        this.closeContextMenu();
      });
    }

    const reportButton = document.getElementById('report-button');
    if (reportButton) {
      reportButton.addEventListener('click', () => {
        this.showReportModal(messageId);
        this.closeContextMenu();
      });
    }

    document.addEventListener('click', () => this.closeContextMenu(), { once: true });
  }

  closeContextMenu() {
    const contextMenu = document.getElementById('message-context-menu');
    if (contextMenu) {
      contextMenu.remove();
    }
  }

  setReplyTo(messageId) {
    this.replyingTo = messageId;
    
    const message = this.messages.find(m => m.id === messageId);
    if (!message) return;

    const replyPreview = document.getElementById('reply-preview');
    if (replyPreview) {
      replyPreview.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-muted">${app.t('reply')}:</span>
          <span class="font-medium">${message.sender_anonymous_id}</span>
          <span class="text-muted">${this.getMessagePreview(message)}</span>
          <button class="icon-button" onclick="chatManager.cancelReply()">×</button>
        </div>
      `;
      replyPreview.classList.remove('hidden');
    }
  }

  cancelReply() {
    this.replyingTo = null;
    const replyPreview = document.getElementById('reply-preview');
    if (replyPreview) {
      replyPreview.classList.add('hidden');
    }
  }

  hideReplyPreview() {
    const replyPreview = document.getElementById('reply-preview');
    if (replyPreview) {
      replyPreview.classList.add('hidden');
    }
  }

  copyMessage(message) {
    let textToCopy = '';
    
    if (message.message_type === 'text') {
      textToCopy = message.content;
    } else if (message.message_type === 'image') {
      textToCopy = message.media_url;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      app.showToast(app.t('message_copied'), 'success');
    });
  }

  showReactionPicker(messageId, x, y) {
    const reactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🎉'];
    
    const picker = document.createElement('div');
    picker.className = 'message-context-menu';
    picker.style.left = `${x}px`;
    picker.style.top = `${y}px`;
    picker.style.display = 'flex';
    picker.style.gap = '4px';

    reactions.forEach(reaction => {
      const button = document.createElement('button');
      button.className = 'emoji-button';
      button.textContent = reaction;
      button.addEventListener('click', () => {
        this.toggleReaction(messageId, reaction);
        picker.remove();
      });
      picker.appendChild(button);
    });

    document.body.appendChild(picker);

    setTimeout(() => {
      picker.remove();
    }, 3000);
  }

  async toggleReaction(messageId, reaction) {
    try {
      const message = this.messages.find(m => m.id === messageId);
      if (!message) return;

      const existingReaction = message.reactions?.find(r => r === reaction);

      if (existingReaction) {
        app.socket.emit('remove_reaction', { messageId, reaction });
      } else {
        app.socket.emit('add_reaction', { messageId, reaction });
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  }

  handleReactionAdded(data) {
    const message = this.messages.find(m => m.id === data.messageId);
    if (message) {
      if (!message.reactions) message.reactions = [];
      if (!message.reactions.includes(data.reaction)) {
        message.reactions.push(data.reaction);
        this.renderMessages();
      }
    }
  }

  handleReactionRemoved(data) {
    const message = this.messages.find(m => m.id === data.messageId);
    if (message && message.reactions) {
      message.reactions = message.reactions.filter(r => r !== data.reaction);
      this.renderMessages();
    }
  }

  async deleteMessage(messageId) {
    try {
      await app.apiRequest(`/chat/messages/${messageId}`, {
        method: 'DELETE'
      });

      this.messages = this.messages.filter(m => m.id !== messageId);
      this.renderMessages();
      app.showToast(app.t('message_deleted'), 'success');
    } catch (error) {
      console.error('Failed to delete message:', error);
      app.showToast(app.t('error_occurred'), 'error');
    }
  }

  showImagePreview(imageUrl) {
    const modal = app.showModal(`
      <div style="text-align: center;">
        <img src="${imageUrl}" style="max-width: 100%; max-height: 80vh; border-radius: 8px;">
      </div>
    `);

    modal.overlay.addEventListener('click', () => modal.close());
  }

  async endConversation() {
    if (!this.currentMatch) return;

    app.showConfirm(app.t('end_chat_confirm'), async () => {
      try {
        app.socket.emit('end_conversation', {
          matchId: this.currentMatch.matchId
        });

        this.currentConversation = null;
        this.currentMatch = null;
        this.messages = [];

        const chatScreen = document.getElementById('chat-screen');
        const matchScreen = document.getElementById('match-screen');
        
        if (chatScreen) chatScreen.classList.add('hidden');
        if (matchScreen) matchScreen.classList.remove('hidden');

        app.showToast(app.t('chat_ended'), 'success');
      } catch (error) {
        console.error('Failed to end conversation:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }

  handleConversationEnded(data) {
    if (this.currentMatch && this.currentMatch.matchId === data.matchId) {
      this.currentConversation = null;
      this.currentMatch = null;
      this.messages = [];

      const chatScreen = document.getElementById('chat-screen');
      const matchScreen = document.getElementById('match-screen');
      
      if (chatScreen) chatScreen.classList.add('hidden');
      if (matchScreen) matchScreen.classList.remove('hidden');

      app.showToast(app.t('chat_ended'), 'info');
    }
  }

  showReportModal(messageId = null) {
    const modal = app.showModal(`
      <div class="modal-header">
        <h3 class="modal-title">${app.t('report')}</h3>
        <button class="modal-close" onclick="app.closeModal()">×</button>
      </div>
      <div class="mb-3">
        <label class="label">${app.t('report_reason')}</label>
        <select id="report-category" class="input">
          <option value="spam">${app.t('spam')}</option>
          <option value="harassment">${app.t('harassment')}</option>
          <option value="inappropriate">${app.t('inappropriate')}</option>
          <option value="other">${app.t('other')}</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="label">${app.t('report_description')}</label>
        <textarea id="report-description" class="input" rows="4"></textarea>
      </div>
      <button class="btn btn-danger" id="submit-report-button">
        ${app.t('report')}
      </button>
    `);

    document.getElementById('submit-report-button').addEventListener('click', async () => {
      const category = document.getElementById('report-category').value;
      const description = document.getElementById('report-description').value;
      
      const reportData = {
        reportType: messageId ? 'message' : 'user',
        reportCategory: category,
        description,
        reportedUserId: this.currentMatch?.matchedUser?.id,
        messageId
      };

      try {
        await app.apiRequest('/reports', {
          method: 'POST',
          body: JSON.stringify(reportData)
        });

        modal.close();
        app.showToast(app.t('report_submitted'), 'success');
      } catch (error) {
        console.error('Failed to submit report:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }

  blockUser() {
    if (!this.currentMatch?.matchedUser?.id) return;

    app.showConfirm(app.t('block_confirm'), async () => {
      try {
        await app.apiRequest('/users/block', {
          method: 'POST',
          body: JSON.stringify({
            userId: this.currentMatch.matchedUser.id
          })
        });

        app.showToast(app.t('user_blocked'), 'success');
        this.endConversation();
      } catch (error) {
        console.error('Failed to block user:', error);
        app.showToast(app.t('error_occurred'), 'error');
      }
    });
  }

  handleUserStatusChanged(data) {
    if (this.currentMatch && this.currentMatch.matchedUser.id === data.userId) {
      const statusDot = document.querySelector('.chat-header-status .status-dot');
      const statusText = document.querySelector('.chat-header-status span:last-child');
      
      if (statusDot && statusText) {
        if (data.isOnline) {
          statusDot.classList.remove('offline');
          statusText.textContent = app.t('online');
        } else {
          statusDot.classList.add('offline');
          statusText.textContent = app.t('offline');
        }
      }
    }
  }

  displayConversation() {
    if (!this.currentConversation || !this.currentMatch) return;

    const chatScreen = document.getElementById('chat-screen');
    const matchScreen = document.getElementById('match-screen');
    
    if (chatScreen) chatScreen.classList.remove('hidden');
    if (matchScreen) matchScreen.classList.add('hidden');

    this.displayMatchInfo(this.currentMatch.matchedUser);
  }
}

const chatManager = new ChatManager();
window.chatManager = chatManager;