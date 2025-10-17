// file name: app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// استيراد الخدمات والروتس
const emailService = require('./src/services/emailService');
const emailRoutes = require('./src/routes/emailRoutes');
const messageRoutes = require('./src/routes/messageRoutes');

const app = express();

// تهيئة خدمة البريد عند بدء التشغيل
console.log('🚀 بدء تهيئة نظام HackMail Pro...');
emailService.initialize().then(success => {
    if (success) {
        console.log('✅ خدمة البريد الذكية جاهزة للتشغيل');
        console.log('📧 الخدمات المتاحة:', emailService.getServiceStatus().availableServices);
    } else {
        console.log('❌ فشل في تهيئة خدمة البريد، سيتم استخدام الوضع الافتراضي');
    }
});

// إعدادات CORS مرنة للتطوير والإنتاج
app.use(cors({
    origin: function (origin, callback) {
        // السماح لجميع الأصول في بيئة التطوير
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'http://localhost:3002',
            'http://127.0.0.1:3002',
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            /\.repl\.co$/,
            /\.repl\.it$/,
            /\.replit\.com$/
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
            console.log('⚠️ طلب CORS مرفوض من:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Middleware للأمان
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 1000, // حد 1000 طلب لكل IP
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// خدمة الملفات الثابتة
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/email', emailRoutes);
app.use('/api/messages', messageRoutes);

// ==================== نقاط النهاية الأساسية ====================

// نقطة فحص الصحة
app.get('/health', (req, res) => {
    const serviceStatus = emailService.getServiceStatus();
    
    res.status(200).json({ 
        success: true,
        status: 'OK', 
        message: '🚀 نظام HackMail Pro يعمل بشكل طبيعي',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        services: {
            email: serviceStatus.status,
            currentService: serviceStatus.currentService,
            availableServices: serviceStatus.availableServices
        },
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// نقطة اختبار الاتصال
app.get('/api/test', (req, res) => {
    const serviceStatus = emailService.getServiceStatus();
    
    res.json({ 
        success: true, 
        message: '✅ الاتصال ناجح مع خادم HackMail Pro',
        timestamp: new Date().toISOString(),
        platform: 'HackMail Pro v3.0 - نظام الإيميل المؤقت الذكي',
        system: {
            version: '3.0.0',
            status: 'operational',
            currentService: serviceStatus.currentService,
            availableServices: serviceStatus.availableServices,
            domainsCount: serviceStatus.domains
        },
        endpoints: {
            createEmail: 'POST /api/email/create',
            getEmails: 'GET /api/email/session/:sessionId',
            getMessages: 'GET /api/email/messages',
            getMessage: 'GET /api/email/messages/:id',
            servicesStatus: 'GET /api/email/services/status',
            rotateService: 'POST /api/email/services/rotate',
            health: 'GET /health'
        }
    });
});

// نقطة حالة النظام المتقدمة
app.get('/api/status', (req, res) => {
    const serviceStatus = emailService.getServiceStatus();
    const sessionAccounts = emailService.sessionAccounts ? emailService.sessionAccounts.size : 0;
    
    res.json({
        success: true,
        system: 'HackMail Pro - الإصدار النهائي',
        version: '3.0.0',
        status: 'operational',
        performance: 'excellent',
        services: {
            mailtm: serviceStatus.availableServices.includes('mailtm') ? 'active' : 'inactive',
            guerrillamail: serviceStatus.availableServices.includes('guerrillamail') ? 'active' : 'inactive',
            'temp-mail': serviceStatus.availableServices.includes('temp-mail') ? 'active' : 'inactive',
            current: serviceStatus.currentService
        },
        statistics: {
            activeSessions: sessionAccounts,
            availableDomains: serviceStatus.domains,
            uptime: process.uptime(),
            memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
        },
        features: [
            'تبديل تلقائي بين خدمات البريد',
            'استبدال تلقائي للحسابات المنتهية',
            'دعم متعدد للخدمات',
            'واجهة برمجة تطبيقات متكاملة',
            'معالجة أخطاء محسنة'
        ]
    });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    const serviceStatus = emailService.getServiceStatus();
    
    res.json({
        success: true,
        message: '🚀 مرحباً بك في نظام HackMail Pro v3.0',
        version: '3.0.0',
        description: 'نظام الإيميل المؤقت الذكي والمضمون - الإصدار النهائي',
        features: [
            '🎯 إنشاء إيميلات مؤقتة فورية',
            '🔄 تبديل تلقائي بين خدمات البريد',
            '📨 استقبال رسائل التفعيل من جميع المنصات',
            '⚡ أداء عالي وموثوقية ممتازة',
            '🔒 نظام أمان متكامل',
            '🌐 دعم متصفحات متعددة'
        ],
        currentStatus: {
            service: serviceStatus.currentService,
            availableServices: serviceStatus.availableServices,
            domains: serviceStatus.domains,
            status: serviceStatus.status
        },
        quickStart: {
            'إنشاء إيميل جديد': 'POST /api/email/create',
            'جلب الرسائل': 'GET /api/email/messages?accountId=...&email=...&service=...',
            'حالة الخدمات': 'GET /api/email/services/status',
            'فحص الصحة': 'GET /health'
        },
        documentation: 'قم بزيارة /api/test للحصول على قائمة كاملة بنقاط الوصول'
    });
});

// ==================== نقاط نهاية إضافية للمساعدة ====================

// نقطة لإنشاء إيميل سريع (للتجربة)
app.post('/api/quick-email', async (req, res) => {
    try {
        const sessionId = req.body.sessionId || 'quick_' + Date.now();
        
        console.log('🎯 طلب إنشاء إيميل سريع...');
        const accountResult = await emailService.createAccount(sessionId);
        
        if (accountResult.success) {
            res.json({
                success: true,
                email: accountResult.email,
                password: accountResult.password,
                service: accountResult.service,
                sessionId: sessionId,
                message: 'تم إنشاء الإيميل بنجاح! يمكنك استخدامه فوراً للتسجيل في المنصات.'
            });
        } else {
            throw new Error('فشل في إنشاء الإيميل');
        }
    } catch (error) {
        console.error('❌ خطأ في إنشاء الإيميل السريع:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'جاري المحاولة مع خدمة بديلة...'
        });
    }
});

// نقطة لجلب معلومات الخدمة الحالية
app.get('/api/current-service', (req, res) => {
    const status = emailService.getServiceStatus();
    
    res.json({
        success: true,
        currentService: status.currentService,
        availableServices: status.availableServices,
        domainsCount: status.domains,
        recommendation: 'mailtm', // نوصي بـ mailtm كخدمة أساسية
        message: `الخدمة الحالية: ${status.currentService}`
    });
});

// نقطة لإعادة تعيين الخدمات
app.post('/api/reset-services', async (req, res) => {
    try {
        console.log('🔄 طلب إعادة تعيين الخدمات...');
        await emailService.initialize();
        
        const status = emailService.getServiceStatus();
        res.json({
            success: true,
            message: 'تم إعادة تعيين جميع الخدمات بنجاح',
            services: status.availableServices,
            currentService: status.currentService
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في إعادة تعيين الخدمات: ' + error.message
        });
    }
});

// ==================== معالجة الأخطاء ====================

// معالج للأخطاء العامة
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
            ],
            solution: 'يمكنك تجربة الطلب من المتصفح مباشرة أو استخدام أحد النطاقات المسموحة'
        });
    }

    res.status(500).json({ 
        success: false,
        error: 'حدث خطأ داخلي في الخادم',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        timestamp: new Date().toISOString()
    });
});

// معالج للطلبات غير الموجودة (404)
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'نقطة الوصول غير موجودة',
        path: req.originalUrl,
        availableEndpoints: {
            email: {
                'POST /api/email/create': 'إنشاء إيميل جديد',
                'GET /api/email/session/:sessionId': 'جلب إيميلات الجلسة',
                'GET /api/email/messages': 'جلب الرسائل',
                'GET /api/email/messages/:id': 'جلب رسالة محددة',
                'GET /api/email/services/status': 'حالة الخدمات',
                'POST /api/email/services/rotate': 'تبديل الخدمة'
            },
            quick: {
                'POST /api/quick-email': 'إنشاء إيميل سريع',
                'GET /api/current-service': 'الخدمة الحالية',
                'POST /api/reset-services': 'إعادة تعيين الخدمات'
            },
            system: {
                'GET /health': 'فحص حالة النظام',
                'GET /api/test': 'اختبار الاتصال',
                'GET /api/status': 'حالة النظام المتقدمة',
                'GET /': 'الصفحة الرئيسية'
            }
        },
        tip: 'استخدم GET /api/test للحصول على دليل كامل'
    });
});

// معالج 404 عام
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'الصفحة غير موجودة',
        message: 'مرحباً بك في نظام HackMail Pro! استخدم / للصفحة الرئيسية',
        path: req.originalUrl,
        quickLinks: {
            home: '/',
            health: '/health',
            apiTest: '/api/test',
            documentation: 'استخدم /api/test للحصول على دليل API كامل'
        }
    });
});

// ==================== إعدادات الخادم ====================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// بدء الخادم
const server = app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 HackMail Pro v3.0 - نظام الإيميل المؤقت الذكي');
    console.log('='.repeat(60));
    console.log(`📍 الخادم يعمل على: http://${HOST}:${PORT}`);
    console.log(`🌐 الواجهة الأمامية: http://${HOST}:${PORT}/index.html`);
    console.log(`🔗 الـ API: http://${HOST}:${PORT}/api/test`);
    console.log(`❤️  فحص الصحة: http://${HOST}:${PORT}/health`);
    console.log('='.repeat(60));
    console.log('📧 جاهز لاستقبال طلبات إنشاء الإيميلات...');
    console.log('='.repeat(60) + '\n');
});

// معالجة إغلاق الخادم بشكل أنيق
process.on('SIGTERM', () => {
    console.log('🔄 استقبال إشارة إغلاق، جاري إيقاف الخادم بشكل أنيق...');
    server.close(() => {
        console.log('✅ تم إغلاق الخادم بنجاح');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('💥 خطأ غير معالج:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 رفض وعد غير معالج:', reason);
    process.exit(1);
});

module.exports = app;
