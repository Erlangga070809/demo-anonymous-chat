const { body, validationResult } = require('express-validator');

const validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email too long'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
];

const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Invalid email address')
    .normalizeEmail()
];

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Token is required'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  body('passwordConfirm')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
];

const validateReport = [
  body('reportType')
    .isIn(['user', 'message', 'image', 'voice'])
    .withMessage('Invalid report type'),
  
  body('reportedUserId')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID'),
  
  body('messageId')
    .optional()
    .isUUID()
    .withMessage('Invalid message ID'),
  
  body('reportCategory')
    .isIn(['spam', 'harassment', 'inappropriate', 'other'])
    .withMessage('Invalid report category'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description too long')
];

const validateMessage = [
  body('conversationId')
    .isUUID()
    .withMessage('Invalid conversation ID'),
  
  body('content')
    .optional()
    .isLength({ max: 5000 })
    .withMessage('Message too long'),
  
  body('messageType')
    .isIn(['text', 'image', 'voice'])
    .withMessage('Invalid message type'),
  
  body('replyToMessageId')
    .optional()
    .isUUID()
    .withMessage('Invalid reply message ID')
];

const validateSettings = [
  body('language')
    .optional()
    .isIn(['id', 'en'])
    .withMessage('Invalid language'),
  
  body('notifications')
    .optional()
    .isBoolean()
    .withMessage('Invalid notification setting'),
  
  body('sound')
    .optional()
    .isBoolean()
    .withMessage('Invalid sound setting'),
  
  body('theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Invalid theme')
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidFileType = (mimeType, type) => {
  if (type === 'image') {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
  }
  if (type === 'voice') {
    return ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'].includes(mimeType);
  }
  return false;
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateReport,
  validateMessage,
  validateSettings,
  handleValidation,
  sanitizeInput,
  isValidEmail,
  isValidUUID,
  isValidFileType
};
