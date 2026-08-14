const { sql } = require('../config');
const logger = require('../utils/logger');

const checkRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!sql) {
        return res.status(500).json({
          success: false,
          message: 'Database connection not available'
        });
      }

      const adminRoles = await sql`
        SELECT ar.role, ar.permissions
        FROM admin_roles ar
        WHERE ar.user_id = ${req.userId}
        LIMIT 1
      `;

      if (adminRoles.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      const userRole = adminRoles[0].role;
      
      if (!roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      req.adminRole = userRole;
      req.adminPermissions = adminRoles[0].permissions;
      next();
    } catch (error) {
      logger.error('Admin authorization error:', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authorization'
      });
    }
  };
};

const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.adminPermissions) {
      return res.status(403).json({
        success: false,
        message: 'Permissions not found'
      });
    }

    if (req.adminRole === 'owner') {
      return next();
    }

    if (req.adminPermissions[permission]) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for this action'
    });
  };
};

const validateAdminAction = (action) => {
  return (req, res, next) => {
    const allowedActions = [
      'suspend_user',
      'ban_user',
      'unban_user',
      'block_user',
      'unblock_user',
      'process_report',
      'add_warning',
      'restrict_user',
      'view_moderation_history'
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin action'
      });
    }

    next();
  };
};

module.exports = {
  checkRole,
  checkPermission,
  validateAdminAction
};
