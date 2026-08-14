const { sql, config } = require('../config');
const logger = require('../utils/logger');
const { sanitizeInput } = require('../utils/validation');

class MessagingService {
  static async sendMessage(conversationId, senderId, content, messageType = 'text', options = {}) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const conversation = await sql`
        SELECT id, user1_id, user2_id, status
        FROM conversations 
        WHERE id = ${conversationId}
        LIMIT 1
      `;

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      const conv = conversation[0];

      if (conv.user1_id !== senderId && conv.user2_id !== senderId) {
        throw new Error('User is not part of this conversation');
      }

      if (conv.status !== 'active') {
        throw new Error('Conversation is not active');
      }

      const sanitizedContent = messageType === 'text' ? sanitizeInput(content) : content;
      const receiverId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;

      const messages = await sql`
        INSERT INTO messages (
          conversation_id, 
          sender_id, 
          message_type, 
          content, 
          media_url,
          media_duration,
          reply_to_message_id
        )
        VALUES (
          ${conversationId}, 
          ${senderId}, 
          ${messageType}, 
          ${sanitizedContent},
          ${options.mediaUrl || null},
          ${options.mediaDuration || null},
          ${options.replyToMessageId || null}
        )
        RETURNING id, conversation_id, sender_id, message_type, content, 
                  media_url, media_duration, reply_to_message_id, created_at
      `;

      await sql`
        UPDATE conversations 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = ${conversationId}
      `;

      logger.info('Message sent', { 
        messageId: messages[0].id, 
        conversationId, 
        senderId 
      });

      return {
        message: messages[0],
        receiverId
      };
    } catch (error) {
      logger.error('Failed to send message:', { error: error.message });
      throw error;
    }
  }

  static async getConversationMessages(conversationId, userId, limit = 50, before = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const conversation = await sql`
        SELECT id, user1_id, user2_id
        FROM conversations 
        WHERE id = ${conversationId}
          AND (user1_id = ${userId} OR user2_id = ${userId})
        LIMIT 1
      `;

      if (conversation.length === 0) {
        throw new Error('Conversation not found or access denied');
      }

      let query = sql`
        SELECT 
          m.id, m.conversation_id, m.sender_id, m.message_type, 
          m.content, m.media_url, m.media_duration, m.reply_to_message_id,
          m.is_read, m.read_at, m.delivered_at, m.created_at,
          u.anonymous_id as sender_anonymous_id
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${conversationId}
          AND NOT (${userId} = ANY(m.deleted_for))
      `;

      if (before) {
        query = sql`${query} AND m.created_at < ${before}`;
      }

      query = sql`${query} ORDER BY m.created_at DESC LIMIT ${limit}`;

      const messages = await query;

      return messages.reverse();
    } catch (error) {
      logger.error('Failed to get messages:', { error: error.message });
      throw error;
    }
  }

  static async markMessageAsDelivered(messageId, userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE messages 
        SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
        WHERE id = ${messageId}
          AND sender_id = ${userId}
      `;

      logger.info('Message marked as delivered', { messageId });
    } catch (error) {
      logger.error('Failed to mark message as delivered:', { error: error.message });
    }
  }

  static async markMessageAsRead(messageId, userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const result = await sql`
        UPDATE messages 
        SET is_read = TRUE,
            read_at = CURRENT_TIMESTAMP
        WHERE id = ${messageId}
          AND conversation_id IN (
            SELECT id FROM conversations 
            WHERE user1_id = ${userId} OR user2_id = ${userId}
          )
        RETURNING id
      `;

      if (result.length > 0) {
        logger.info('Message marked as read', { messageId, userId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to mark message as read:', { error: error.message });
      throw error;
    }
  }

  static async markConversationAsRead(conversationId, userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const result = await sql`
        UPDATE messages 
        SET is_read = TRUE,
            read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ${conversationId}
          AND sender_id != ${userId}
          AND is_read = FALSE
        RETURNING id
      `;

      logger.info('Conversation marked as read', { 
        conversationId, 
        userId, 
        markedCount: result.length 
      });

      return result.length;
    } catch (error) {
      logger.error('Failed to mark conversation as read:', { error: error.message });
      throw error;
    }
  }

  static async deleteMessage(messageId, userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const message = await sql`
        SELECT m.*, c.user1_id, c.user2_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.id = ${messageId}
        LIMIT 1
      `;

      if (message.length === 0) {
        return false;
      }

      const msg = message[0];

      if (msg.sender_id !== userId && msg.user1_id !== userId && msg.user2_id !== userId) {
        return false;
      }

      await sql`
        UPDATE messages 
        SET deleted_for = array_append(deleted_for, ${userId})
        WHERE id = ${messageId}
      `;

      logger.info('Message deleted for user', { messageId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to delete message:', { error: error.message });
      throw error;
    }
  }

  static async addReaction(messageId, userId, reaction) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const message = await sql`
        SELECT m.id, c.user1_id, c.user2_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.id = ${messageId}
        LIMIT 1
      `;

      if (message.length === 0) {
        throw new Error('Message not found');
      }

      const msg = message[0];

      if (msg.user1_id !== userId && msg.user2_id !== userId) {
        throw new Error('User is not part of this conversation');
      }

      const existing = await sql`
        SELECT id FROM message_reactions 
        WHERE message_id = ${messageId} AND user_id = ${userId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE message_reactions 
          SET reaction = ${reaction}
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          INSERT INTO message_reactions (message_id, user_id, reaction)
          VALUES (${messageId}, ${userId}, ${reaction})
        `;
      }

      logger.info('Reaction added', { messageId, userId, reaction });
      return true;
    } catch (error) {
      logger.error('Failed to add reaction:', { error: error.message });
      throw error;
    }
  }

  static async removeReaction(messageId, userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        DELETE FROM message_reactions 
        WHERE message_id = ${messageId} AND user_id = ${userId}
      `;

      logger.info('Reaction removed', { messageId, userId });
      return true;
    } catch (error) {
      logger.error('Failed to remove reaction:', { error: error.message });
      throw error;
    }
  }

  static async getMessageReactions(messageId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const reactions = await sql`
        SELECT mr.reaction, mr.user_id, u.anonymous_id, mr.created_at
        FROM message_reactions mr
        JOIN users u ON mr.user_id = u.id
        WHERE mr.message_id = ${messageId}
        ORDER BY mr.created_at ASC
      `;

      return reactions;
    } catch (error) {
      logger.error('Failed to get reactions:', { error: error.message });
      throw error;
    }
  }
}

module.exports = MessagingService;
