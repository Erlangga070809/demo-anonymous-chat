const express = require('express');
const router = express.Router();
const ReportsController = require('../controllers/reports');
const { authenticate } = require('../middleware/auth');
const { reportLimiter } = require('../middleware/rateLimit');
const { validateReport, handleValidation } = require('../utils/validation');

router.post('/', authenticate, reportLimiter, validateReport, handleValidation, ReportsController.createReport);
router.get('/my-reports', authenticate, ReportsController.getUserReports);
router.post('/appeal', authenticate, ReportsController.submitAppeal);

module.exports = router;
