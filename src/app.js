const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const emailRoutes = require('./routes/emailRoutes');
const messageRoutes = require('./routes/messageRoutes');
const config = require('../config');

const app = express();

// إصلاح مشكلة X-Forwarded-For في Replit
app.set('trust proxy', 1);

// CORS أكثر مرونة للتطوير
app.use(cors({
    origin: function (origin, callback) {
        // السماح لجميع الأصول أثناء التطوير على Replit
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            /\.repl\.co$/, // السماح لجميع نطاقات Replit
            /\.repl\.it$/, // السماح لجميع نطاقات Replit القديمة
            /\.replit\.com$/ // السماح لنطاقات Replit الجديدة
        ];

        // السماح لجميع الأصول في بيئة التطوير أو Replit
        if (!origin || process.env.NODE_ENV === 'development' || process.env.REPLIT_DB_URL) {
            callback(null, true);
        } else if (allowedOrigins.some(allowed => {
            if (typeof allowed === 'string') {
                return allowed === origin;
            } else if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return false;
        })) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware للأمان
app.use(helmet({
    contentSecurityPolicy: false, // تعطيل مؤقتاً للتطوير
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        error: 'Too many requests from this IP'
    }
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/email', emailRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'الخادم يعمل بشكل طبيعي',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
            email: 'active',
            database: 'active'
        },
        environment: process.env.NODE_ENV || 'development',
        platform: 'Replit'
    });
});

// Test endpoint للتأكد من الاتصال
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'الاتصال ناجح مع الخادم',
        timestamp: new Date().toISOString(),
        platform: 'HackMail Backend on Replit',
        endpoints: {
            createEmail: '/api/email/create',
            getEmails: '/api/email/session/:sessionId',
            getMessages: '/api/email/messages',
            services: '/api/email/services/status',
            health: '/health'
        }
    });
});

// Route للصفحة الرئيسية المعدلة لتعمل على Replit
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 نظام الإيميل المؤقت الذكي يعمل بنجاح على Replit',
        version: '1.0.0',
        description: 'نظام إيميل مؤقت بتصميم الهاكينج مع تبديل تلقائي بين الخدمات',
        features: [
            'تبديل تلقائي بين خدمات البريد',
            'استبدال تلقائي للحسابات المنتهية',
            'دعم متعدد للخدمات (Mail.tm + GuerrillaMail)',
            'نظام مرن ومعالجة أخطاء محسنة',
            'واجهة برمجة تطبيقات (API) متكاملة'
        ],
        endpoints: {
            api: {
                'GET /api/test': 'اختبار الاتصال مع الخادم',
                'POST /api/email/create': 'إنشاء إيميل مؤقت جديد',
                'GET /api/email/session/:sessionId': 'جلب إيميلات الجلسة',
                'GET /api/email/messages': 'جلب الرسائل الواردة',
                'GET /api/email/services/status': 'حالة خدمات البريد'
            },
            system: {
                'GET /health': 'فحص حالة النظام',
                'GET /': 'الصفحة الرئيسية (هذه الصفحة)'
            }
        },
        documentation: 'استخدم /health للتحقق من حالة النظام أو /api/test لاختبار الاتصال'
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('❌ خطأ في الخادم:', err);

    // إذا كان خطأ CORS
    if (err.message.includes('CORS')) {
        return res.status(403).json({ 
            success: false,
            error: 'طلب مرفوض بسبب سياسة CORS',
            message: 'يرجى استخدام نطاق مسموح به',
            allowedOrigins: [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                'جميع نطاقات Replit'
            ]
        });
    }

    res.status(500).json({ 
        success: false,
        error: 'حدث خطأ داخلي في الخادم',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler للـ API
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'الصفحة غير موجودة',
        path: req.originalUrl,
        availableEndpoints: {
            email: {
                'POST /api/email/create': 'إنشاء إيميل جديد',
                'GET /api/email/session/:sessionId': 'جلب إيميلات الجلسة',
                'DELETE /api/email/:email': 'حذف إيميل',
                'GET /api/email/messages': 'جلب الرسائل',
                'GET /api/email/messages/:id': 'جلب رسالة محددة',
                'GET /api/email/services/status': 'حالة الخدمات',
                'GET /api/email/services/available': 'الخدمات المتاحة',
                'POST /api/email/services/rotate': 'تبديل الخدمة',
                'POST /api/email/services/reset': 'إعادة تعيين الخدمات',
                'POST /api/email/auto-replace': 'استبدال تلقائي للحساب المنتهي'
            },
            system: {
                'GET /health': 'حالة الخادم',
                'GET /api/test': 'اختبار الاتصال',
                'GET /': 'الصفحة الرئيسية'
            }
        }
    });
});

// 404 handler عام
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'الصفحة غير موجودة',
        message: 'استخدم / للصفحة الرئيسية أو /health للتحقق من حالة النظام',
        path: req.originalUrl
    });
});

module.exports = app;