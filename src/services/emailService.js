// file name: emailService.js
// استبدل محتوى الملف بالكود التالي:

const axios = require('axios');

class SmartEmailService {
    constructor() {
        this.services = [
            { name: 'mailtm', baseURL: 'https://api.mail.tm', active: true, priority: 1 },
            { name: 'guerrillamail', baseURL: 'https://api.guerrillamail.com', active: true, priority: 2 },
            { name: 'temp-mail', baseURL: 'https://api.temp-mail.org', active: true, priority: 3 }
        ];
        this.currentServiceIndex = 0;
        this.domains = [];
        this.accountCache = new Map();
        this.sessionAccounts = new Map();
    }

    getCurrentService() {
        return this.services[this.currentServiceIndex];
    }

    async initialize() {
        console.log('🔄 تهيئة خدمة البريد الذكية...');
        try {
            await this.loadDomains();
            console.log('✅ خدمة البريد الذكية جاهزة');
            return true;
        } catch (error) {
            console.error('❌ فشل في تهيئة خدمة البريد:', error.message);
            // استخدام نطاقات افتراضية في حالة الفشل
            this.domains = this.getDefaultDomains();
            return true;
        }
    }

    getDefaultDomains() {
        return [
            { domain: 'gmail.com' },
            { domain: 'outlook.com' },
            { domain: 'yahoo.com' },
            { domain: 'hotmail.com' },
            { domain: 'protonmail.com' }
        ];
    }

    async loadDomains() {
        const service = this.getCurrentService();
        
        try {
            console.log(`🔄 جاري تحميل النطاقات من ${service.name}...`);
            
            if (service.name === 'mailtm') {
                const response = await axios.get(`${service.baseURL}/domains`, {
                    timeout: 10000
                });
                this.domains = response.data['hydra:member'] || [];
            } else if (service.name === 'guerrillamail') {
                this.domains = [
                    { domain: 'guerrillamail.com' },
                    { domain: 'grr.la' },
                    { domain: 'sharklasers.com' },
                    { domain: 'guerrillamail.net' }
                ];
            } else if (service.name === 'temp-mail') {
                this.domains = [
                    { domain: 'temp-mail.org' },
                    { domain: 'temp-mail.com' },
                    { domain: 'temp-mail.net' }
                ];
            }
            
            if (this.domains.length === 0) {
                this.domains = this.getDefaultDomains();
            }
            
            console.log(`✅ تم تحميل ${this.domains.length} نطاق من ${service.name}`);
            return this.domains;
            
        } catch (error) {
            console.error(`❌ فشل في تحميل النطاقات من ${service.name}:`, error.message);
            this.domains = this.getDefaultDomains();
            console.log('🔄 استخدام النطاقات الاحتياطية');
            return this.domains;
        }
    }

    async createAccount(sessionId = 'default') {
        const maxAttempts = 5;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 المحاولة ${attempt} لإنشاء حساب...`);
                
                const service = this.getCurrentService();
                console.log(`🔄 استخدام خدمة: ${service.name}`);
                
                const result = await this.createAccountWithService(service);
                
                if (result.success) {
                    console.log(`✅ تم إنشاء حساب بنجاح باستخدام ${service.name}: ${result.email}`);
                    
                    // حفظ الحساب في الجلسة
                    if (!this.sessionAccounts.has(sessionId)) {
                        this.sessionAccounts.set(sessionId, []);
                    }
                    this.sessionAccounts.get(sessionId).push(result);
                    
                    return result;
                }
                
            } catch (error) {
                console.log(`⚠️ فشلت المحاولة ${attempt}: ${error.message}`);
                
                if (attempt === maxAttempts) {
                    if (this.currentServiceIndex < this.services.length - 1) {
                        console.log('🔄 تبديل الخدمة بعد فشل جميع المحاولات...');
                        this.currentServiceIndex++;
                        return await this.createAccount(sessionId);
                    }
                    throw new Error(`فشل في إنشاء حساب بعد ${maxAttempts} محاولات`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    async createAccountWithService(service) {
        if (service.name === 'mailtm') {
            return await this.createMailtmAccount();
        } else if (service.name === 'guerrillamail') {
            return await this.createGuerrillaAccount();
        } else if (service.name === 'temp-mail') {
            return await this.createTempMailAccount();
        } else {
            throw new Error(`الخدمة غير مدعومة: ${service.name}`);
        }
    }

    async createMailtmAccount() {
        const domain = this.getRandomDomain();
        const username = this.generateUsername();
        const email = `${username}@${domain}`;
        const password = this.generatePassword();

        try {
            console.log(`🔄 محاولة إنشاء حساب Mail.tm: ${email}`);

            const accountResponse = await axios.post('https://api.mail.tm/accounts', {
                address: email,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/ld+json'
                },
                timeout: 15000
            });

            if (accountResponse.status === 201) {
                console.log('✅ تم إنشاء حساب Mail.tm بنجاح');

                const tokenResponse = await axios.post('https://api.mail.tm/token', {
                    address: email,
                    password: password
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/ld+json'
                    },
                    timeout: 15000
                });

                if (tokenResponse.status === 200) {
                    console.log('✅ تم الحصول على توكن Mail.tm بنجاح');
                    
                    this.accountCache.set(email, {
                        id: accountResponse.data.id,
                        password: password,
                        token: tokenResponse.data.token,
                        service: 'mailtm',
                        createdAt: Date.now()
                    });

                    return {
                        success: true,
                        email: email,
                        password: password,
                        accountId: accountResponse.data.id,
                        token: tokenResponse.data.token,
                        service: 'mailtm'
                    };
                }
            }
            throw new Error('فشل في إنشاء الحساب');
        } catch (error) {
            console.error('❌ فشل في إنشاء حساب Mail.tm:', error.message);
            throw error;
        }
    }

    async createGuerrillaAccount() {
        try {
            console.log('🔄 محاولة إنشاء حساب GuerrillaMail...');

            const response = await axios.get('https://api.guerrillamail.com/ajax.php?f=get_email_address&lang=en', {
                timeout: 15000
            });

            if (response.data && response.data.email_addr) {
                console.log(`✅ تم إنشاء حساب GuerrillaMail: ${response.data.email_addr}`);
                
                return {
                    success: true,
                    email: response.data.email_addr,
                    password: 'not_required',
                    accountId: response.data.email_addr,
                    token: response.data.sid_token,
                    service: 'guerrillamail',
                    sid_token: response.data.sid_token
                };
            }
            throw new Error('فشل في إنشاء حساب GuerrillaMail');
        } catch (error) {
            console.error('❌ فشل في إنشاء حساب GuerrillaMail:', error.message);
            throw error;
        }
    }

    async createTempMailAccount() {
        try {
            console.log('🔄 محاولة إنشاء حساب TempMail...');
            const username = this.generateUsername();
            const domain = 'temp-mail.org';
            const email = `${username}@${domain}`;

            return {
                success: true,
                email: email,
                password: this.generatePassword(),
                accountId: email,
                token: 'temp_token',
                service: 'temp-mail'
            };
        } catch (error) {
            console.error('❌ فشل في إنشاء حساب TempMail:', error.message);
            throw error;
        }
    }

    async getMessages(accountInfo) {
        try {
            if (accountInfo.service === 'mailtm') {
                return await this.getMailtmMessages(accountInfo.token);
            } else if (accountInfo.service === 'guerrillamail') {
                return await this.getGuerrillaMessages(accountInfo.token || accountInfo.sid_token);
            } else if (accountInfo.service === 'temp-mail') {
                return await this.getTempMailMessages(accountInfo.email);
            }
        } catch (error) {
            console.error(`❌ فشل في جلب الرسائل من ${accountInfo.service}:`, error.message);
            return {
                'hydra:member': [],
                'hydra:totalItems': 0
            };
        }
    }

    async getMailtmMessages(token) {
        try {
            const response = await axios.get('https://api.mail.tm/messages', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 15000
            });

            if (response.status === 200) {
                const messages = response.data['hydra:member'] || [];
                console.log(`✅ تم جلب ${messages.length} رسالة من Mail.tm`);
                return response.data;
            }
            return { 'hydra:member': [], 'hydra:totalItems': 0 };
        } catch (error) {
            console.error('❌ فشل في جلب رسائل Mail.tm:', error.message);
            return { 'hydra:member': [], 'hydra:totalItems': 0 };
        }
    }

    async getGuerrillaMessages(sidToken) {
        try {
            const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`, {
                timeout: 15000
            });

            if (response.data && response.data.list) {
                const messages = response.data.list || [];
                console.log(`✅ تم جلب ${messages.length} رسالة من GuerrillaMail`);
                
                const formattedMessages = messages.map(msg => ({
                    id: msg.mail_id,
                    from: { name: msg.mail_from, address: msg.mail_from },
                    subject: msg.mail_subject || 'بدون عنوان',
                    text: msg.mail_excerpt || 'لا يوجد محتوى',
                    intro: msg.mail_excerpt || 'لا يوجد معاينة',
                    createdAt: new Date(msg.mail_timestamp * 1000).toISOString(),
                    seen: msg.mail_read === 1
                }));
                
                return {
                    'hydra:member': formattedMessages,
                    'hydra:totalItems': formattedMessages.length
                };
            }
            return { 'hydra:member': [], 'hydra:totalItems': 0 };
        } catch (error) {
            console.error('❌ فشل في جلب رسائل GuerrillaMail:', error.message);
            return { 'hydra:member': [], 'hydra:totalItems': 0 };
        }
    }

    async getTempMailMessages(email) {
        // محاكاة لرسائل تجريبية
        const sampleMessages = [
            {
                id: 'temp_1',
                from: { name: 'نظام التفعيل', address: 'noreply@example.com' },
                subject: 'تفعيل حسابك الجديد',
                text: 'مرحباً! لتفعيل حسابك، يرجى استخدام الرابط التالي: https://example.com/activate',
                intro: 'مرحباً! لتفعيل حسابك، يرجى استخدام الرابط التالي...',
                createdAt: new Date().toISOString(),
                seen: false
            },
            {
                id: 'temp_2',
                from: { name: 'فريق الدعم', address: 'support@example.com' },
                subject: 'مرحباً بك في خدمتنا',
                text: 'شكراً لانضمامك إلينا. نحن هنا لمساعدتك دائماً.',
                intro: 'شكراً لانضمامك إلينا. نحن هنا لمساعدتك دائماً.',
                createdAt: new Date(Date.now() - 300000).toISOString(),
                seen: true
            }
        ];

        return {
            'hydra:member': sampleMessages,
            'hydra:totalItems': sampleMessages.length
        };
    }

    async getMessage(accountInfo, messageId) {
        try {
            if (accountInfo.service === 'mailtm') {
                const response = await axios.get(`https://api.mail.tm/messages/${messageId}`, {
                    headers: {
                        'Authorization': `Bearer ${accountInfo.token}`,
                        'Accept': 'application/ld+json'
                    },
                    timeout: 15000
                });
                return response.data;
            } else if (accountInfo.service === 'guerrillamail') {
                const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${messageId}&sid_token=${accountInfo.token || accountInfo.sid_token}`, {
                    timeout: 15000
                });
                return response.data;
            } else if (accountInfo.service === 'temp-mail') {
                // رسالة تجريبية
                return {
                    id: messageId,
                    from: { name: 'مرسل تجريبي', address: 'sender@example.com' },
                    subject: 'رسالة تجريبية',
                    text: 'هذه رسالة تجريبية للمحتوى الكامل.',
                    html: '<p>هذه رسالة تجريبية للمحتوى الكامل.</p>',
                    createdAt: new Date().toISOString()
                };
            }
        } catch (error) {
            console.error(`❌ فشل في جلب الرسالة:`, error.message);
            throw error;
        }
    }

    getRandomDomain() {
        if (this.domains.length === 0) {
            return 'gmail.com';
        }
        const randomIndex = Math.floor(Math.random() * this.domains.length);
        return this.domains[randomIndex].domain;
    }

    generateUsername() {
        const adjectives = ['سريع', 'ذكي', 'خلاق', 'مبدع', 'قوي', 'هادئ', 'نشيط', 'دقيق', 'امين', 'مخلص'];
        const nouns = ['أسد', 'نمر', 'صقر', 'بطل', 'فارس', 'قائد', 'مبتكر', 'مخترع', 'باحث', 'عالم'];
        const numbers = Math.floor(1000 + Math.random() * 9000);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}_${noun}_${numbers}`;
    }

    generatePassword() {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }

    getSessionAccounts(sessionId) {
        return this.sessionAccounts.get(sessionId) || [];
    }

    getServiceStatus() {
        const currentService = this.getCurrentService();
        return {
            currentService: currentService.name,
            domains: this.domains.length,
            availableServices: this.services.filter(s => s.active).map(s => s.name),
            status: 'active'
        };
    }

    rotateService() {
        if (this.services.length > 1) {
            this.currentServiceIndex = (this.currentServiceIndex + 1) % this.services.length;
            const newService = this.getCurrentService();
            console.log(`🔄 تم التبديل إلى خدمة: ${newService.name}`);
            this.loadDomains();
            return newService.name;
        }
        return this.getCurrentService().name;
    }
}

module.exports = new SmartEmailService();
