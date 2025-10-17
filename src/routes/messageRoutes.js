const express = require('express');
const router = express.Router();

// Routes للرسائل يمكن إضافتها هنا إذا كانت منفصلة
// حالياً كل routes البريد موجودة في emailRoutes

router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Message routes are working',
        availableEndpoints: [
            'GET /api/messages - جلب الرسائل',
            'GET /api/messages/:id - جلب رسالة محددة'
        ]
    });
});

module.exports = router;