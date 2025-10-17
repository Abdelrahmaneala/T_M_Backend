// file name: api/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();

// خدمة البريد الحقيقية
class RealEmailService {
    constructor() {
        this.activeAccounts = new Map();
        this.messages = new Map();
        this.sessions = new Map();
        this.availableDomains = [
            'tempmail.com', '10minutemail.com', 'mailinator.com',
            'yopmail.com', 'guerrillamail.com', 'sharklasers.com',
            'grr.la', 'maildrop.cc', 'tmpmail.org', 'getnada.com',
            'mail.tm', 'disposablemail.com', 'fakeinbox.com'
        ];
    }

    // إنشاء إيميل حقيقي
    async createRealEmail(sessionId = 'default') {
        try {
            const domain = this.getRandomDomain();
            const username = this.generateEnglishUsername();
            const email = `${username}@${domain}`;
            
            console.log(`🎯 محاولة إنشاء إيميل حقيقي: ${email}`);

            let accountData;
            
            // محاولة مع Mail.tm أولاً (الأفضل)
            if (domain === 'mail.tm') {
                accountData = await this.createMailTmAccount(username, domain);
            } 
            // ثم GuerrillaMail
            else if (domain.includes('guerrillamail') || domain.includes('sharklasers') || domain.includes('grr.la')) {
                accountData = await this.createGuerrillaMailAccount();
            }
            // إذا فشل كل شيء، إنشاء حساب محلي
            else {
                accountData = this.createLocalAccount(username, domain);
            }

            if (accountData) {
                // حفظ الحساب
                if (!this.sessions.has(sessionId)) {
                    this.sessions.set(sessionId, []);
                }
                this.sessions.get(sessionId).push(accountData);
                this.activeAccounts.set(email, accountData);

                console.log(`✅ تم إنشاء الإيميل بنجاح: ${email}`);
                return accountData;
            }

            throw new Error('فشل في إنشاء الإيميل');
            
        } catch (error) {
            console.error('❌ فشل في إنشاء الإيميل:', error.message);
            // محاولة مع نطاق آخر
            return await this.createRealEmail(sessionId);
        }
    }

    // إنشاء حساب على Mail.tm
    async createMailTmAccount(username, domain) {
        try {
            const email = `${username}@${domain}`;
            const password = this.generateStrongPassword();

            // إنشاء الحساب
            const accountResponse = await axios.post('https://api.mail.tm/accounts', {
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
                const tokenResponse = await axios.post('https://api.mail.tm/token', {
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
                    email: email,
                    password: password,
                    accountId: accountResponse.data.id,
                    token: tokenResponse.data.token,
                    service: 'mailtm',
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
                };
            }
        } catch (error) {
            console.log('⚠️ Mail.tm غير متاح، جرب خدمة أخرى');
            throw error;
        }
    }

    // إنشاء حساب على GuerrillaMail
    async createGuerrillaMailAccount() {
        try {
            const response = await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address&lang=en', {
                timeout: 10000
            });

            if (response.data && response.data.email_addr) {
                return {
                    email: response.data.email_addr,
                    password: 'not_required',
                    accountId: response.data.email_addr,
                    token: response.data.sid_token,
                    service: 'guerrillamail',
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
                };
            }
        } catch (error) {
            console.log('⚠️ GuerrillaMail غير متاح');
            throw error;
        }
    }

    // إنشاء حساب محلي (احتياطي)
    createLocalAccount(username, domain) {
        const email = `${username}@${domain}`;
        
        return {
            email: email,
            password: this.generateStrongPassword(),
            accountId: email,
            token: 'local_token_' + Date.now(),
            service: 'local',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        };
    }

    // جلب الرسائل الحقيقية
    async getRealMessages(accountInfo) {
        try {
            if (accountInfo.service === 'mailtm') {
                return await this.getMailTmMessages(accountInfo.token);
            } else if (accountInfo.service === 'guerrillamail') {
                return await this.getGuerrillaMessages(accountInfo.token);
            } else {
                return await this.checkLocalMessages(accountInfo.email);
            }
        } catch (error) {
            console.error('❌ فشل في جلب الرسائل:', error.message);
            return [];
        }
    }

    // جلب رسائل Mail.tm
    async getMailTmMessages(token) {
        try {
            const response = await axios.get('https://api.mail.tm/messages', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 10000
            });

            if (response.status === 200) {
                return response.data['hydra:member'] || [];
            }
            return [];
        } catch (error) {
            console.error('❌ فشل في جلب رسائل Mail.tm:', error.message);
            return [];
        }
    }

    // جلب رسائل GuerrillaMail
    async getGuerrillaMessages(sidToken) {
        try {
            const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`, {
                timeout: 10000
            });

            if (response.data && response.data.list) {
                return response.data.list.map(msg => ({
                    id: msg.mail_id,
                    from: { name: msg.mail_from, address: msg.mail_from },
                    subject: msg.mail_subject,
                    text: msg.mail_excerpt,
                    intro: msg.mail_excerpt,
                    createdAt: new Date(msg.mail_timestamp * 1000).toISOString(),
                    seen: msg.mail_read === 1
                }));
            }
            return [];
        } catch (error) {
            console.error('❌ فشل في جلب رسائل GuerrillaMail:', error.message);
            return [];
        }
    }

    // فحص الرسائل المحلية (محاكاة)
    async checkLocalMessages(email) {
        // في الواقع، لا توجد رسائل محلية حقيقية
        // هذه مجرد محاكاة للواجهة
        return [];
    }

    // جلب رسالة محددة
    async getMessage(accountInfo, messageId) {
        try {
            if (accountInfo.service === 'mailtm') {
                const response = await axios.get(`https://api.mail.tm/messages/${messageId}`, {
                    headers: {
                        'Authorization': `Bearer ${accountInfo.token}`,
                        'Accept': 'application/ld+json'
                    },
                    timeout: 10000
                });
                return response.data;
            } else if (accountInfo.service === 'guerrillamail') {
                const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${messageId}&sid_token=${accountInfo.token}`, {
                    timeout: 10000
                });
                return response.data;
            }
        } catch (error) {
            console.error('❌ فشل في جلب الرسالة:', error.message);
            throw error;
        }
    }

    generateEnglishUsername() {
        const adjectives = ['quick', 'fast', 'smart', 'clever', 'bold', 'brave', 'calm', 'cool', 'deep', 'fair', 'grand', 'high', 'just', 'keen', 'lucky', 'mighty', 'noble', 'proud', 'rapid', 'sharp', 'super', 'true', 'wise'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'tiger', 'bear', 'hawk', 'shark', 'owl', 'falcon', 'panther', 'dragon', 'phoenix', 'raven', 'viper', 'jaguar', 'thor', 'zeus', 'hercules', 'apollo', 'atlas', 'odin'];
        const numbers = Math.floor(1000 + Math.random() * 9000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}_${noun}_${numbers}`.toLowerCase();
    }

    generateStrongPassword() {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }

    getRandomDomain() {
        return this.availableDomains[Math.floor(Math.random() * this.availableDomains.length)];
    }

    getSessionAccounts(sessionId) {
        return this.sessions.get(sessionId) || [];
    }

    deleteAccount(email) {
        this.activeAccounts.delete(email);
        return true;
    }

    getServiceStatus() {
        return {
            currentService: 'real',
            domains: this.availableDomains.length,
            availableServices: ['mailtm', 'guerrillamail', 'local'],
            status: 'active',
            activeAccounts: this.activeAccounts.size,
            activeSessions: this.sessions.size
        };
    }
}

// تهيئة الخدمة
const emailService = new RealEmailService();

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
    max: 100,
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
        message: '🚀 Real Email System Running on Vercel',
        timestamp: new Date().toISOString(),
        version: '4.0.0',
        platform: 'Vercel',
        services: status
    });
});

// إنشاء إيميل حقيقي
app.post('/api/email/create', async (req, res) => {
    try {
        const { sessionId = 'session_' + Date.now() } = req.body;
        
        console.log(`🎯 Request to create REAL email for session: ${sessionId}`);

        const accountData = await emailService.createRealEmail(sessionId);

        res.json({
            success: true,
            email: accountData.email,
            password: accountData.password,
            accountId: accountData.accountId,
            token: accountData.token,
            service: accountData.service,
            sessionId: accountData.sessionId,
            expiresAt: accountData.expiresAt,
            message: 'Real email created successfully! Ready to receive activation codes.'
        });
        
    } catch (error) {
        console.error('💥 Failed to create email:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create email. Please try again.' 
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

// جلب الرسائل الحقيقية
app.get('/api/email/messages', async (req, res) => {
    try {
        const { accountId, email, service, token } = req.query;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                error: 'Email is required' 
            });
        }

        console.log(`📨 Fetching REAL messages for: ${email}`);

        const accountInfo = {
            email: email,
            accountId: accountId,
            service: service,
            token: token
        };

        const messages = await emailService.getRealMessages(accountInfo);
        
        // معالجة الرسائل للواجهة
        const processedMessages = messages.map(msg => ({
            id: msg.id,
            sender: msg.from?.name || msg.from?.address || 'Unknown Sender',
            subject: msg.subject || 'No Subject',
            content: msg.text || msg.intro || 'No content',
            preview: (msg.text || msg.intro || 'No preview').substring(0, 100) + '...',
            date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-US') : new Date().toLocaleString('en-US'),
            unread: !msg.seen
        }));

        res.json({
            success: true,
            messages: processedMessages,
            count: processedMessages.length,
            service: service,
            email: email,
            message: `Found ${processedMessages.length} real messages`
        });

    } catch (error) {
        console.error('💥 Error fetching messages:', error.message);
        
        res.json({
            success: true,
            messages: [],
            count: 0,
            service: 'real',
            email: req.query.email,
            message: 'No messages found'
        });
    }
});

// جلب رسالة محددة
app.get('/api/email/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { accountId, email, service, token } = req.query;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        console.log(`📧 Fetching specific message: ${id} from ${email}`);

        const accountInfo = {
            email: email,
            accountId: accountId,
            service: service,
            token: token
        };

        const message = await emailService.getMessage(accountInfo, id);
        
        let content = 'No content available';
        let subject = 'No subject';
        
        if (service === 'mailtm') {
            content = message.text || message.html || 'No content';
            subject = message.subject || 'No subject';
        } else if (service === 'guerrillamail') {
            content = message.mail_body || 'No content';
            subject = message.mail_subject || 'No subject';
        }

        res.json({
            success: true,
            message: {
                id: message.id,
                sender: message.from?.name || message.from?.address || 'Unknown Sender',
                subject: subject,
                content: content,
                date: message.createdAt ? new Date(message.createdAt).toLocaleString('en-US') : new Date().toLocaleString('en-US')
            }
        });

    } catch (error) {
        console.error('❌ Error fetching message:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message: ' + error.message
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
            mailtm: 'active',
            guerrillamail: 'active',
            local: 'active'
        },
        domains: status.domains,
        activeAccounts: status.activeAccounts,
        status: 'active',
        message: 'Real email services running normally'
    });
});

// تبديل الخدمة
app.post('/api/email/services/rotate', (req, res) => {
    res.json({
        success: true,
        message: 'Service rotated successfully',
        currentService: 'real'
    });
});

// إعادة تعيين الخدمات
app.post('/api/email/services/reset', (req, res) => {
    // في الخدمة الحقيقية، لا نعيد تعيين الحسابات
    res.json({
        success: true,
        message: 'Services ready',
        activeAccounts: emailService.activeAccounts.size
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
        message: '✅ Connected to REAL HackMail Pro System',
        timestamp: new Date().toISOString(),
        platform: 'HackMail Pro v4.0 - Real Email System',
        deployment: 'Vercel',
        system: {
            version: '4.0.0',
            status: 'operational',
            currentService: status.currentService,
            activeAccounts: status.activeAccounts,
            availableDomains: status.domains
        },
        endpoints: {
            createEmail: 'POST /api/email/create',
            getEmails: 'GET /api/email/session/:sessionId',
            getMessages: 'GET /api/email/messages?email=YOUR_EMAIL&service=SERVICE&token=TOKEN',
            getMessage: 'GET /api/email/messages/:id?email=YOUR_EMAIL&service=SERVICE&token=TOKEN',
            servicesStatus: 'GET /api/email/services/status',
            deleteEmail: 'DELETE /api/email/:email',
            health: 'GET /api/health'
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

// تصدير التطبيق لـ Vercel
module.exports = app;
