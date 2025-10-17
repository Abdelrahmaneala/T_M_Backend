const express = require('express');
const router = express.Router();

// POST /api/email/create - إنشاء إيميل جديد
router.post('/create', (req, res) => {
    try {
        // كود مؤقت للاختبار - بعدين حنضيف الكود الحقيقي
        res.json({
            success: true,
            message: 'تم إنشاء الإيميل بنجاح',
            email: 'test@example.com',
            sessionId: 'session_' + Date.now(),
            data: {
                email: 'test@example.com',
                password: 'temp_password',
                service: 'mailtm'
            }
        });
    } catch (error) {
        console.error('❌ خطأ في إنشاء الإيميل:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في إنشاء الإيميل',
            message: error.message
        });
    }
});

// GET /api/email/session/:sessionId - جلب إيميلات الجلسة
router.get('/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    res.json({
        success: true,
        sessionId,
        emails: [
            {
                id: 1,
                email: 'test1@example.com',
                service: 'mailtm',
                createdAt: new Date().toISOString()
            }
        ]
    });
});

// GET /api/email/messages - جلب الرسائل
router.get('/messages', (req, res) => {
    res.json({
        success: true,
        messages: [
            {
                id: 'msg_1',
                from: 'sender@example.com',
                subject: 'رسالة تجريبية',
                preview: 'هذه رسالة تجريبية...',
                receivedAt: new Date().toISOString()
            }
        ]
    });
});

// GET /api/email/services/status - حالة الخدمات
router.get('/services/status', (req, res) => {
    res.json({
        success: true,
        services: {
            mailtm: {
                status: 'active',
                domains: ['example.com'],
                available: true
            },
            guerrillamail: {
                status: 'active', 
                domains: ['guerrillamail.com'],
                available: true
            },
            tempMail: {
                status: 'inactive',
                domains: [],
                available: false
            }
        },
        timestamp: new Date().toISOString()
    });
});

// GET /api/email/services/available - الخدمات المتاحة
router.get('/services/available', (req, res) => {
    res.json({
        success: true,
        services: [
            {
                name: 'mailtm',
                status: 'active',
                domains: 1,
                api: 'https://api.mail.tm'
            },
            {
                name: 'guerrillamail',
                status: 'active',
                domains: 5,
                api: 'https://api.guerrillamail.com'
            }
        ]
    });
});

// POST /api/email/services/rotate - تبديل الخدمة
router.post('/services/rotate', (req, res) => {
    res.json({
        success: true,
        message: 'تم تبديل الخدمة بنجاح',
        currentService: 'guerrillamail',
        previousService: 'mailtm'
    });
});

// POST /api/email/services/reset - إعادة تعيين الخدمات
router.post('/services/reset', (req, res) => {
    res.json({
        success: true,
        message: 'تم إعادة تعيين جميع الخدمات',
        resetServices: ['mailtm', 'guerrillamail']
    });
});

// POST /api/email/auto-replace - استبدال تلقائي للحساب المنتهي
router.post('/auto-replace', (req, res) => {
    res.json({
        success: true,
        message: 'تم الاستبدال التلقائي بنجاح',
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
        service: 'mailtm'
    });
});

// DELETE /api/email/:email - حذف إيميل
router.delete('/:email', (req, res) => {
    const { email } = req.params;
    res.json({
        success: true,
        message: `تم حذف الإيميل ${email} بنجاح`,
        deletedEmail: email
    });
});

// GET /api/email/messages/:id - جلب رسالة محددة
router.get('/messages/:id', (req, res) => {
    const { id } = req.params;
    res.json({
        success: true,
        message: {
            id: id,
            from: 'sender@example.com',
            to: 'test@example.com',
            subject: 'رسالة تجريبية',
            body: 'هذا محتوى الرسالة التجريبية...',
            html: '<p>هذا محتوى الرسالة التجريبية...</p>',
            receivedAt: new Date().toISOString(),
            attachments: []
        }
    });
});

module.exports = router;