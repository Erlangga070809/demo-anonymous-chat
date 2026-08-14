const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateSettings,
  handleValidation
} = require('../utils/validation');

router.post('/register', authLimiter, validateRegistration, handleValidation, AuthController.register);
router.post('/login', authLimiter, validateLogin, handleValidation, AuthController.login);
router.post('/logout', authenticate, AuthController.logout);
router.post('/forgot-password', authLimiter, validateForgotPassword, handleValidation, AuthController.forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, handleValidation, AuthController.resetPassword);
router.get('/verify-email/:token', AuthController.verifyEmail);
router.get('/me', authenticate, AuthController.getCurrentUser);
router.put('/settings', authenticate, validateSettings, handleValidation, AuthController.updateSettings);
router.delete('/account', authenticate, AuthController.deleteAccount);

module.exports = router;
