const { sql } = require('../config');
const logger = require('../utils/logger');

class ModerationService {
  static async createReport(reporterId, reportData) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const reports = await sql`
        INSERT INTO reports (
          reporter_id, 
          reported_user_id, 
          message_id, 
          report_type,
          report_category, 
          description
        )
        VALUES (
          ${reporterId}, 
          ${reportData.reportedUserId || null}, 
          ${reportData.messageId || null}, 
          ${reportData.reportType},
          ${reportData.reportCategory}, 
          ${reportData.description || null}
        )
        RETURNING id
      `;

      logger.info('Report created', { 
        reportId: reports[0].id, 
        reporterId, 
        type: reportData.reportType 
      });

      return reports[0];
    } catch (error) {
      logger.error('Failed to create report:', { error: error.message });
      throw error;
    }
  }

  static async blockUser(blockerId, blockedId, reason = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      if (blockerId === blockedId) {
        throw new Error('Cannot block yourself');
      }

      const existingBlock = await sql`
        SELECT id FROM blocks 
        WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
        LIMIT 1
      `;

      if (existingBlock.length > 0) {
        return existingBlock[0];
      }

      const blocks = await sql`
        INSERT INTO blocks (blocker_id, blocked_id, reason)
        VALUES (${blockerId}, ${blockedId}, ${reason})
        RETURNING id
      `;

      await sql`
        UPDATE matches 
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP
        WHERE (user1_id = ${blockerId} AND user2_id = ${blockedId})
           OR (user1_id = ${blockedId} AND user2_id = ${blockerId})
          AND status = 'active'
      `;

      logger.info('User blocked', { blockerId, blockedId });
      return blocks[0];
    } catch (error) {
      logger.error('Failed to block user:', { error: error.message });
      throw error;
    }
  }

  static async unblockUser(blockerId, blockedId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        DELETE FROM blocks 
        WHERE blocker_id = ${blockerId} AND blocked_id = ${blockedId}
      `;

      logger.info('User unblocked', { blockerId, blockedId });
      return true;
    } catch (error) {
      logger.error('Failed to unblock user:', { error: error.message });
      throw error;
    }
  }

  static async isBlocked(userId1, userId2) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const block = await sql`
        SELECT id FROM blocks 
        WHERE (blocker_id = ${userId1} AND blocked_id = ${userId2})
           OR (blocker_id = ${userId2} AND blocked_id = ${userId1})
        LIMIT 1
      `;

      return block.length > 0;
    } catch (error) {
      logger.error('Failed to check block status:', { error: error.message });
      return false;
    }
  }

  static async detectSpam(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const recentMessages = await sql`
        SELECT COUNT(*) as count
        FROM messages 
        WHERE sender_id = ${userId}
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
      `;

      return parseInt(recentMessages[0].count) > 10;
    } catch (error) {
      logger.error('Failed to detect spam:', { error: error.message });
      return false;
    }
  }

  static async addWarning(userId, moderatorId, reason) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET warning_count = warning_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;

      await this.logModerationAction(moderatorId, userId, 'add_warning', reason);

      logger.info('Warning added to user', { userId, moderatorId });
      return true;
    } catch (error) {
      logger.error('Failed to add warning:', { error: error.message });
      throw error;
    }
  }

  static async suspendUser(userId, moderatorId, reason, duration = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET status = 'suspended',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;

      await this.logModerationAction(moderatorId, userId, 'suspend_user', reason);

      logger.info('User suspended', { userId, moderatorId });
      return true;
    } catch (error) {
      logger.error('Failed to suspend user:', { error: error.message });
      throw error;
    }
  }

  static async banUser(userId, moderatorId, reason, banType = 'temporary', expiresAt = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET status = 'banned',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;

      const bans = await sql`
        INSERT INTO bans (user_id, banned_by, ban_type, reason, expires_at)
        VALUES (${userId}, ${moderatorId}, ${banType}, ${reason}, ${expiresAt})
        RETURNING id
      `;

      await this.logModerationAction(moderatorId, userId, 'ban_user', reason);

      logger.info('User banned', { userId, moderatorId, banType });
      return bans[0];
    } catch (error) {
      logger.error('Failed to ban user:', { error: error.message });
      throw error;
    }
  }

  static async unbanUser(userId, moderatorId, reason) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET status = 'active',
            warning_count = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId} AND status = 'banned'
      `;

      await sql`
        UPDATE bans 
        SET is_active = FALSE
        WHERE user_id = ${userId} AND is_active = TRUE
      `;

      await this.logModerationAction(moderatorId, userId, 'unban_user', reason);

      logger.info('User unbanned', { userId, moderatorId });
      return true;
    } catch (error) {
      logger.error('Failed to unban user:', { error: error.message });
      throw error;
    }
  }

  static async restrictUser(userId, moderatorId, reason) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET status = 'restricted',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;

      await this.logModerationAction(moderatorId, userId, 'restrict_user', reason);

      logger.info('User restricted', { userId, moderatorId });
      return true;
    } catch (error) {
      logger.error('Failed to restrict user:', { error: error.message });
      throw error;
    }
  }

  static async processReport(reportId, moderatorId, action, notes = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE reports 
        SET status = 'resolved',
            action_taken = ${action},
            resolved_by = ${moderatorId},
            resolved_at = CURRENT_TIMESTAMP
        WHERE id = ${reportId}
      `;

      await this.logModerationAction(moderatorId, null, 'process_report', `Report ${reportId}: ${action}`);

      logger.info('Report processed', { reportId, moderatorId, action });
      return true;
    } catch (error) {
      logger.error('Failed to process report:', { error: error.message });
      throw error;
    }
  }

  static async submitAppeal(userId, banId, appealText) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE bans 
        SET appeal_status = 'pending',
            appeal_text = ${appealText}
        WHERE id = ${banId} AND user_id = ${userId}
      `;

      logger.info('Appeal submitted', { userId, banId });
      return true;
    } catch (error) {
      logger.error('Failed to submit appeal:', { error: error.message });
      throw error;
    }
  }

  static async reviewAppeal(banId, moderatorId, decision, notes = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const decisionStatus = decision === 'approve' ? 'approved' : 'rejected';

      await sql`
        UPDATE bans 
        SET appeal_status = ${decisionStatus},
            appeal_reviewed_by = ${moderatorId},
            appeal_reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ${banId}
      `;

      if (decision === 'approve') {
        const ban = await sql`
          SELECT user_id FROM bans WHERE id = ${banId}
        `;
        
        if (ban.length > 0) {
          await this.unbanUser(ban[0].user_id, moderatorId, 'Appeal approved');
        }
      }

      await this.logModerationAction(moderatorId, null, 'review_appeal', `Ban ${banId}: ${decision}`);

      logger.info('Appeal reviewed', { banId, moderatorId, decision });
      return true;
    } catch (error) {
      logger.error('Failed to review appeal:', { error: error.message });
      throw error;
    }
  }

  static async logModerationAction(moderatorId, targetUserId, action, details) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        INSERT INTO moderation_logs (moderator_id, target_user_id, action, details)
        VALUES (${moderatorId}, ${targetUserId}, ${action}, ${details})
      `;
    } catch (error) {
      logger.error('Failed to log moderation action:', { error: error.message });
    }
  }

  static async getModerationHistory(targetUserId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const history = await sql`
        SELECT ml.*, m.email as moderator_email
        FROM moderation_logs ml
        LEFT JOIN users m ON ml.moderator_id = m.id
        WHERE ml.target_user_id = ${targetUserId}
        ORDER BY ml.created_at DESC
      `;

      return history;
    } catch (error) {
      logger.error('Failed to get moderation history:', { error: error.message });
      throw error;
    }
  }

  static async logActivity(userId, action, details = {}, ipAddress = null, userAgent = null) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent)
        VALUES (${userId}, ${action}, ${JSON.stringify(details)}, ${ipAddress}, ${userAgent})
      `;
    } catch (error) {
      logger.error('Failed to log activity:', { error: error.message });
    }
  }
}

module.exports = ModerationService;
