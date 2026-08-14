const MessagingService = require('../services/messaging');
const MatchingService = require('../services/matching');
const ModerationService = require('../services/moderation');
const logger = require('../utils/logger');
const { sql, config } = require('../config');
const { isValidFileType } = require('../utils/validation');

class ChatController {
  static async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const { limit = 50, before } = req.query;

      const messages = await MessagingService.getConversationMessages(
        conversationId, 
        req.userId, 
        parseInt(limit), 
        before
      );

      res.json({
        success: true,
        data: {
          messages
        }
      });
    } catch (error) {
      logger.error('Get messages error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get messages'
      });
    }
  }

  static async sendMessage(req, res) {
    try {
      const { conversationId, content, messageType = 'text', replyToMessageId } = req.body;

      const isSpam = await ModerationService.detectSpam(req.userId);
      
      if (isSpam) {
        await ModerationService.logActivity(req.userId, 'spam_detected', { conversationId }, req.ip, req.headers['user-agent']);
        
        return res.status(429).json({
          success: false,
          message: 'Message rate limit exceeded. Please slow down.'
        });
      }

      const result = await MessagingService.sendMessage(
        conversationId,
        req.userId,
        content,
        messageType,
        { replyToMessageId }
      );

      res.status(201).json({
        success: true,
        message: 'Message sent',
        data: {
          message: result.message
        }
      });
    } catch (error) {
      logger.error('Send message error:', { error: error.message });
      
      if (error.message.includes('not part of this conversation')) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to send messages in this conversation'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  }

  static async markAsRead(req, res) {
    try {
      const { conversationId } = req.params;

      const markedCount = await MessagingService.markConversationAsRead(conversationId, req.userId);

      res.json({
        success: true,
        message: 'Messages marked as read',
        data: {
          markedCount
        }
      });
    } catch (error) {
      logger.error('Mark as read error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to mark messages as read'
      });
    }
  }

  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;

      const result = await MessagingService.deleteMessage(messageId, req.userId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Message not found or unauthorized'
        });
      }

      res.json({
        success: true,
        message: 'Message deleted'
      });
    } catch (error) {
      logger.error('Delete message error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to delete message'
      });
    }
  }

  static async addReaction(req, res) {
    try {
      const { messageId } = req.params;
      const { reaction } = req.body;

      if (!reaction || reaction.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reaction'
        });
      }

      await MessagingService.addReaction(messageId, req.userId, reaction);

      res.json({
        success: true,
        message: 'Reaction added'
      });
    } catch (error) {
      logger.error('Add reaction error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to add reaction'
      });
    }
  }

  static async removeReaction(req, res) {
    try {
      const { messageId } = req.params;

      await MessagingService.removeReaction(messageId, req.userId);

      res.json({
        success: true,
        message: 'Reaction removed'
      });
    } catch (error) {
      logger.error('Remove reaction error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to remove reaction'
      });
    }
  }

  static async getReactions(req, res) {
    try {
      const { messageId } = req.params;

      const reactions = await MessagingService.getMessageReactions(messageId);

      res.json({
        success: true,
        data: {
          reactions
        }
      });
    } catch (error) {
      logger.error('Get reactions error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get reactions'
      });
    }
  }

  static async startMatching(req, res) {
    try {
      const queue = await MatchingService.addToQueue(req.userId);

      await ModerationService.logActivity(req.userId, 'start_matching', {}, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Searching for match',
        data: {
          queue
        }
      });
    } catch (error) {
      logger.error('Start matching error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to start matching'
      });
    }
  }

  static async cancelMatching(req, res) {
    try {
      const result = await MatchingService.cancelSearch(req.userId);

      await ModerationService.logActivity(req.userId, 'cancel_matching', {}, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Search cancelled',
        data: {
          cancelled: result
        }
      });
    } catch (error) {
      logger.error('Cancel matching error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to cancel matching'
      });
    }
  }

  static async endConversation(req, res) {
    try {
      const { matchId } = req.params;

      const match = await MatchingService.endMatch(matchId, req.userId);

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Active match not found'
        });
      }

      await ModerationService.logActivity(req.userId, 'end_conversation', { matchId }, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Conversation ended',
        data: {
          match
        }
      });
    } catch (error) {
      logger.error('End conversation error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to end conversation'
      });
    }
  }

  static async uploadMedia(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'voice';

      if (!isValidFileType(req.file.mimetype, fileType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type'
        });
      }

      if (req.file.size > config.maxFileSize) {
        return res.status(400).json({
          success: false,
          message: 'File too large'
        });
      }

      const mediaUrl = `/uploads/${req.file.filename}`;

      await sql`
        INSERT INTO media (user_id, file_type, file_url, file_size, mime_type)
        VALUES (${req.userId}, ${fileType}, ${mediaUrl}, ${req.file.size}, ${req.file.mimetype})
      `;

      await ModerationService.logActivity(req.userId, 'upload_media', { 
        type: fileType, 
        size: req.file.size 
      }, req.ip, req.headers['user-agent']);

      res.status(201).json({
        success: true,
        message: 'File uploaded',
        data: {
          url: mediaUrl,
          type: fileType,
          size: req.file.size
        }
      });
    } catch (error) {
      logger.error('Upload media error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    }
  }
}

module.exports = ChatController;
