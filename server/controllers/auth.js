const AuthService = require('../services/auth');
const ModerationService = require('../services/moderation');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const logger = require('../utils/logger');

class AuthController {
  static async register(req, res) {
    try {
      const { email, password } = req.body;

      const user = await AuthService.createUser(email, password);

      await ModerationService.logActivity(user.id, 'register', {}, req.ip, req.headers['user-agent']);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          userId: user.id,
          email: user.email,
          anonymousId: user.anonymous_id
        }
      });
    } catch (error) {
      logger.error('Registration error:', { error: error.message });
      
      if (error.message.includes('duplicate key')) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.'
      });
    }
  }

  static async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      const user = await AuthService.verifyEmail(token);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      await ModerationService.logActivity(user.id, 'verify_email', {}, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      logger.error('Email verification error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Email verification failed'
      });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await AuthService.authenticateUser(email, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (!user.is_verified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your email before logging in',
          needsVerification: true
        });
      }

      if (user.status === 'banned') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been banned',
          banned: true
        });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended',
          suspended: true
        });
      }

      const token = generateToken(user.id);
      setAuthCookie(res, token);

      await AuthService.createSession(user.id, req.ip, req.headers['user-agent'], token);
      await AuthService.updateLastSeen(user.id);
      await ModerationService.logActivity(user.id, 'login', {}, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            anonymousId: user.anonymous_id,
            status: user.status
          }
        }
      });
    } catch (error) {
      logger.error('Login error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  }

  static async logout(req, res) {
    try {
      const token = req.cookies.token;
      
      if (token) {
        await AuthService.deleteSession(token);
      }

      await AuthService.setUserOffline(req.userId);
      await ModerationService.logActivity(req.userId, 'logout', {}, req.ip, req.headers['user-agent']);

      clearAuthCookie(res);

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      logger.error('Logout error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const result = await AuthService.createForgotPasswordToken(email);

      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      logger.error('Forgot password error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to process password reset request'
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      const user = await AuthService.resetPassword(token, password);

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      await ModerationService.logActivity(user.id, 'reset_password', {}, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Password reset successful'
      });
    } catch (error) {
      logger.error('Reset password error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Password reset failed'
      });
    }
  }

  static async getCurrentUser(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            anonymousId: req.user.anonymous_id,
            status: req.user.status,
            warningCount: req.user.warning_count,
            settings: req.user.settings
          }
        }
      });
    } catch (error) {
      logger.error('Get current user error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to get user information'
      });
    }
  }

  static async updateSettings(req, res) {
    try {
      const { sql } = require('../config');
      const { language, notifications, sound, theme } = req.body;

      const currentSettings = req.user.settings || {};
      const updatedSettings = {
        ...currentSettings,
        language: language || currentSettings.language || 'id',
        notifications: notifications !== undefined ? notifications : currentSettings.notifications,
        sound: sound !== undefined ? sound : currentSettings.sound,
        theme: theme || currentSettings.theme || 'light'
      };

      await sql`
        UPDATE users 
        SET settings = ${JSON.stringify(updatedSettings)},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${req.userId}
      `;

      await ModerationService.logActivity(req.userId, 'update_settings', updatedSettings, req.ip, req.headers['user-agent']);

      res.json({
        success: true,
        message: 'Settings updated successfully',
        data: {
          settings: updatedSettings
        }
      });
    } catch (error) {
      logger.error('Update settings error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to update settings'
      });
    }
  }

  static async deleteAccount(req, res) {
    try {
      const { sql } = require('../config');
      const { password } = req.body;

      const user = await AuthService.authenticateUser(req.user.email, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }

      await sql`
        DELETE FROM users WHERE id = ${req.userId}
      `;

      await ModerationService.logActivity(req.userId, 'delete_account', {}, req.ip, req.headers['user-agent']);

      clearAuthCookie(res);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error('Delete account error:', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  }
}

module.exports = AuthController;
