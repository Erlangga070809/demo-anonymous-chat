const { sql } = require('../config');
const logger = require('../utils/logger');

class MatchingService {
  static async addToQueue(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const existingQueue = await sql`
        SELECT id FROM match_queue 
        WHERE user_id = ${userId} 
          AND status = 'waiting'
          AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1
      `;

      if (existingQueue.length > 0) {
        return existingQueue[0];
      }

      const queues = await sql`
        INSERT INTO match_queue (user_id, status)
        VALUES (${userId}, 'waiting')
        RETURNING id, user_id, status, created_at
      `;

      logger.info('User added to match queue', { userId, queueId: queues[0].id });
      return queues[0];
    } catch (error) {
      logger.error('Failed to add to queue:', { error: error.message });
      throw error;
    }
  }

  static async findMatch(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const recentMatches = await sql`
        SELECT user2_id FROM match_history 
        WHERE user1_id = ${userId} 
          AND last_matched > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `;

      const excludedUserIds = recentMatches.map(m => m.user2_id);
      excludedUserIds.push(userId);

      const potentialMatches = await sql`
        SELECT mq.id as queue_id, mq.user_id, u.anonymous_id
        FROM match_queue mq
        JOIN users u ON mq.user_id = u.id
        WHERE mq.status = 'waiting'
          AND mq.user_id != ${userId}
          AND mq.user_id NOT IN (SELECT unnest(${excludedUserIds}::uuid[]))
          AND mq.expires_at > CURRENT_TIMESTAMP
          AND u.status = 'active'
        ORDER BY mq.created_at ASC
        LIMIT 1
      `;

      if (potentialMatches.length === 0) {
        return null;
      }

      const matchedUser = potentialMatches[0];

      const matchResult = await sql`
        INSERT INTO matches (user1_id, user2_id, status)
        VALUES (${userId}, ${matchedUser.user_id}, 'active')
        RETURNING id
      `;

      const matchId = matchResult[0].id;

      await sql`
        UPDATE match_queue 
        SET status = 'matched', matched_at = CURRENT_TIMESTAMP
        WHERE id = ${matchedUser.queue_id}
      `;

      await sql`
        UPDATE match_queue 
        SET status = 'matched', matched_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND status = 'waiting'
      `;

      const conversationResult = await sql`
        INSERT INTO conversations (match_id, user1_id, user2_id, status)
        VALUES (${matchId}, ${userId}, ${matchedUser.user_id}, 'active')
        RETURNING id
      `;

      const conversationId = conversationResult[0].id;

      await sql`
        UPDATE matches 
        SET conversation_id = ${conversationId}
        WHERE id = ${matchId}
      `;

      await this.updateMatchHistory(userId, matchedUser.user_id);

      logger.info('Match created', { 
        matchId, 
        conversationId, 
        user1: userId, 
        user2: matchedUser.user_id 
      });

      return {
        matchId,
        conversationId,
        matchedUser: {
          id: matchedUser.user_id,
          anonymousId: matchedUser.anonymous_id
        }
      };
    } catch (error) {
      logger.error('Failed to find match:', { error: error.message });
      throw error;
    }
  }

  static async updateMatchHistory(user1Id, user2Id) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const existing = await sql`
        SELECT id, match_count FROM match_history 
        WHERE (user1_id = ${user1Id} AND user2_id = ${user2Id})
           OR (user1_id = ${user2Id} AND user2_id = ${user1Id})
        LIMIT 1
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE match_history 
          SET match_count = match_count + 1,
              last_matched = CURRENT_TIMESTAMP
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          INSERT INTO match_history (user1_id, user2_id)
          VALUES (${user1Id}, ${user2Id})
        `;
      }
    } catch (error) {
      logger.error('Failed to update match history:', { error: error.message });
    }
  }

  static async cancelSearch(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const result = await sql`
        UPDATE match_queue 
        SET status = 'cancelled'
        WHERE user_id = ${userId} 
          AND status = 'waiting'
        RETURNING id
      `;

      logger.info('Match search cancelled', { userId, cancelled: result.length });
      return result.length > 0;
    } catch (error) {
      logger.error('Failed to cancel search:', { error: error.message });
      throw error;
    }
  }

  static async endMatch(matchId, userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const match = await sql`
        SELECT id, user1_id, user2_id, conversation_id
        FROM matches 
        WHERE id = ${matchId} 
          AND status = 'active'
          AND (user1_id = ${userId} OR user2_id = ${userId})
        LIMIT 1
      `;

      if (match.length === 0) {
        return null;
      }

      await sql`
        UPDATE matches 
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP
        WHERE id = ${matchId}
      `;

      if (match[0].conversation_id) {
        await sql`
          UPDATE conversations 
          SET status = 'closed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ${match[0].conversation_id}
        `;
      }

      logger.info('Match ended', { matchId, userId });
      return match[0];
    } catch (error) {
      logger.error('Failed to end match:', { error: error.message });
      throw error;
    }
  }

  static async getActiveMatch(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const activeMatch = await sql`
        SELECT 
          m.id as match_id,
          m.conversation_id,
          m.matched_at,
          CASE 
            WHEN m.user1_id = ${userId} THEN m.user2_id
            ELSE m.user1_id
          END as matched_user_id,
          u.anonymous_id
        FROM matches m
        JOIN users u ON u.id = CASE 
          WHEN m.user1_id = ${userId} THEN m.user2_id
          ELSE m.user1_id
        END
        WHERE (m.user1_id = ${userId} OR m.user2_id = ${userId})
          AND m.status = 'active'
        ORDER BY m.matched_at DESC
        LIMIT 1
      `;

      return activeMatch.length > 0 ? activeMatch[0] : null;
    } catch (error) {
      logger.error('Failed to get active match:', { error: error.message });
      throw error;
    }
  }

  static async cleanupExpiredQueues() {
    try {
      if (!sql) throw new Error('Database connection not available');

      const expired = await sql`
        UPDATE match_queue 
        SET status = 'expired'
        WHERE status = 'waiting' 
          AND expires_at < CURRENT_TIMESTAMP
        RETURNING id, user_id
      `;

      if (expired.length > 0) {
        logger.info('Expired queues cleaned', { count: expired.length });
      }

      return expired.length;
    } catch (error) {
      logger.error('Failed to cleanup expired queues:', { error: error.message });
    }
  }
}

module.exports = MatchingService;
