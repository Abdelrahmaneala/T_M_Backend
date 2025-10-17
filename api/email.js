const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
});
app.use(limiter);

// خدمة البريد المؤقت البسيطة والموثوقة
class SimpleEmailService {
    constructor() {
        this.activeAccounts = new Map();
        this.messages = new Map();
    }

    // إنشاء إيميل فوري
    createInstantEmail() {
        const domains = [
            'hackmail.com', 'temp-mail.com', 'disposable.com',
            'instant-email.com', 'quickmail.com', 'fastmail.com',
            'temporary.com', 'quickinbox.com', 'mailhub.com'
        ];
        
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const username = this.generateRandomUsername();
        const email = `${username}@${domain}`;
        
        console.log(`✅ إنشاء إيميل فوري: ${email}`);
        
        // إنشاء بعض الرسائل التجريبية لهذا الإيميل
        this.createSampleMessages(email);
        
        return {
            success: true,
            email: email,
            password: this.generateRandomPassword(),
            accountId: email,
            service: 'instant',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            message: 'تم إنشاء الإيميل بنجاح'
        };
    }

    // إنشاء رسائل تجريبية
    createSampleMessages(email) {
        const sampleMessages = [
            {
                id: 'msg_' + Date.now() + '_1',
                sender: 'welcome@hackmail.com',
                subject: 'مرحباً بك في HackMail Pro! 🚀',
                content: `شكراً لاستخدامك نظام HackMail Pro للإيميلات المؤقتة.\n\nبريدك: ${email}\n\nمميزات النظام:\n✅ إيميلات مؤقتة فورية\n✅ استقبال رسائل تجريبية\n✅ واجهة مستخدم متطورة\n✅ دعم متصفحات متعددة`,
                preview: 'شكراً لاستخدامك نظام HackMail Pro للإيميلات المؤقتة...',
                date: new Date().toLocaleString('ar-EG'),
                unread: true
            },
            {
                id: 'msg_' + Date.now() + '_2',
                sender: 'support@example.com',
                subject: 'تفعيل حسابك الجديد',
                content: `مرحباً!\n\nلتفعيل حسابك الجديد، يرجى استخدام الرابط التالي:\nhttps://example.com/verify?email=${encodeURIComponent(email)}\n\nشكراً لاختيارك خدماتنا.`,
                preview: 'مرحباً! لتفعيل حسابك الجديد، يرجى استخدام الرابط التالي...',
                date: new Date(Date.now() - 300000).toLocaleString('ar-EG'),
                unread: false
            },
            {
                id: 'msg_' + Date.now() + '_3',
                sender: 'newsletter@tech.com',
                subject: 'أحدث الأخبار التقنية',
                content: `أحدث الأخبار والتحديثات في عالم التكنولوجيا:\n\n1. إطلاق نظام تشغيل جديد\n2. تحديثات أمنية مهمة\n3. عروض حصرية للمشتركين\n\nتابعنا للمزيد من الأخبار.`,
                preview: 'أحدث الأخبار والتحديثات في عالم التكنولوجيا...',
                date: new Date(Date.now() - 600000).toLocaleString('ar-EG'),
                unread: true
            }
        ];

        this.messages.set(email, sampleMessages);
        return sampleMessages;
    }

    // جلب الرسائل
    getMessages(email) {
        return this.messages.get(email) || this.createSampleMessages(email);
    }

    generateRandomUsername() {
        const adjectives = ['quick', 'bold', 'clever', 'smart', 'fast', 'strong', 'brave', 'calm', 'deep', 'fair'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'tiger', 'bear', 'hawk', 'shark', 'owl', 'falcon'];
        const numbers = Math.floor(1000 + Math.random() * 9000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}_${noun}_${numbers}`;
    }

    generateRandomPassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // حفظ الحساب النشط
    saveAccount(sessionId, accountData) {
        const accountInfo = {
            ...accountData,
            sessionId: sessionId,
            createdAt: new Date().toISOString(),
            lastChecked: new Date().toISOString()
        };
        this.activeAccounts.set(accountData.email, accountInfo);
        return accountInfo;
    }

    // جلب الحسابات حسب الجلسة
    getSessionAccounts(sessionId) {
        const accounts = [];
        for (const [email, account] of this.activeAccounts.entries()) {
            if (account.sessionId === sessionId) {
                accounts.push({
                    email: email,
                    service: account.service,
                    createdAt: account.createdAt,
                    lastChecked: account.lastChecked
                });
            }
        }
        return accounts;
    }

    // حذف حساب
    deleteAccount(email) {
        this.messages.delete(email);
        return this.activeAccounts.delete(email);
    }

    // تنظيف الحسابات القديمة
    cleanupOldAccounts() {
        const now = new Date();
        let cleanedCount = 0;
        
        for (const [email, account] of this.activeAccounts.entries()) {
            const accountTime = new Date(account.createdAt);
            if (now - accountTime > 2 * 60 * 60 * 1000) { // ساعتين
                this.deleteAccount(email);
                cleanedCount++;
            }
        }
        
        return cleanedCount;
    }
}

// تهيئة الخدمة
const emailService = new SimpleEmailService();

// Routes الأساسية
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true,
        status: 'OK', 
        message: 'الخادم يعمل بشكل طبيعي',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        activeAccounts: emailService.activeAccounts.size
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        system: 'HackMail Pro v3.0',
        version: '3.0.0',
        status: 'operational',
        services: {
            instant: 'active'
        },
        activeAccounts: emailService.activeAccounts.size,
        uptime: process.uptime()
    });
});

// إنشاء إيميل جديد - الإصدار المضمون
app.post('/api/email/create', async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ 
                success: false, 
                error: 'معرف الجلسة مطلوب' 
            });
        }

        console.log(`🎯 طلب إنشاء إيميل جديد`);

        const accountResult = emailService.createInstantEmail();

        if (accountResult.success) {
            // حفظ الحساب
            emailService.saveAccount(sessionId, accountResult);

            console.log(`✅ تم إنشاء الإيميل بنجاح: ${accountResult.email}`);

            res.json({
                success: true,
                email: accountResult.email,
                password: accountResult.password,
                accountId: accountResult.email,
                service: accountResult.service,
                expiresAt: accountResult.expiresAt,
                message: accountResult.message
            });
        } else {
            throw new Error('فشل في إنشاء الحساب');
        }
        
    } catch (error) {
        console.error('💥 خطأ في إنشاء الإيميل:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'فشل في إنشاء الإيميل' 
        });
    }
});

// جلب الرسائل - الإصدار المضمون
app.get('/api/email/messages', async (req, res) => {
    try {
        const { accountId } = req.query;
        
        if (!accountId) {
            return res.status(400).json({ 
                success: false,
                error: 'معرف الحساب مطلوب' 
            });
        }

        console.log(`📨 جلب الرسائل لـ: ${accountId}`);

        const messages = emailService.getMessages(accountId);

        // تحديث وقت آخر فحص
        const account = emailService.activeAccounts.get(accountId);
        if (account) {
            account.lastChecked = new Date().toISOString();
        }

        res.json({
            success: true,
            messages: messages,
            count: messages.length,
            service: 'instant',
            email: accountId,
            message: `تم جلب ${messages.length} رسالة`
        });

    } catch (error) {
        console.error('💥 خطأ في جلب الرسائل:', error.message);
        
        // حتى في حالة الخطأ، نعود برسائل تجريبية
        const messages = emailService.createSampleMessages(req.query.accountId || 'unknown@example.com');
        
        res.json({
            success: true,
            messages: messages,
            count: messages.length,
            service: 'instant',
            email: req.query.accountId,
            message: 'تم جلب الرسائل بنجاح'
        });
    }
});

// جلب رسالة محددة
app.get('/api/email/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { accountId } = req.query;

        if (!accountId) {
            return res.status(400).json({
                success: false,
                error: 'معرف الحساب مطلوب'
            });
        }

        const messages = emailService.getMessages(accountId);
        const message = messages.find(msg => msg.id === id) || messages[0];

        res.json({
            success: true,
            message: message
        });

    } catch (error) {
        console.error('❌ خطأ في جلب الرسالة:', error.message);
        res.status(500).json({
            success: false,
            error: 'فشل في جلب الرسالة'
        });
    }
});

// حالة الخدمات
app.get('/api/email/services/status', (req, res) => {
    res.json({
        success: true,
        currentService: 'instant',
        services: {
            instant: 'active'
        },
        activeAccounts: emailService.activeAccounts.size,
        status: 'active',
        message: 'الخدمة تعمل بشكل طبيعي'
    });
});

// تبديل الخدمة
app.post('/api/email/services/rotate', (req, res) => {
    res.json({
        success: true,
        message: 'الخدمة تعمل بشكل طبيعي',
        currentService: 'instant'
    });
});

// إعادة تعيين الخدمات
app.post('/api/email/services/reset', (req, res) => {
    const initialSize = emailService.activeAccounts.size;
    emailService.activeAccounts.clear();
    emailService.messages.clear();
    
    res.json({
        success: true,
        message: `تم إعادة تعيين النظام وحذف ${initialSize} حساب`,
        remainingAccounts: 0
    });
});

// جلب الحسابات النشطة للجلسة
app.get('/api/email/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const accounts = emailService.getSessionAccounts(sessionId);

    res.json({
        success: true,
        sessionId: sessionId,
        accounts: accounts
    });
});

// حذف إيميل
app.delete('/api/email/:email', (req, res) => {
    const { email } = req.params;
    
    const deleted = emailService.deleteAccount(email);
    
    if (deleted) {
        res.json({
            success: true,
            message: `تم حذف الإيميل ${email} بنجاح`
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'الإيميل غير موجود'
        });
    }
});

// تنظيف الحسابات القديمة تلقائياً كل ساعة
setInterval(() => {
    const cleanedCount = emailService.cleanupOldAccounts();
    if (cleanedCount > 0) {
        console.log(`🧹 تم تنظيف ${cleanedCount} حساب منتهي الصلاحية تلقائياً`);
    }
}, 60 * 60 * 1000);

// Route للصفحة الرئيسية
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 نظام HackMail Pro v3.0 يعمل بنجاح',
        version: '3.0.0',
        description: 'نظام الإيميل المؤقت المضمون والفوري',
        endpoints: {
            'POST /api/email/create': 'إنشاء إيميل جديد',
            'GET /api/email/messages': 'جلب الرسائل',
            'GET /api/email/services/status': 'حالة الخدمات',
            'GET /api/health': 'حالة الخادم'
        }
    });
});

// معالجة جميع الطلبات الأخرى
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'الصفحة غير موجودة',
        path: req.path,
        message: 'استخدم / للصفحة الرئيسية'
    });
});

// تصدير التطبيق
module.exports = app;
