const { sql } = require('../config');
const MessagingService = require('../services/messaging');
const MatchingService = require('../services/matching');
const ModerationService = require('../services/moderation');
const logger = require('../utils/logger');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map();
    this.activeSockets = new Map();
    this.matchingUsers = new Map();
    this.typingUsers = new Map();
  }

  initialize() {
    this.io.on('connection', (socket) => {
      logger.info('New socket connection', { socketId: socket.id });

      socket.on('authenticate', async (data) => {
        await this.handleAuthentication(socket, data);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async handleAuthentication(socket, data) {
    try {
      const { userId, token } = data;

      if (!userId || !token) {
        socket.emit('auth_error', { message: 'Invalid authentication data' });
        return;
      }

      const sessions = await sql`
        SELECT user_id FROM sessions 
        WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `;

      if (sessions.length === 0 || sessions[0].user_id !== userId) {
        socket.emit('auth_error', { message: 'Invalid session' });
        return;
      }

      socket.userId = userId;
      this.activeUsers.set(userId, socket.id);
      this.activeSockets.set(socket.id, userId);

      await sql`
        UPDATE users SET is_online = TRUE, last_seen = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;

      socket.emit('authenticated', { userId });
      this.broadcastUserStatus(userId, true);

      this.setupUserHandlers(socket);

      logger.info('Socket authenticated', { userId, socketId: socket.id });
    } catch (error) {
      logger.error('Socket authentication error:', { error: error.message });
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  }

  setupUserHandlers(socket) {
    socket.on('start_matching', async () => {
      await this.handleStartMatching(socket);
    });

    socket.on('cancel_matching', async () => {
      await this.handleCancelMatching(socket);
    });

    socket.on('send_message', async (data) => {
      await this.handleSendMessage(socket, data);
    });

    socket.on('typing', async (data) => {
      await this.handleTyping(socket, data);
    });

    socket.on('message_delivered', async (data) => {
      await this.handleMessageDelivered(socket, data);
    });

    socket.on('message_read', async (data) => {
      await this.handleMessageRead(socket, data);
    });

    socket.on('end_conversation', async (data) => {
      await this.handleEndConversation(socket, data);
    });

    socket.on('add_reaction', async (data) => {
      await this.handleAddReaction(socket, data);
    });

    socket.on('remove_reaction', async (data) => {
      await this.handleRemoveReaction(socket, data);
    });
  }

  async handleStartMatching(socket) {
    try {
      const userId = socket.userId;
      
      if (this.matchingUsers.has(userId)) {
        socket.emit('matching_error', { message: 'Already searching for match' });
        return;
      }

      this.matchingUsers.set(userId, socket.id);
      socket.emit('matching_started');

      const match = await MatchingService.findMatch(userId);

      if (match) {
        this.handleMatchFound(userId, match);
      } else {
        await MatchingService.addToQueue(userId);
      }
    } catch (error) {
      logger.error('Socket start matching error:', { error: error.message });
      socket.emit('matching_error', { message: 'Failed to start matching' });
    }
  }

  async handleCancelMatching(socket) {
    try {
      const userId = socket.userId;
      
      if (this.matchingUsers.has(userId)) {
        this.matchingUsers.delete(userId);
        await MatchingService.cancelSearch(userId);
        socket.emit('matching_cancelled');
      }
    } catch (error) {
      logger.error('Socket cancel matching error:', { error: error.message });
    }
  }

  handleMatchFound(userId1, match) {
    const user1SocketId = this.activeUsers.get(userId1);
    const user2SocketId = this.activeUsers.get(match.matchedUser.id);

    if (user1SocketId) {
      this.io.to(user1SocketId).emit('match_found', {
        matchId: match.matchId,
        conversationId: match.conversationId,
        matchedUser: {
          id: match.matchedUser.id,
          anonymousId: match.matchedUser.anonymous_id
        }
      });
    }

    if (user2SocketId) {
      this.io.to(user2SocketId).emit('match_found', {
        matchId: match.matchId,
        conversationId: match.conversationId,
        matchedUser: {
          id: userId1,
          anonymousId: null
        }
      });

      const user1 = this.activeUsers.get(userId1);
      if (user1) {
        sql`
          SELECT anonymous_id FROM users WHERE id = ${userId1}
        `.then(users => {
          if (users.length > 0) {
            this.io.to(user2SocketId).emit('match_found', {
              matchId: match.matchId,
              conversationId: match.conversationId,
              matchedUser: {
                id: userId1,
                anonymousId: users[0].anonymous_id
              }
            });
          }
        });
      }
    }

    this.matchingUsers.delete(userId1);
    this.matchingUsers.delete(match.matchedUser.id);
  }

  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content, messageType = 'text', replyToMessageId } = data;
      const userId = socket.userId;

      const isSpam = await ModerationService.detectSpam(userId);
      if (isSpam) {
        socket.emit('message_error', { message: 'Message rate limit exceeded' });
        return;
      }

      const result = await MessagingService.sendMessage(
        conversationId,
        userId,
        content,
        messageType,
        { replyToMessageId }
      );

      socket.emit('message_sent', {
        message: result.message
      });

      const receiverSocketId = this.activeUsers.get(result.receiverId);
      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit('new_message', {
          message: result.message
        });
      }
    } catch (error) {
      logger.error('Socket send message error:', { error: error.message });
      socket.emit('message_error', { message: error.message });
    }
  }

  async handleTyping(socket, data) {
    try {
      const { conversationId, isTyping } = data;
      const userId = socket.userId;

      const conversation = await sql`
        SELECT user1_id, user2_id FROM conversations 
        WHERE id = ${conversationId} AND status = 'active'
        LIMIT 1
      `;

      if (conversation.length === 0) return;

      const conv = conversation[0];
      const receiverId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      const receiverSocketId = this.activeUsers.get(receiverId);

      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit('user_typing', {
          conversationId,
          userId,
          isTyping
        });
      }
    } catch (error) {
      logger.error('Socket typing error:', { error: error.message });
    }
  }

  async handleMessageDelivered(socket, data) {
    try {
      const { messageId } = data;
      
      await MessagingService.markMessageAsDelivered(messageId, socket.userId);

      const message = await sql`
        SELECT sender_id FROM messages WHERE id = ${messageId}
      `;

      if (message.length > 0) {
        const senderSocketId = this.activeUsers.get(message[0].sender_id);
        if (senderSocketId) {
          this.io.to(senderSocketId).emit('message_delivered_confirmation', {
            messageId
          });
        }
      }
    } catch (error) {
      logger.error('Socket message delivered error:', { error: error.message });
    }
  }

  async handleMessageRead(socket, data) {
    try {
      const { messageId, conversationId } = data;
      
      await MessagingService.markMessageAsRead(messageId, socket.userId);

      const message = await sql`
        SELECT sender_id FROM messages WHERE id = ${messageId}
      `;

      if (message.length > 0) {
        const senderSocketId = this.activeUsers.get(message[0].sender_id);
        if (senderSocketId) {
          this.io.to(senderSocketId).emit('message_read_confirmation', {
            messageId,
            conversationId
          });
        }
      }
    } catch (error) {
      logger.error('Socket message read error:', { error: error.message });
    }
  }

  async handleEndConversation(socket, data) {
    try {
      const { matchId } = data;
      
      const match = await MatchingService.endMatch(matchId, socket.userId);

      if (match) {
        socket.emit('conversation_ended', { matchId });

        const otherUserId = match.user1_id === socket.userId ? match.user2_id : match.user1_id;
        const otherSocketId = this.activeUsers.get(otherUserId);

        if (otherSocketId) {
          this.io.to(otherSocketId).emit('conversation_ended', { matchId });
        }
      }
    } catch (error) {
      logger.error('Socket end conversation error:', { error: error.message });
    }
  }

  async handleAddReaction(socket, data) {
    try {
      const { messageId, reaction } = data;
      
      await MessagingService.addReaction(messageId, socket.userId, reaction);

      const message = await sql`
        SELECT m.conversation_id, m.sender_id, c.user1_id, c.user2_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.id = ${messageId}
        LIMIT 1
      `;

      if (message.length > 0) {
        const msg = message[0];
        const otherUserId = msg.user1_id === socket.userId ? msg.user2_id : msg.user1_id;
        const otherSocketId = this.activeUsers.get(otherUserId);

        if (otherSocketId) {
          this.io.to(otherSocketId).emit('reaction_added', {
            messageId,
            userId: socket.userId,
            reaction
          });
        }
      }
    } catch (error) {
      logger.error('Socket add reaction error:', { error: error.message });
    }
  }

  async handleRemoveReaction(socket, data) {
    try {
      const { messageId } = data;
      
      await MessagingService.removeReaction(messageId, socket.userId);

      const message = await sql`
        SELECT m.conversation_id, c.user1_id, c.user2_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.id = ${messageId}
        LIMIT 1
      `;

      if (message.length > 0) {
        const msg = message[0];
        const otherUserId = msg.user1_id === socket.userId ? msg.user2_id : msg.user1_id;
        const otherSocketId = this.activeUsers.get(otherUserId);

        if (otherSocketId) {
          this.io.to(otherSocketId).emit('reaction_removed', {
            messageId,
            userId: socket.userId
          });
        }
      }
    } catch (error) {
      logger.error('Socket remove reaction error:', { error: error.message });
    }
  }

  broadcastUserStatus(userId, isOnline) {
    this.io.emit('user_status_changed', {
      userId,
      isOnline
    });
  }

  handleDisconnect(socket) {
    const userId = this.activeSockets.get(socket.id);
    
    if (userId) {
      this.activeSockets.delete(socket.id);
      
      const userHasOtherSockets = Array.from(this.activeSockets.values()).includes(userId);
      
      if (!userHasOtherSockets) {
        this.activeUsers.delete(userId);
        this.matchingUsers.delete(userId);
        
        sql`
          UPDATE users SET is_online = FALSE, last_seen = CURRENT_TIMESTAMP
          WHERE id = ${userId}
        `.catch(error => {
          logger.error('Failed to update user offline status:', { error: error.message });
        });

        this.broadcastUserStatus(userId, false);
      }
    }

    logger.info('Socket disconnected', { socketId: socket.id });
  }
}

module.exports = SocketHandler;
