const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chat');
const { authenticate } = require('../middleware/auth');
const { messageLimiter, matchLimiter } = require('../middleware/rateLimit');
const { validateMessage, handleValidation } = require('../utils/validation');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.get('/messages/:conversationId', authenticate, ChatController.getMessages);
router.post('/messages', authenticate, messageLimiter, validateMessage, handleValidation, ChatController.sendMessage);
router.put('/messages/:conversationId/read', authenticate, ChatController.markAsRead);
router.delete('/messages/:messageId', authenticate, ChatController.deleteMessage);
router.post('/messages/:messageId/reactions', authenticate, ChatController.addReaction);
router.delete('/messages/:messageId/reactions', authenticate, ChatController.removeReaction);
router.get('/messages/:messageId/reactions', authenticate, ChatController.getReactions);

router.post('/matching/start', authenticate, matchLimiter, ChatController.startMatching);
router.post('/matching/cancel', authenticate, ChatController.cancelMatching);
router.post('/conversations/:matchId/end', authenticate, ChatController.endConversation);

router.post('/upload', authenticate, upload.single('file'), ChatController.uploadMedia);

module.exports = router;
