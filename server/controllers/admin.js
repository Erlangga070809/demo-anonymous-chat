const { sql } = require('../config');
const ModerationService = require('../services/moderation');
const logger = require('../utils/logger');

class AdminController {
  static async getDashboardStats(req, res) {
    try {
      const stats = await sql`
        SELECT
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
          (SELECT COUNT(*) FROM users WHERE status = 'banned') as banned_users,
          (SELECT COUNT(*) FROM users WHERE status = 'suspended') as suspended_users,
          (SELECT COUNT(*) FROM users WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as new_users_24h,
          (SELECT COUNT(*) FROM conversations WHERE status = 'active') as active_conversations,
          (SELECT COUNT(*) FROM messages WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours') as messages_24h,
          (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
          (SELECT COUNT(*) FROM match_queue WHERE status = 'waiting') as waiting_users
      `;

      res.json({
        success: true,
        data: stats[0]
      });
    } catch (error) {
      logger.error('Get dashboard stats error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard statistics'
      });
    }
  }

  static async getUsers(req, res) {
    try {
      const { page = 1, limit = 20, search = '', status = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = sql`
        SELECT id, email, anonymous_id, status, warning_count, is_online, last_seen, created_at
        FROM users
      `;

      if (search) {
        query = sql`${query} WHERE email ILIKE ${'%' + search + '%'} OR anonymous_id ILIKE ${'%' + search + '%'}`;
      }

      if (status) {
        query = search ? sql`${query} AND status = ${status}` : sql`${query} WHERE status = ${status}`;
      }

      const countQuery = search || status 
        ? sql`SELECT COUNT(*) as count FROM users ${search ? sql`WHERE email ILIKE ${'%' + search + '%'} OR anonymous_id ILIKE ${'%' + search + '%'}` : sql``} ${status ? sql`${search ? sql`AND` : sql`WHERE`} status = ${status}` : sql``}`
        : sql`SELECT COUNT(*) as count FROM users`;

      const [users, countResult] = await Promise.all([
        sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        countQuery
      ]);

      res.json({
        success: true,
        data: {
          users,
          total: parseInt(countResult[0].count),
          page: parseInt(page),
          totalPages: Math.ceil(parseInt(countResult[0].count) / limit)
        }
      });
    } catch (error) {
      logger.error('Get users error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get users'
      });
    }
  }

  static async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      const users = await sql`
        SELECT u.*, 
               (SELECT COUNT(*) FROM reports WHERE reported_user_id = u.id) as report_count,
               (SELECT COUNT(*) FROM blocks WHERE blocked_id = u.id) as block_count
        FROM users u
        WHERE u.id = ${userId}
        LIMIT 1
      `;

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const moderationHistory = await ModerationService.getModerationHistory(userId);

      res.json({
        success: true,
        data: {
          user: users[0],
          moderationHistory
        }
      });
    } catch (error) {
      logger.error('Get user details error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get user details'
      });
    }
  }

  static async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      await ModerationService.suspendUser(userId, req.userId, reason);

      res.json({
        success: true,
        message: 'User suspended'
      });
    } catch (error) {
      logger.error('Suspend user error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to suspend user'
      });
    }
  }

  static async banUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason, banType = 'temporary', duration } = req.body;

      let expiresAt = null;
      if (banType === 'temporary' && duration) {
        expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
      }

      const ban = await ModerationService.banUser(userId, req.userId, reason, banType, expiresAt);

      res.json({
        success: true,
        message: 'User banned',
        data: {
          ban
        }
      });
    } catch (error) {
      logger.error('Ban user error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to ban user'
      });
    }
  }

  static async unbanUser(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      await ModerationService.unbanUser(userId, req.userId, reason);

      res.json({
        success: true,
        message: 'User unbanned'
      });
    } catch (error) {
      logger.error('Unban user error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to unban user'
      });
    }
  }

  static async addWarning(req, res) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      await ModerationService.addWarning(userId, req.userId, reason);

      res.json({
        success: true,
        message: 'Warning added'
      });
    } catch (error) {
      logger.error('Add warning error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to add warning'
      });
    }
  }

  static async getReports(req, res) {
    try {
      const { status = 'pending', page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const reports = await sql`
        SELECT r.*, 
               ru.anonymous_id as reporter_anonymous_id,
               tu.anonymous_id as reported_anonymous_id
        FROM reports r
        LEFT JOIN users ru ON r.reporter_id = ru.id
        LEFT JOIN users tu ON r.reported_user_id = tu.id
        WHERE r.status = ${status}
        ORDER BY r.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countResult = await sql`
        SELECT COUNT(*) as count FROM reports WHERE status = ${status}
      `;

      res.json({
        success: true,
        data: {
          reports,
          total: parseInt(countResult[0].count),
          page: parseInt(page),
          totalPages: Math.ceil(parseInt(countResult[0].count) / limit)
        }
      });
    } catch (error) {
      logger.error('Get reports error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get reports'
      });
    }
  }

  static async processReport(req, res) {
    try {
      const { reportId } = req.params;
      const { action, notes } = req.body;

      await ModerationService.processReport(reportId, req.userId, action, notes);

      res.json({
        success: true,
        message: 'Report processed'
      });
    } catch (error) {
      logger.error('Process report error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to process report'
      });
    }
  }

  static async getModerationLogs(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      const logs = await sql`
        SELECT ml.*, 
               m.email as moderator_email,
               tu.email as target_email
        FROM moderation_logs ml
        LEFT JOIN users m ON ml.moderator_id = m.id
        LEFT JOIN users tu ON ml.target_user_id = tu.id
        ORDER BY ml.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countResult = await sql`
        SELECT COUNT(*) as count FROM moderation_logs
      `;

      res.json({
        success: true,
        data: {
          logs,
          total: parseInt(countResult[0].count),
          page: parseInt(page),
          totalPages: Math.ceil(parseInt(countResult[0].count) / limit)
        }
      });
    } catch (error) {
      logger.error('Get moderation logs error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get moderation logs'
      });
    }
  }

  static async getActivityLogs(req, res) {
    try {
      const { page = 1, limit = 50, userId = '' } = req.query;
      const offset = (page - 1) * limit;

      let query = sql`
        SELECT al.*, u.email
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
      `;

      if (userId) {
        query = sql`${query} WHERE al.user_id = ${userId}`;
      }

      const logs = await sql`${query} ORDER BY al.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

      const countResult = userId 
        ? await sql`SELECT COUNT(*) as count FROM activity_logs WHERE user_id = ${userId}`
        : await sql`SELECT COUNT(*) as count FROM activity_logs`;

      res.json({
        success: true,
        data: {
          logs,
          total: parseInt(countResult[0].count),
          page: parseInt(page),
          totalPages: Math.ceil(parseInt(countResult[0].count) / limit)
        }
      });
    } catch (error) {
      logger.error('Get activity logs error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get activity logs'
      });
    }
  }

  static async getActiveConversations(req, res) {
    try {
      const conversations = await sql`
        SELECT c.*, 
               u1.anonymous_id as user1_anonymous_id,
               u2.anonymous_id as user2_anonymous_id,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        JOIN users u1 ON c.user1_id = u1.id
        JOIN users u2 ON c.user2_id = u2.id
        WHERE c.status = 'active'
        ORDER BY c.updated_at DESC
        LIMIT 50
      `;

      res.json({
        success: true,
        data: {
          conversations
        }
      });
    } catch (error) {
      logger.error('Get active conversations error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get active conversations'
      });
    }
  }

  static async reviewAppeal(req, res) {
    try {
      const { banId } = req.params;
      const { decision, notes } = req.body;

      await ModerationService.reviewAppeal(banId, req.userId, decision, notes);

      res.json({
        success: true,
        message: 'Appeal reviewed'
      });
    } catch (error) {
      logger.error('Review appeal error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to review appeal'
      });
    }
  }
}

module.exports = AdminController;
