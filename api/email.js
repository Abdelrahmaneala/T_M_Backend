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

// خدمة Mail.tm الحقيقية
class MailTMService {
    constructor() {
        this.baseURL = 'https://api.mail.tm';
        this.domains = [];
    }

    async getDomains() {
        try {
            const response = await axios.get(`${this.baseURL}/domains`);
            this.domains = response.data['hydra:member'] || [];
            return this.domains;
        } catch (error) {
            console.error('Error fetching domains:', error.message);
            return [{ domain: 'mail.tm' }];
        }
    }

    async createAccount() {
        try {
            await this.getDomains();
            if (this.domains.length === 0) {
                throw new Error('No domains available');
            }

            const domain = this.domains[0].domain;
            const username = this.generateUsername();
            const email = `${username}@${domain}`;
            const password = this.generatePassword();

            // إنشاء الحساب
            const accountResponse = await axios.post(`${this.baseURL}/accounts`, {
                address: email,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/ld+json'
                },
                timeout: 10000
            });

            if (accountResponse.status === 201) {
                // الحصول على التوكن
                const tokenResponse = await axios.post(`${this.baseURL}/token`, {
                    address: email,
                    password: password
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/ld+json'
                    },
                    timeout: 10000
                });

                return {
                    success: true,
                    email: email,
                    password: password,
                    token: tokenResponse.data.token,
                    accountId: accountResponse.data.id,
                    service: 'mailtm'
                };
            }
        } catch (error) {
            console.error('Mail.tm error:', error.message);
            throw error;
        }
    }

    async getMessages(token) {
        try {
            const response = await axios.get(`${this.baseURL}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 10000
            });

            return response.data['hydra:member'] || [];
        } catch (error) {
            console.error('Error fetching messages:', error.message);
            return [];
        }
    }

    async getMessage(token, messageId) {
        try {
            const response = await axios.get(`${this.baseURL}/messages/${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching message:', error.message);
            return null;
        }
    }

    generateUsername() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let username = '';
        for (let i = 0; i < 10; i++) {
            username += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return username;
    }

    generatePassword() {
        return Math.random().toString(36).slice(-16);
    }
}

// خدمة GuerrillaMail الحقيقية
class GuerrillaMailService {
    constructor() {
        this.baseURL = 'https://api.guerrillamail.com';
        this.sidToken = null;
        this.email = null;
    }

    async createAccount() {
        try {
            const response = await axios.get(`${this.baseURL}/ajax.php?f=get_email_address&lang=en`, {
                timeout: 10000
            });

            if (response.data) {
                this.sidToken = response.data.sid_token;
                this.email = response.data.email_addr;

                return {
                    success: true,
                    email: this.email,
                    password: 'not_required',
                    token: this.sidToken,
                    accountId: this.email,
                    service: 'guerrillamail'
                };
            }
        } catch (error) {
            console.error('GuerrillaMail error:', error.message);
            throw error;
        }
    }

    async getMessages(sidToken) {
        try {
            const response = await axios.get(`${this.baseURL}/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`, {
                timeout: 10000
            });

            return response.data.list || [];
        } catch (error) {
            console.error('Error fetching messages:', error.message);
            return [];
        }
    }

    async getMessage(sidToken, messageId) {
        try {
            const response = await axios.get(`${this.baseURL}/ajax.php?f=fetch_email&email_id=${messageId}&sid_token=${sidToken}`, {
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('Error fetching message:', error.message);
            return null;
        }
    }
}

// تهيئة الخدمات
const mailtmService = new MailTMService();
const guerrillaService = new GuerrillaMailService();

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
            guerrillamail: 'active'
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

        let accountResult;
        
        if (service === 'mailtm') {
            accountResult = await mailtmService.createAccount();
        } else if (service === 'guerrillamail') {
            accountResult = await guerrillaService.createAccount();
        } else {
            return res.status(400).json({
                success: false,
                error: 'الخدمة غير مدعومة'
            });
        }

        if (accountResult.success) {
            // تخزين الحساب
            const accountData = {
                ...accountResult,
                sessionId: sessionId,
                createdAt: new Date().toISOString(),
                messageCount: 0
            };
            
            activeAccounts.set(accountResult.email, accountData);

            res.json({
                success: true,
                email: accountResult.email,
                password: accountResult.password,
                accountId: accountResult.email, // استخدام الإيميل كمعرف
                token: accountResult.token,
                service: accountResult.service,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                message: `تم إنشاء الإيميل بنجاح باستخدام ${accountResult.service}`
            });
        } else {
            throw new Error('فشل في إنشاء الحساب');
        }
        
    } catch (error) {
        console.error('Create email error:', error);
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
        let account = activeAccounts.get(accountId);

        if (!account) {
            return res.status(404).json({
                success: false,
                error: 'الحساب غير موجود أو انتهت صلاحيته'
            });
        }

        if (service === 'mailtm') {
            messages = await mailtmService.getMessages(account.token);
        } else if (service === 'guerrillamail') {
            messages = await guerrillaService.getMessages(account.token);
        }

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
        });

        // تحديث عدد الرسائل
        account.messageCount = processedMessages.length;
        activeAccounts.set(accountId, account);

        res.json({
            success: true,
            messages: processedMessages,
            count: processedMessages.length,
            service: service,
            email: accountId,
            message: `تم جلب ${processedMessages.length} رسالة`
        });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في جلب الرسائل'
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
            message = await guerrillaService.getMessage(account.token, id);
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
        console.error('Get message error:', error);
        res.status(500).json({
            success: false,
            error: 'فشل في جلب الرسالة'
        });
    }
});

// حالة الخدمات
app.get('/api/email/services/status', async (req, res) => {
    try {
        // اختبار اتصال Mail.tm
        let mailtmStatus = 'inactive';
        try {
            await axios.get('https://api.mail.tm/domains', { timeout: 5000 });
            mailtmStatus = 'active';
        } catch (error) {
            console.log('Mail.tm test failed:', error.message);
        }

        // اختبار اتصال GuerrillaMail
        let guerrillaStatus = 'inactive';
        try {
            await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address', { timeout: 5000 });
            guerrillaStatus = 'active';
        } catch (error) {
            console.log('GuerrillaMail test failed:', error.message);
        }

        res.json({
            success: true,
            currentService: 'mailtm',
            services: {
                mailtm: mailtmStatus,
                guerrillamail: guerrillaStatus
            },
            activeAccounts: activeAccounts.size,
            status: mailtmStatus === 'active' || guerrillaStatus === 'active' ? 'active' : 'inactive'
        });
    } catch (error) {
        res.json({
            success: false,
            error: 'فشل في التحقق من حالة الخدمات'
        });
    }
});

// تبديل الخدمة
app.post('/api/email/services/rotate', (req, res) => {
    res.json({
        success: true,
        message: 'يمكنك اختيار الخدمة يدوياً عند إنشاء الإيميل',
        availableServices: ['mailtm', 'guerrillamail']
    });
});

// إعادة تعيين الخدمات
app.post('/api/email/services/reset', (req, res) => {
    // تنظيف الحسابات القديمة (أقدم من 24 ساعة)
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [email, account] of activeAccounts.entries()) {
        const accountTime = new Date(account.createdAt);
        if (now - accountTime > 24 * 60 * 60 * 1000) {
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
                messageCount: account.messageCount
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

// معالجة جميع الطلبات الأخرى
app.all('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'الصفحة غير موجودة',
        path: req.path
    });
});

module.exports = app;
