const express = require('express');
const router = express.Router();
const UsersController = require('../controllers/users');
const { authenticate } = require('../middleware/auth');

router.get('/search', authenticate, UsersController.searchUsers);
router.get('/blocked', authenticate, UsersController.getBlockedUsers);
router.post('/block', authenticate, UsersController.blockUser);
router.delete('/block/:userId', authenticate, UsersController.unblockUser);
router.get('/notifications', authenticate, UsersController.getNotifications);
router.put('/notifications/:notificationId/read', authenticate, UsersController.markNotificationAsRead);
router.put('/notifications/read-all', authenticate, UsersController.markAllNotificationsAsRead);
router.get('/privacy', authenticate, UsersController.getPrivacySettings);
router.put('/privacy', authenticate, UsersController.updatePrivacySettings);
router.get('/export-data', authenticate, UsersController.exportUserData);

module.exports = router;
