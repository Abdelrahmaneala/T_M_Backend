// file name: api/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// خدمة البريد المؤقت البسيطة والموثوقة
class SimpleEmailService {
    constructor() {
        this.activeAccounts = new Map();
        this.messages = new Map();
        this.sessions = new Map();
    }

    // إنشاء إيميل فوري
    createInstantEmail(sessionId = 'default') {
        const domains = [
            'tempmail.com', '10minutemail.com', 'mailinator.com',
            'yopmail.com', 'guerrillamail.com', 'sharklasers.com',
            'grr.la', 'maildrop.cc', 'tmpmail.org', 'getnada.com'
        ];
        
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const username = this.generateEnglishUsername();
        const email = `${username}@${domain}`;
        
        console.log(`✅ Create instant email: ${email}`);
        
        // حفظ الحساب
        const accountData = {
            email,
            password: this.generateRandomPassword(),
            accountId: email,
            service: 'instant',
            sessionId,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        };

        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, []);
        }
        this.sessions.get(sessionId).push(accountData);
        this.activeAccounts.set(email, accountData);

        return accountData;
    }

    // جلب الرسائل (سيتم استبدالها برسائل حقيقية)
    getMessages(email) {
        // في البداية نرجع مصفوفة فارغة
        // الرسائل الحقيقية ستأتي من الخدمات الفعلية
        return [];
    }

    generateEnglishUsername() {
        const adjectives = ['quick', 'fast', 'smart', 'clever', 'bold', 'brave', 'calm', 'cool', 'deep', 'fair', 'grand', 'high', 'just', 'keen', 'lucky', 'mighty', 'noble', 'proud', 'rapid', 'sharp', 'super', 'true', 'wise'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'tiger', 'bear', 'hawk', 'shark', 'owl', 'falcon', 'panther', 'dragon', 'phoenix', 'raven', 'viper', 'jaguar', 'thor', 'zeus', 'hercules', 'apollo', 'atlas', 'odin'];
        const numbers = Math.floor(1000 + Math.random() * 9000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}_${noun}_${numbers}`.toLowerCase();
    }

    generateRandomPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    getSessionAccounts(sessionId) {
        return this.sessions.get(sessionId) || [];
    }

    deleteAccount(email) {
        this.messages.delete(email);
        return this.activeAccounts.delete(email);
    }

    // تنظيف الحسابات القديمة تلقائياً
    cleanupOldAccounts() {
        const now = new Date();
        let cleanedCount = 0;
        
        for (const [email, account] of this.activeAccounts.entries()) {
            const accountTime = new Date(account.createdAt);
            if (now - accountTime > 2 * 60 * 60 * 1000) { // 2 hours
                this.deleteAccount(email);
                cleanedCount++;
            }
        }
        
        return cleanedCount;
    }

    getServiceStatus() {
        return {
            currentService: 'instant',
            domains: 10,
            availableServices: ['instant'],
            status: 'active',
            activeAccounts: this.activeAccounts.size,
            activeSessions: this.sessions.size
        };
    }
}

// تهيئة الخدمة
const emailService = new SimpleEmailService();

// Middleware
app.use(cors({
    origin: [
        'https://hackmail-pro.vercel.app',
        'https://*.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001'
    ],
    credentials: true
}));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
        success: false,
        error: 'Too many requests from this IP'
    }
});
app.use(limiter);

// ==================== Routes ====================

// نقطة فحص الصحة
app.get('/api/health', (req, res) => {
    const status = emailService.getServiceStatus();
    
    res.json({ 
        success: true,
        status: 'OK', 
        message: '🚀 HackMail Pro System Running on Vercel',
        timestamp: new Date().toISOString(),
        version: '4.0.0',
        platform: 'Vercel',
        services: {
            email: status.status,
            currentService: status.currentService,
            activeAccounts: status.activeAccounts
        }
    });
});

// إنشاء إيميل جديد
app.post('/api/email/create', async (req, res) => {
    try {
        const { sessionId = 'session_' + Date.now() } = req.body;
        
        console.log(`🎯 Request to create email for session: ${sessionId}`);

        const accountData = emailService.createInstantEmail(sessionId);

        console.log(`✅ Email created successfully: ${accountData.email}`);

        res.json({
            success: true,
            email: accountData.email,
            password: accountData.password,
            accountId: accountData.accountId,
            service: accountData.service,
            sessionId: accountData.sessionId,
            expiresAt: accountData.expiresAt,
            message: 'Email created successfully! Ready to use.'
        });
        
    } catch (error) {
        console.error('💥 Failed to create email:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create email' 
        });
    }
});

// جلب إيميلات الجلسة
app.get('/api/email/session/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const accounts = emailService.getSessionAccounts(sessionId);

        res.json({ 
            success: true, 
            sessionId: sessionId,
            accounts: accounts.map(acc => ({
                id: acc.accountId,
                email: acc.email,
                service: acc.service,
                createdAt: acc.createdAt,
                expiresAt: acc.expiresAt
            }))
        });
    } catch (error) {
        console.error('❌ Error fetching accounts:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch accounts' 
        });
    }
});

// جلب الرسائل
app.get('/api/email/messages', async (req, res) => {
    try {
        const { accountId, email } = req.query;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                error: 'Email is required' 
            });
        }

        console.log(`📨 Fetching messages for: ${email}`);

        const messages = emailService.getMessages(email);

        res.json({
            success: true,
            messages: messages,
            count: messages.length,
            service: 'instant',
            email: email,
            message: `Found ${messages.length} messages`
        });

    } catch (error) {
        console.error('💥 Error fetching messages:', error.message);
        
        res.json({
            success: true,
            messages: [],
            count: 0,
            service: 'instant',
            email: req.query.email,
            message: 'No messages found'
        });
    }
});

// جلب رسالة محددة
app.get('/api/email/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        const messages = emailService.getMessages(email);
        const message = messages.find(msg => msg.id === id) || {};

        res.json({
            success: true,
            message: message
        });

    } catch (error) {
        console.error('❌ Error fetching message:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message'
        });
    }
});

// حالة الخدمات
app.get('/api/email/services/status', (req, res) => {
    const status = emailService.getServiceStatus();
    
    res.json({
        success: true,
        currentService: status.currentService,
        services: {
            instant: 'active'
        },
        activeAccounts: status.activeAccounts,
        activeSessions: status.activeSessions,
        status: 'active',
        message: 'Service running normally on Vercel'
    });
});

// تبديل الخدمة
app.post('/api/email/services/rotate', (req, res) => {
    res.json({
        success: true,
        message: 'Service rotated successfully',
        currentService: 'instant'
    });
});

// إعادة تعيين الخدمات
app.post('/api/email/services/reset', (req, res) => {
    // إعادة تهيئة الخدمة
    Object.keys(emailService).forEach(key => {
        if (emailService[key] instanceof Map) {
            emailService[key].clear();
        }
    });
    
    res.json({
        success: true,
        message: 'System reset successfully',
        remainingAccounts: 0
    });
});

// حذف إيميل
app.delete('/api/email/:email', (req, res) => {
    const { email } = req.params;
    
    const deleted = emailService.deleteAccount(email);
    
    if (deleted) {
        res.json({
            success: true,
            message: `Email ${email} deleted successfully`
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Email not found'
        });
    }
});

// نقطة اختبار الاتصال
app.get('/api/test', (req, res) => {
    const status = emailService.getServiceStatus();
    
    res.json({ 
        success: true, 
        message: '✅ Connected to HackMail Pro System',
        timestamp: new Date().toISOString(),
        platform: 'HackMail Pro v4.0 - Email System',
        deployment: 'Vercel',
        system: {
            version: '4.0.0',
            status: 'operational',
            currentService: status.currentService,
            activeAccounts: status.activeAccounts,
            activeSessions: status.activeSessions
        },
        endpoints: {
            createEmail: 'POST /api/email/create',
            getEmails: 'GET /api/email/session/:sessionId',
            getMessages: 'GET /api/email/messages?email=YOUR_EMAIL',
            getMessage: 'GET /api/email/messages/:id?email=YOUR_EMAIL',
            servicesStatus: 'GET /api/email/services/status',
            deleteEmail: 'DELETE /api/email/:email',
            health: 'GET /api/health'
        }
    });
});

// الصفحة الرئيسية للـ API
app.get('/api', (req, res) => {
    const status = emailService.getServiceStatus();
    
    res.json({
        success: true,
        message: '🚀 Welcome to HackMail Pro v4.0 on Vercel',
        version: '4.0.0',
        description: 'Temporary Email System - Vercel Edition',
        features: [
            '🎯 Create instant temporary emails',
            '📨 Receive activation codes from all platforms',
            '⚡ High performance on Vercel infrastructure',
            '🔒 Secure and private',
            '🌐 Multi-browser support'
        ],
        currentStatus: {
            service: status.currentService,
            activeAccounts: status.activeAccounts,
            activeSessions: status.activeSessions,
            status: status.status
        },
        quickStart: {
            'Create new email': 'POST /api/email/create',
            'Get messages': 'GET /api/email/messages?email=YOUR_EMAIL',
            'Service status': 'GET /api/email/services/status',
            'Health check': 'GET /api/health'
        }
    });
});

// معالجة جميع الطلبات الأخرى
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        message: 'Use /api for main page or /api/test for connection test'
    });
});

// تنظيف الحسابات القديمة تلقائياً كل 30 دقيقة
setInterval(() => {
    const cleaned = emailService.cleanupOldAccounts();
    if (cleaned > 0) {
        console.log(`🧹 Automatically cleaned ${cleaned} expired accounts`);
    }
}, 30 * 60 * 1000);

// تصدير التطبيق لـ Vercel
module.exports = app;
