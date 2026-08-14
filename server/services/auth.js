const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sql, config } = require('../config');
const AnonymousIdGenerator = require('../utils/anonymousId');
const logger = require('../utils/logger');

class AuthService {
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(password, salt);
  }

  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  static async createUser(email, password) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const passwordHash = await this.hashPassword(password);
      
      const checkEmail = async (anonymousId) => {
        const existing = await sql`
          SELECT anonymous_id FROM users WHERE anonymous_id = ${anonymousId}
        `;
        return existing.length > 0;
      };

      const anonymousId = await AnonymousIdGenerator.generateUnique(checkEmail);
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const users = await sql`
        INSERT INTO users (email, password_hash, anonymous_id, verification_token, verification_token_expires)
        VALUES (${email}, ${passwordHash}, ${anonymousId}, ${verificationToken}, ${verificationExpires})
        RETURNING id, email, anonymous_id, is_verified
      `;

      if (users.length === 0) {
        throw new Error('Failed to create user');
      }

      await this.sendVerificationEmail(email, verificationToken);

      logger.info('User created successfully', { userId: users[0].id });
      return users[0];
    } catch (error) {
      logger.error('Failed to create user:', { error: error.message });
      throw error;
    }
  }

  static async verifyEmail(token) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const users = await sql`
        UPDATE users 
        SET is_verified = TRUE, 
            verification_token = NULL, 
            verification_token_expires = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE verification_token = ${token} 
          AND verification_token_expires > CURRENT_TIMESTAMP
          AND is_verified = FALSE
        RETURNING id, email, anonymous_id
      `;

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error('Email verification failed:', { error: error.message });
      throw error;
    }
  }

  static async authenticateUser(email, password) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const users = await sql`
        SELECT id, email, password_hash, anonymous_id, is_verified, status
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;

      if (users.length === 0) {
        return null;
      }

      const user = users[0];
      const isPasswordValid = await this.comparePassword(password, user.password_hash);

      if (!isPasswordValid) {
        return null;
      }

      delete user.password_hash;
      return user;
    } catch (error) {
      logger.error('Authentication failed:', { error: error.message });
      throw error;
    }
  }

  static async createForgotPasswordToken(email) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

      const users = await sql`
        UPDATE users 
        SET reset_password_token = ${resetToken}, 
            reset_password_expires = ${resetExpires}
        WHERE email = ${email}
        RETURNING id, email
      `;

      if (users.length > 0) {
        await this.sendPasswordResetEmail(email, resetToken);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to create reset token:', { error: error.message });
      throw error;
    }
  }

  static async resetPassword(token, newPassword) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const passwordHash = await this.hashPassword(newPassword);

      const users = await sql`
        UPDATE users 
        SET password_hash = ${passwordHash},
            reset_password_token = NULL,
            reset_password_expires = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE reset_password_token = ${token}
          AND reset_password_expires > CURRENT_TIMESTAMP
        RETURNING id, email
      `;

      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error('Password reset failed:', { error: error.message });
      throw error;
    }
  }

  static async sendVerificationEmail(email, token) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });

      const verificationLink = `${config.clientUrl}/verify-email?token=${token}`;

      await transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Verify Your Email - Anonymous Chat',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Welcome to Anonymous Chat!</h2>
            <p>Please verify your email address to complete your registration.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              Verify Email
            </a>
            <p>Or copy this link:</p>
            <p style="color: #6B7280;">${verificationLink}</p>
            <p>This link will expire in 24 hours.</p>
          </div>
        `
      });

      logger.info('Verification email sent', { email });
    } catch (error) {
      logger.error('Failed to send verification email:', { error: error.message, email });
    }
  }

  static async sendPasswordResetEmail(email, token) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });

      const resetLink = `${config.clientUrl}/reset-password?token=${token}`;

      await transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Reset Your Password - Anonymous Chat',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Password Reset Request</h2>
            <p>We received a request to reset your password.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0;">
              Reset Password
            </a>
            <p>Or copy this link:</p>
            <p style="color: #6B7280;">${resetLink}</p>
            <p>This link will expire in 1 hour.</p>
            <p style="color: #EF4444;">If you did not request this, please ignore this email.</p>
          </div>
        `
      });

      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Failed to send password reset email:', { error: error.message, email });
    }
  }

  static async createSession(userId, ipAddress, userAgent, token) {
    try {
      if (!sql) throw new Error('Database connection not available');

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await sql`
        INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at)
        VALUES (${userId}, ${token}, ${ipAddress}, ${userAgent}, ${expiresAt})
      `;

      logger.info('Session created', { userId });
    } catch (error) {
      logger.error('Failed to create session:', { error: error.message });
      throw error;
    }
  }

  static async deleteSession(token) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        DELETE FROM sessions WHERE token = ${token}
      `;

      logger.info('Session deleted');
    } catch (error) {
      logger.error('Failed to delete session:', { error: error.message });
      throw error;
    }
  }

  static async updateLastSeen(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET last_seen = CURRENT_TIMESTAMP,
            is_online = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    } catch (error) {
      logger.error('Failed to update last seen:', { error: error.message });
    }
  }

  static async setUserOffline(userId) {
    try {
      if (!sql) throw new Error('Database connection not available');

      await sql`
        UPDATE users 
        SET is_online = FALSE,
            last_seen = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `;
    } catch (error) {
      logger.error('Failed to set user offline:', { error: error.message });
    }
  }
}

module.exports = AuthService;
