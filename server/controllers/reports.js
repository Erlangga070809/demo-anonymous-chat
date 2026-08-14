const ModerationService = require('../services/moderation');
const logger = require('../utils/logger');

class ReportsController {
  static async createReport(req, res) {
    try {
      const { reportedUserId, messageId, reportType, reportCategory, description } = req.body;

      if (!reportType || !reportCategory) {
        return res.status(400).json({
          success: false,
          message: 'Report type and category are required'
        });
      }

      const report = await ModerationService.createReport(req.userId, {
        reportedUserId,
        messageId,
        reportType,
        reportCategory,
        description
      });

      await ModerationService.logActivity(req.userId, 'create_report', {
        reportType,
        reportCategory,
        reportedUserId
      }, req.ip, req.headers['user-agent']);

      res.status(201).json({
        success: true,
        message: 'Report submitted',
        data: {
          report
        }
      });
    } catch (error) {
      logger.error('Create report error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to submit report'
      });
    }
  }

  static async getUserReports(req, res) {
    try {
      const { sql } = require('../config');

      const reports = await sql`
        SELECT r.*, ru.anonymous_id as reported_user_anonymous_id
        FROM reports r
        LEFT JOIN users ru ON r.reported_user_id = ru.id
        WHERE r.reporter_id = ${req.userId}
        ORDER BY r.created_at DESC
        LIMIT 20
      `;

      res.json({
        success: true,
        data: {
          reports
        }
      });
    } catch (error) {
      logger.error('Get user reports error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get reports'
      });
    }
  }

  static async submitAppeal(req, res) {
    try {
      const { banId, appealText } = req.body;

      if (!banId || !appealText) {
        return res.status(400).json({
          success: false,
          message: 'Ban ID and appeal text are required'
        });
      }

      await ModerationService.submitAppeal(req.userId, banId, appealText);

      await ModerationService.logActivity(req.userId, 'submit_appeal', { banId }, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Appeal submitted'
      });
    } catch (error) {
      logger.error('Submit appeal error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to submit appeal'
      });
    }
  }
}

module.exports = ReportsController;
