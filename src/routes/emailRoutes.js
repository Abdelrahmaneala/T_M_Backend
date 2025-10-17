// file name: emailRoutes.js
// استبدل محتوى الملف بالكود التالي:

const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');

// POST /api/email/create - إنشاء إيميل جديد
router.post('/create', emailController.createEmail.bind(emailController));

// GET /api/email/session/:sessionId - جلب إيميلات الجلسة
router.get('/session/:sessionId', emailController.getEmails.bind(emailController));

// GET /api/email/messages - جلب الرسائل
router.get('/messages', emailController.getMessages.bind(emailController));

// GET /api/email/messages/:id - جلب رسالة محددة
router.get('/messages/:id', emailController.getMessage.bind(emailController));

// GET /api/email/services/status - حالة الخدمات
router.get('/services/status', emailController.checkServiceStatus.bind(emailController));

// POST /api/email/services/rotate - تبديل الخدمة
router.post('/services/rotate', emailController.rotateService.bind(emailController));

module.exports = router;
