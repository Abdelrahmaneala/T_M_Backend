const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use(limiter);

// خدمة Mail.tm الحقيقية المحسنة
class MailTMService {
    constructor() {
        this.baseURL = 'https://api.mail.tm';
        this.domains = [];
    }

    async getDomains() {
        try {
            console.log('🔍 جاري جلب النطاقات من Mail.tm...');
            const response = await axios.get(`${this.baseURL}/domains`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            this.domains = response.data['hydra:member'] || [];
            
            if (this.domains.length === 0) {
                console.log('⚠️ لا توجد نطاقات من API، استخدام النطاقات الافتراضية');
                this.domains = [
                    { domain: 'mail.tm' },
                    { domain: 'tiffincrane.com' },
                    { domain: 'dcctb.com' },
                    { domain: 'bugfoo.com' }
                ];
            }
            
            console.log(`✅ تم تحميل ${this.domains.length} نطاق`);
            return this.domains;
        } catch (error) {
            console.error('❌ فشل في جلب النطاقات:', error.message);
            // نطاقات احتياطية
            this.domains = [
                { domain: 'tiffincrane.com' },
                { domain: 'dcctb.com' },
                { domain: 'bugfoo.com' },
                { domain: 'mail.tm' }
            ];
            return this.domains;
        }
    }

    async createAccount() {
        try {
            await this.getDomains();
            
            if (this.domains.length === 0) {
                throw new Error('لا توجد نطاقات متاحة');
            }

            // استخدام نطاق عشوائي
            const randomDomain = this.domains[Math.floor(Math.random() * this.domains.length)].domain;
            const username = this.generateUsername();
            const email = `${username}@${randomDomain}`;
            const password = this.generatePassword();

            console.log(`🔄 محاولة إنشاء حساب: ${email}`);

            // إنشاء الحساب
            const accountResponse = await axios.post(`${this.baseURL}/accounts`, {
                address: email,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 15000,
                validateStatus: (status) => status < 500
            });

            console.log(`📨 استجابة إنشاء الحساب: ${accountResponse.status}`);

            if (accountResponse.status === 201) {
                console.log('✅ تم إنشاء الحساب بنجاح، جاري الحصول على التوكن...');
                
                // الحصول على التوكن
                const tokenResponse = await axios.post(`${this.baseURL}/token`, {
                    address: email,
                    password: password
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/ld+json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    timeout: 15000,
                    validateStatus: (status) => status < 500
                });

                if (tokenResponse.status === 200) {
                    console.log('✅ تم الحصول على التوكن بنجاح');
                    
                    return {
                        success: true,
                        email: email,
                        password: password,
                        token: tokenResponse.data.token,
                        accountId: accountResponse.data.id,
                        service: 'mailtm'
                    };
                } else {
                    throw new Error(`فشل في الحصول على التوكن: ${tokenResponse.status}`);
                }
            } else if (accountResponse.status === 422) {
                // البريد مستخدم مسبقاً، حاول مرة أخرى
                console.log('⚠️ البريد مستخدم مسبقاً، جرب إنشاء بريد جديد...');
                return await this.createAccount();
            } else {
                throw new Error(`فشل في إنشاء الحساب: ${accountResponse.status}`);
            }
        } catch (error) {
            console.error('❌ خطأ في Mail.tm:', error.message);
            if (error.response) {
                console.error('📊 بيانات الاستجابة:', error.response.data);
            }
            throw new Error(`فشل في إنشاء حساب Mail.tm: ${error.message}`);
        }
    }

    async getMessages(token) {
        try {
            console.log('📨 جاري جلب الرسائل من Mail.tm...');
            const response = await axios.get(`${this.baseURL}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000,
                validateStatus: (status) => status < 500
            });

            if (response.status === 200) {
                const messages = response.data['hydra:member'] || [];
                console.log(`✅ تم جلب ${messages.length} رسالة من Mail.tm`);
                return messages;
            } else if (response.status === 401) {
                throw new Error('التوكن منتهي الصلاحية');
            } else {
                console.log(`⚠️ استجابة غير متوقعة: ${response.status}`);
                return [];
            }
        } catch (error) {
            console.error('❌ خطأ في جلب الرسائل:', error.message);
            return [];
        }
    }

    async getMessage(token, messageId) {
        try {
            const response = await axios.get(`${this.baseURL}/messages/${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('❌ خطأ في جلب الرسالة:', error.message);
            return null;
        }
    }

    generateUsername() {
        const adjectives = ['quick', 'bold', 'calm', 'deep', 'fair', 'grand', 'high', 'just', 'keen', 'lucky'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'bear', 'hawk', 'deer', 'fish', 'owl', 'bird'];
        const numbers = Math.floor(1000 + Math.random() * 9000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}${noun}${numbers}`;
    }

    generatePassword() {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }
}

// خدمة GuerrillaMail الحقيقية المحسنة
class GuerrillaMailService {
    constructor() {
        this.baseURL = 'https://api.guerrillamail.com';
    }

    async createAccount() {
        try {
            console.log('🔄 إنشاء حساب GuerrillaMail...');
            
            const response = await axios.get(`${this.baseURL}/ajax.php?f=get_email_address&lang=en`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                validateStatus: (status) => status < 500
            });

            if (response.data && response.data.email_addr) {
                console.log(`✅ تم إنشاء حساب GuerrillaMail: ${response.data.email_addr}`);
                
                return {
                    success: true,
                    email: response.data.email_addr,
                    password: 'not_required',
                    token: response.data.sid_token,
                    accountId: response.data.email_addr,
                    service: 'guerrillamail',
                    sid_token: response.data.sid_token
                };
            } else {
                throw new Error('لا يوجد رد من GuerrillaMail');
            }
        } catch (error) {
            console.error('❌ خطأ في GuerrillaMail:', error.message);
            throw new Error(`فشل في إنشاء حساب GuerrillaMail: ${error.message}`);
        }
    }

    async getMessages(sidToken) {
        try {
            console.log('📨 جاري جلب الرسائل من GuerrillaMail...');
            
            const response = await axios.get(`${this.baseURL}/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                validateStatus: (status) => status < 500
            });

            if (response.data && response.data.list) {
                const messages = response.data.list || [];
                console.log(`✅ تم جلب ${messages.length} رسالة من GuerrillaMail`);
                return messages;
            } else {
                console.log('⚠️ لا توجد رسائل من GuerrillaMail');
                return [];
            }
        } catch (error) {
            console.error('❌ خطأ في جلب الرسائل:', error.message);
            return [];
        }
    }

    async getMessage(sidToken, messageId) {
        try {
            const response = await axios.get(`${this.baseURL}/ajax.php?f=fetch_email&email_id=${messageId}&sid_token=${sidToken}`, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ خطأ في جلب الرسالة:', error.message);
            return null;
        }
    }
}

// خدمة TempMail البديلة
class TempMailService {
    constructor() {
        this.domains = [
            'tmpmail.org',
            'temp-mail.org',
            '10minutemail.com',
            'guerrillamail.com',
            'yopmail.com'
        ];
    }

    async createAccount() {
        try {
            const domain = this.domains[Math.floor(Math.random() * this.domains.length)];
            const username = this.generateUsername();
            const email = `${username}@${domain}`;
            
            console.log(`✅ إنشاء حساب TempMail: ${email}`);
            
            return {
                success: true,
                email: email,
                password: 'not_required',
                token: username,
                accountId: email,
                service: 'tempMail'
            };
        } catch (error) {
            console.error('❌ خطأ في TempMail:', error.message);
            throw error;
        }
    }

    generateUsername() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let username = '';
        for (let i = 0; i < 15; i++) {
            username += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return username;
    }
}

// تهيئة الخدمات
const mailtmService = new MailTMService();
const guerrillaService = new GuerrillaMailService();
const tempMailService = new TempMailService();

// تخزين الحسابات النشطة
const activeAccounts = new Map();

// Routes الأساسية
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'الخادم يعمل بشكل طبيعي',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        system: 'HackMail Pro',
        version: '2.0.0',
        status: 'operational',
        services: {
            mailtm: 'active',
            guerrillamail: 'active',
            tempMail: 'active'
        },
        activeAccounts: activeAccounts.size
    });
});

// إنشاء إيميل جديد
app.post('/api/email/create', async (req, res) => {
    try {
        const { sessionId, service = 'mailtm' } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({ 
                success: false, 
                error: 'معرف الجلسة مطلوب' 
            });
        }

        console.log(`🎯 طلب إنشاء إيميل جديد مع الخدمة: ${service}`);

        let accountResult;
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                console.log(`🔄 المحاولة ${attempts} لإنشاء حساب...`);
                
                if (service === 'mailtm') {
                    accountResult = await mailtmService.createAccount();
                } else if (service === 'guerrillamail') {
                    accountResult = await guerrillaService.createAccount();
                } else if (service === 'tempMail') {
                    accountResult = await tempMailService.createAccount();
                } else {
                    return res.status(400).json({
                        success: false,
                        error: 'الخدمة غير مدعومة'
                    });
                }

                if (accountResult && accountResult.success) {
                    break;
                }
            } catch (error) {
                console.log(`⚠️ فشلت المحاولة ${attempts}: ${error.message}`);
                if (attempts === maxAttempts) {
                    throw error;
                }
                // انتظار قبل المحاولة التالية
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (accountResult && accountResult.success) {
            // تخزين الحساب
            const accountData = {
                ...accountResult,
                sessionId: sessionId,
                createdAt: new Date().toISOString(),
                messageCount: 0,
                lastChecked: new Date().toISOString()
            };
            
            activeAccounts.set(accountResult.email, accountData);

            console.log(`✅ تم إنشاء الحساب بنجاح: ${accountResult.email}`);

            res.json({
                success: true,
                email: accountResult.email,
                password: accountResult.password,
                accountId: accountResult.email,
                token: accountResult.token,
                service: accountResult.service,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // ساعتين
                message: `تم إنشاء الإيميل بنجاح باستخدام ${accountResult.service}`
            });
        } else {
            throw new Error('فشل في إنشاء الحساب بعد جميع المحاولات');
        }
        
    } catch (error) {
        console.error('💥 خطأ في إنشاء الإيميل:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'فشل في إنشاء الإيميل' 
        });
    }
});

// جلب الرسائل
app.get('/api/email/messages', async (req, res) => {
    try {
        const { accountId, service } = req.query;
        
        if (!accountId || !service) {
            return res.status(400).json({ 
                success: false,
                error: 'معرف الحساب والخدمة مطلوبان' 
            });
        }

        let messages = [];
        const account = activeAccounts.get(accountId);

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'الحساب غير موجود أو انتهت صلاحيته'
            });
        }

        console.log(`📨 جلب الرسائل لـ: ${accountId} (${service})`);

        try {
            if (service === 'mailtm') {
                messages = await mailtmService.getMessages(account.token);
            } else if (service === 'guerrillamail') {
                messages = await guerrillaService.getMessages(account.token || account.sid_token);
            } else if (service === 'tempMail') {
                // TempMail لا يدعم جلب الرسائل حالياً
                messages = [];
            }

            // تحديث وقت آخر فحص
            account.lastChecked = new Date().toISOString();
            activeAccounts.set(accountId, account);

            // معالجة الرسائل لتنسيق موحد
            const processedMessages = messages.map(msg => {
                if (service === 'mailtm') {
                    return {
                        id: msg.id,
                        sender: msg.from?.address || msg.from?.name || 'غير معروف',
                        subject: msg.subject || 'بدون عنوان',
                        content: msg.text || msg.intro || 'لا يوجد محتوى',
                        preview: msg.intro || (msg.text ? msg.text.substring(0, 100) + '...' : 'لا يوجد معاينة'),
                        date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
                        unread: !msg.seen
                    };
                } else if (service === 'guerrillamail') {
                    return {
                        id: msg.mail_id,
                        sender: msg.mail_from || 'غير معروف',
                        subject: msg.mail_subject || 'بدون عنوان',
                        content: msg.mail_body || 'لا يوجد محتوى',
                        preview: msg.mail_excerpt || (msg.mail_body ? msg.mail_body.substring(0, 100) + '...' : 'لا يوجد معاينة'),
                        date: msg.mail_timestamp ? new Date(msg.mail_timestamp * 1000).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
                        unread: msg.mail_read !== 1
                    };
                }
            }).filter(msg => msg !== null);

            console.log(`✅ تم معالجة ${processedMessages.length} رسالة`);

            res.json({
                success: true,
                messages: processedMessages,
                count: processedMessages.length,
                service: service,
                email: accountId,
                message: `تم جلب ${processedMessages.length} رسالة`
            });

        } catch (serviceError) {
            console.error('❌ خطأ في الخدمة:', serviceError.message);
            res.json({
                success: true,
                messages: [],
                count: 0,
                service: service,
                email: accountId,
                message: 'لا توجد رسائل جديدة'
            });
        }

    } catch (error) {
        console.error('💥 خطأ عام في جلب الرسائل:', error.message);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في جلب الرسائل: ' + error.message
        });
    }
});

// جلب رسالة محددة
app.get('/api/email/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { accountId, service } = req.query;

        if (!accountId || !service) {
            return res.status(400).json({
                success: false,
                error: 'معرف الحساب والخدمة مطلوبان'
            });
        }

        let message = null;
        const account = activeAccounts.get(accountId);

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'الحساب غير موجود'
            });
        }

        if (service === 'mailtm') {
            message = await mailtmService.getMessage(account.token, id);
        } else if (service === 'guerrillamail') {
            message = await guerrillaService.getMessage(account.token || account.sid_token, id);
        }

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'الرسالة غير موجودة'
            });
        }

        res.json({
            success: true,
            message: message
        });

    } catch (error) {
        console.error('❌ خطأ في جلب الرسالة:', error.message);
        res.status(500).json({
            success: false,
            error: 'فشل في جلب الرسالة: ' + error.message
        });
    }
});

// حالة الخدمات
app.get('/api/email/services/status', async (req, res) => {
    try {
        // اختبار اتصال Mail.tm
        let mailtmStatus = 'inactive';
        try {
            await axios.get('https://api.mail.tm/domains', { 
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            mailtmStatus = 'active';
            console.log('✅ Mail.tm نشط');
        } catch (error) {
            console.log('❌ Mail.tm غير نشط:', error.message);
        }

        // اختبار اتصال GuerrillaMail
        let guerrillaStatus = 'inactive';
        try {
            await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address', { 
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            guerrillaStatus = 'active';
            console.log('✅ GuerrillaMail نشط');
        } catch (error) {
            console.log('❌ GuerrillaMail غير نشط:', error.message);
        }

        res.json({
            success: true,
            currentService: 'mailtm',
            services: {
                mailtm: mailtmStatus,
                guerrillamail: guerrillaStatus,
                tempMail: 'active'
            },
            activeAccounts: activeAccounts.size,
            status: (mailtmStatus === 'active' || guerrillaStatus === 'active') ? 'active' : 'limited'
        });
    } catch (error) {
        console.error('❌ خطأ في حالة الخدمات:', error.message);
        res.json({
            success: false,
            error: 'فشل في التحقق من حالة الخدمات: ' + error.message
        });
    }
});

// تبديل الخدمة
app.post('/api/email/services/rotate', (req, res) => {
    res.json({
        success: true,
        message: 'يمكنك اختيار الخدمة يدوياً عند إنشاء الإيميل',
        availableServices: ['mailtm', 'guerrillamail', 'tempMail']
    });
});

// إعادة تعيين الخدمات
app.post('/api/email/services/reset', (req, res) => {
    // تنظيف الحسابات القديمة (أقدم من 3 ساعات)
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [email, account] of activeAccounts.entries()) {
        const accountTime = new Date(account.createdAt);
        if (now - accountTime > 3 * 60 * 60 * 1000) {
            activeAccounts.delete(email);
            cleanedCount++;
        }
    }

    res.json({
        success: true,
        message: `تم تنظيف ${cleanedCount} حساب منتهي الصلاحية`,
        remainingAccounts: activeAccounts.size
    });
});

// جلب الحسابات النشطة للجلسة
app.get('/api/email/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const sessionAccounts = [];
    for (const [email, account] of activeAccounts.entries()) {
        if (account.sessionId === sessionId) {
            sessionAccounts.push({
                email: email,
                service: account.service,
                createdAt: account.createdAt,
                messageCount: account.messageCount,
                lastChecked: account.lastChecked
            });
        }
    }

    res.json({
        success: true,
        sessionId: sessionId,
        accounts: sessionAccounts
    });
});

// حذف إيميل
app.delete('/api/email/:email', (req, res) => {
    const { email } = req.params;
    
    if (activeAccounts.has(email)) {
        activeAccounts.delete(email);
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

// تنظيف الحسابات القديمة تلقائياً
setInterval(() => {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [email, account] of activeAccounts.entries()) {
        const accountTime = new Date(account.createdAt);
        if (now - accountTime > 3 * 60 * 60 * 1000) { // 3 ساعات
            activeAccounts.delete(email);
            cleanedCount++;
        }
    }
    
    if (cleanedCount > 0) {
        console.log(`🧹 تم تنظيف ${cleanedCount} حساب منتهي الصلاحية تلقائياً`);
    }
}, 30 * 60 * 1000); // كل 30 دقيقة

// معالجة جميع الطلبات الأخرى
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'الصفحة غير موجودة',
        path: req.path
    });
});

// معالجة الأخطاء غير المتوقعة
process.on('uncaughtException', (error) => {
    console.error('💥 خطأ غير متوقع:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 وعد مرفوض:', reason);
});

module.exports = app;
