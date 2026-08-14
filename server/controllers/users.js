const { sql } = require('../config');
const ModerationService = require('../services/moderation');
const logger = require('../utils/logger');

class UsersController {
  static async searchUsers(req, res) {
    try {
      const { query } = req.query;

      if (!query || query.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 3 characters'
        });
      }

      const users = await sql`
        SELECT id, anonymous_id, status, created_at
        FROM users
        WHERE anonymous_id ILIKE ${'%' + query + '%'}
          AND status = 'active'
          AND id != ${req.userId}
        LIMIT 20
      `;

      const blockedUsers = await sql`
        SELECT blocked_id FROM blocks WHERE blocker_id = ${req.userId}
      `;

      const blockedIds = blockedUsers.map(b => b.blocked_id);
      const filteredUsers = users.filter(u => !blockedIds.includes(u.id));

      res.json({
        success: true,
        data: {
          users: filteredUsers
        }
      });
    } catch (error) {
      logger.error('Search users error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to search users'
      });
    }
  }

  static async getBlockedUsers(req, res) {
    try {
      const blockedUsers = await sql`
        SELECT b.id, b.blocked_id, u.anonymous_id, b.created_at, b.reason
        FROM blocks b
        JOIN users u ON b.blocked_id = u.id
        WHERE b.blocker_id = ${req.userId}
        ORDER BY b.created_at DESC
      `;

      res.json({
        success: true,
        data: {
          blockedUsers
        }
      });
    } catch (error) {
      logger.error('Get blocked users error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get blocked users'
      });
    }
  }

  static async blockUser(req, res) {
    try {
      const { userId, reason } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      if (userId === req.userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot block yourself'
        });
      }

      const block = await ModerationService.blockUser(req.userId, userId, reason);

      await ModerationService.logActivity(req.userId, 'block_user', { blockedId: userId }, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'User blocked successfully',
        data: {
          block
        }
      });
    } catch (error) {
      logger.error('Block user error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to block user'
      });
    }
  }

  static async unblockUser(req, res) {
    try {
      const { userId } = req.params;

      await ModerationService.unblockUser(req.userId, userId);

      await ModerationService.logActivity(req.userId, 'unblock_user', { unblockedId: userId }, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'User unblocked successfully'
      });
    } catch (error) {
      logger.error('Unblock user error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to unblock user'
      });
    }
  }

  static async getNotifications(req, res) {
    try {
      const notifications = await sql`
        SELECT id, type, title, message, is_read, data, created_at
        FROM notifications
        WHERE user_id = ${req.userId}
        ORDER BY created_at DESC
        LIMIT 50
      `;

      res.json({
        success: true,
        data: {
          notifications
        }
      });
    } catch (error) {
      logger.error('Get notifications error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  }

  static async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;

      await sql`
        UPDATE notifications 
        SET is_read = TRUE
        WHERE id = ${notificationId} AND user_id = ${req.userId}
      `;

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Mark notification read error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification'
      });
    }
  }

  static async markAllNotificationsAsRead(req, res) {
    try {
      await sql`
        UPDATE notifications 
        SET is_read = TRUE
        WHERE user_id = ${req.userId} AND is_read = FALSE
      `;

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      logger.error('Mark all notifications read error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to mark notifications'
      });
    }
  }

  static async getPrivacySettings(req, res) {
    try {
      const privacySettings = {
        showOnlineStatus: true,
        allowMessagesFromStrangers: false,
        shareTypingStatus: true,
        shareReadReceipts: true
      };

      res.json({
        success: true,
        data: {
          privacySettings
        }
      });
    } catch (error) {
      logger.error('Get privacy settings error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy settings'
      });
    }
  }

  static async updatePrivacySettings(req, res) {
    try {
      const { showOnlineStatus, allowMessagesFromStrangers, shareTypingStatus, shareReadReceipts } = req.body;

      await ModerationService.logActivity(req.userId, 'update_privacy_settings', req.body, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Privacy settings updated',
        data: {
          showOnlineStatus,
          allowMessagesFromStrangers,
          shareTypingStatus,
          shareReadReceipts
        }
      });
    } catch (error) {
      logger.error('Update privacy settings error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings'
      });
    }
  }

  static async exportUserData(req, res) {
    try {
      const userData = await sql`
        SELECT 
          u.id, u.email, u.anonymous_id, u.status, u.warning_count,
          u.settings, u.created_at, u.updated_at,
          json_agg(DISTINCT jsonb_build_object(
            'id', c.id,
            'created_at', c.created_at,
            'status', c.status
          )) as conversations,
          json_agg(DISTINCT jsonb_build_object(
            'id', m.id,
            'content', m.content,
            'type', m.message_type,
            'created_at', m.created_at
          )) as messages
        FROM users u
        LEFT JOIN conversations c ON (c.user1_id = u.id OR c.user2_id = u.id)
        LEFT JOIN messages m ON m.sender_id = u.id
        WHERE u.id = ${req.userId}
        GROUP BY u.id
      `;

      res.json({
        success: true,
        data: userData[0]
      });
    } catch (error) {
      logger.error('Export user data error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to export user data'
      });
    }
  }
}

module.exports = UsersController;
