const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/admin');
const { authenticate } = require('../middleware/auth');
const { checkRole, checkPermission, validateAdminAction } = require('../middleware/admin');

router.use(authenticate);
router.use(checkRole('owner', 'admin', 'moderator'));

router.get('/dashboard/stats', AdminController.getDashboardStats);

router.get('/users', checkPermission('view_users'), AdminController.getUsers);
router.get('/users/:userId', checkPermission('view_users'), AdminController.getUserDetails);
router.post('/users/:userId/suspend', checkPermission('suspend_user'), validateAdminAction('suspend_user'), AdminController.suspendUser);
router.post('/users/:userId/ban', checkPermission('ban_user'), validateAdminAction('ban_user'), AdminController.banUser);
router.post('/users/:userId/unban', checkPermission('unban_user'), validateAdminAction('unban_user'), AdminController.unbanUser);
router.post('/users/:userId/warn', checkPermission('add_warning'), validateAdminAction('add_warning'), AdminController.addWarning);

router.get('/reports', checkPermission('view_reports'), AdminController.getReports);
router.post('/reports/:reportId/process', checkPermission('process_report'), validateAdminAction('process_report'), AdminController.processReport);

router.get('/conversations', checkPermission('view_conversations'), AdminController.getActiveConversations);
router.get('/moderation-logs', checkPermission('view_moderation_history'), AdminController.getModerationLogs);
router.get('/activity-logs', checkPermission('view_activity_logs'), AdminController.getActivityLogs);
router.post('/appeals/:banId/review', checkPermission('review_appeals'), AdminController.reviewAppeal);

module.exports = router;
