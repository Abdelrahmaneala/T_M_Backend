const axios = require('axios');

class SmartEmailService {
    constructor() {
        this.services = [
            { name: 'mailtm', baseURL: 'https://api.mail.tm', active: true },
            { name: 'guerrillamail', baseURL: 'https://api.guerrillamail.com', active: true }
        ];
        this.currentServiceIndex = 0;
        this.domains = [];
        this.accountCache = new Map();
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
            return false;
        }
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
            }
            
            if (this.domains.length === 0) {
                throw new Error('لا توجد نطاقات متاحة');
            }
            
            console.log(`✅ تم تحميل ${this.domains.length} نطاق من ${service.name}`);
            return this.domains;
            
        } catch (error) {
            console.error(`❌ فشل في تحميل النطاقات من ${service.name}:`, error.message);
            
            this.domains = [
                { domain: 'tiffincrane.com' },
                { domain: 'mail.tm' },
                { domain: 'guerrillamail.com' },
                { domain: 'grr.la' }
            ];
            
            console.log('🔄 استخدام النطاقات الاحتياطية');
            return this.domains;
        }
    }

    async createAccount() {
        const maxAttempts = 3;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 المحاولة ${attempt} لإنشاء حساب...`);
                
                const service = this.getCurrentService();
                console.log(`🔄 استخدام خدمة: ${service.name}`);
                
                const result = await this.createAccountWithService(service);
                
                if (result.success) {
                    console.log(`✅ تم إنشاء حساب بنجاح باستخدام ${service.name}: ${result.email}`);
                    return result;
                }
                
            } catch (error) {
                console.log(`⚠️ فشلت المحاولة ${attempt}: ${error.message}`);
                
                if (attempt === maxAttempts) {
                    if (this.currentServiceIndex < this.services.length - 1) {
                        console.log('🔄 تبديل الخدمة بعد فشل جميع المحاولات...');
                        this.currentServiceIndex++;
                        return await this.createAccount();
                    }
                    throw new Error(`فشل في إنشاء حساب بعد ${maxAttempts} محاولات`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        throw new Error('فشل في إنشاء حساب');
    }

    async createAccountWithService(service) {
        if (service.name === 'mailtm') {
            return await this.createMailtmAccount();
        } else if (service.name === 'guerrillamail') {
            return await this.createGuerrillaAccount();
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
                timeout: 15000,
                validateStatus: (status) => status < 500
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
                    timeout: 15000,
                    validateStatus: (status) => status < 500
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
                } else {
                    throw new Error(`فشل في الحصول على التوكن: ${tokenResponse.status}`);
                }
            } else if (accountResponse.status === 422) {
                throw new Error('البريد الإلكتروني مستخدم بالفعل');
            } else {
                throw new Error(`فشل في إنشاء الحساب: ${accountResponse.status}`);
            }

        } catch (error) {
            console.error('❌ فشل في إنشاء حساب Mail.tm:', error.message);
            
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                throw new Error('خدمة Mail.tm غير متاحة حالياً');
            }
            
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
            } else {
                throw new Error('فشل في إنشاء حساب GuerrillaMail - لا يوجد رد');
            }

        } catch (error) {
            console.error('❌ فشل في إنشاء حساب GuerrillaMail:', error.message);
            throw new Error(`فشل في إنشاء حساب GuerrillaMail: ${error.message}`);
        }
    }

    async getMessages(accountInfo) {
        try {
            if (accountInfo.service === 'mailtm') {
                return await this.getMailtmMessages(accountInfo.token);
            } else if (accountInfo.service === 'guerrillamail') {
                return await this.getGuerrillaMessages(accountInfo.token || accountInfo.sid_token);
            } else {
                throw new Error(`الخدمة غير مدعومة: ${accountInfo.service}`);
            }
        } catch (error) {
            console.error(`❌ فشل في جلب الرسائل من ${accountInfo.service}:`, error.message);
            
            if (error.response?.status === 401 || error.message.includes('401') || error.message.includes('Unauthorized')) {
                console.log('🔄 الحساب منتهي الصلاحية، سيتم تبديل الخدمة...');
                this.rotateService();
                throw new Error('انتهت صلاحية الحساب، تم تبديل الخدمة تلقائياً');
            }
            
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.log(`⚠️ ${accountInfo.service} غير متاح مؤقتاً`);
                return {
                    'hydra:member': [],
                    'hydra:totalItems': 0
                };
            }
            
            throw error;
        }
    }

    async getMailtmMessages(token) {
        console.log('🔄 جاري جلب الرسائل من Mail.tm...');

        try {
            const response = await axios.get('https://api.mail.tm/messages', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 15000,
                validateStatus: (status) => status < 500
            });

            if (response.status === 200) {
                const messages = response.data['hydra:member'] || [];
                console.log(`✅ تم جلب ${messages.length} رسالة من Mail.tm`);
                return response.data;
            } else if (response.status === 401) {
                throw new Error('التوكن منتهي الصلاحية - 401 Unauthorized');
            } else {
                console.log(`⚠️ استجابة غير متوقعة من Mail.tm: ${response.status}`);
                return {
                    'hydra:member': [],
                    'hydra:totalItems': 0
                };
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                console.log('⚠️ Mail.tm غير متاح حالياً');
                return {
                    'hydra:member': [],
                    'hydra:totalItems': 0
                };
            }
            throw error;
        }
    }

    async getGuerrillaMessages(sidToken) {
        console.log('🔄 جاري جلب الرسائل من GuerrillaMail...');

        try {
            const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`, {
                timeout: 15000
            });

            if (response.data && response.data.list) {
                const messages = response.data.list || [];
                console.log(`✅ تم جلب ${messages.length} رسالة من GuerrillaMail`);
                
                const formattedMessages = messages.map(msg => ({
                    id: msg.mail_id,
                    from: {
                        name: msg.mail_from,
                        address: msg.mail_from
                    },
                    subject: msg.mail_subject || 'بدون عنوان',
                    text: msg.mail_body || 'لا يوجد محتوى',
                    mail_body: msg.mail_body || 'لا يوجد محتوى',
                    intro: msg.mail_excerpt || 'لا يوجد معاينة',
                    mail_excerpt: msg.mail_excerpt || 'لا يوجد معاينة',
                    createdAt: new Date(msg.mail_timestamp * 1000).toISOString(),
                    mail_timestamp: msg.mail_timestamp,
                    seen: msg.mail_read === 1,
                    mail_read: msg.mail_read
                }));
                
                return {
                    'hydra:member': formattedMessages,
                    'hydra:totalItems': formattedMessages.length
                };
            } else {
                console.log('⚠️ لا توجد رسائل من GuerrillaMail');
                return {
                    'hydra:member': [],
                    'hydra:totalItems': 0
                };
            }
        } catch (error) {
            console.error('❌ خطأ في جلب رسائل GuerrillaMail:', error.message);
            return {
                'hydra:member': [],
                'hydra:totalItems': 0
            };
        }
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
                
                console.log('✅ تم جلب الرسالة الكاملة من Mail.tm');
                return response.data;
                
            } else if (accountInfo.service === 'guerrillamail') {
                const response = await axios.get(`https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${messageId}&sid_token=${accountInfo.token || accountInfo.sid_token}`, {
                    timeout: 15000
                });
                
                console.log('✅ تم جلب الرسالة الكاملة من GuerrillaMail');
                return response.data;
            }
        } catch (error) {
            console.error(`❌ فشل في جلب الرسالة الكاملة من ${accountInfo.service}:`, error.message);
            throw error;
        }
    }

    async validateAccount(accountInfo) {
        try {
            if (accountInfo.service === 'mailtm') {
                const response = await axios.get('https://api.mail.tm/me', {
                    headers: {
                        'Authorization': `Bearer ${accountInfo.token}`,
                        'Accept': 'application/ld+json'
                    },
                    timeout: 10000
                });
                return response.status === 200;
            } else if (accountInfo.service === 'guerrillamail') {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    getRandomDomain() {
        if (this.domains.length === 0) {
            return 'tiffincrane.com';
        }
        const randomIndex = Math.floor(Math.random() * this.domains.length);
        return this.domains[randomIndex].domain;
    }

    generateUsername() {
        const adjectives = ['quick', 'bold', 'calm', 'deep', 'fair', 'grand', 'high', 'just', 'keen', 'lucky'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'bear', 'hawk', 'deer', 'fish', 'owl', 'bird'];
        const numbers = Math.floor(100 + Math.random() * 900);
        
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
