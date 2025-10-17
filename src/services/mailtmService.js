const axios = require('axios');
const config = require('../../config');

class ReliableEmailService {
    constructor() {
        this.baseURL = 'https://api.mail.tm';
        this.domains = [];
        this.currentDomain = '';
        this.accountCache = new Map(); // تخزين مؤقت للحسابات النشطة
    }

    async initialize() {
        try {
            await this.loadDomains();
            console.log('✅ خدمة البريد initialized بنجاح');
            return true;
        } catch (error) {
            console.error('❌ فشل في تهيئة خدمة البريد:', error.message);
            return false;
        }
    }

    async loadDomains() {
        try {
            console.log('🔄 جاري تحميل النطاقات من Mail.tm...');
            const response = await axios.get(`${this.baseURL}/domains`, {
                timeout: 15000
            });
            
            this.domains = response.data['hydra:member'] || [];
            
            if (this.domains.length === 0) {
                throw new Error('لا توجد نطاقات متاحة');
            }
            
            this.currentDomain = this.domains[0].domain;
            console.log(`✅ تم تحميل ${this.domains.length} نطاق`);
            return this.domains;
            
        } catch (error) {
            console.error('❌ فشل في تحميل النطاقات:', error.message);
            
            // نطاقات احتياطية
            this.domains = [
                { domain: 'tiffincrane.com' },
                { domain: 'mail.tm' },
                { domain: 'bugfoo.com' },
                { domain: 'dcctb.com' }
            ];
            this.currentDomain = 'tiffincrane.com';
            
            console.log('🔄 استخدام النطاقات الاحتياطية');
            return this.domains;
        }
    }

    async createAccount(email, password) {
        try {
            console.log(`🔄 إنشاء حساب جديد: ${email}`);

            const response = await axios.post(`${this.baseURL}/accounts`, {
                address: email,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/ld+json'
                },
                timeout: 20000,
                validateStatus: function (status) {
                    return status < 500; // تقبل كل الحالات أقل من 500
                }
            });

            if (response.status === 201) {
                console.log('✅ تم إنشاء الحساب بنجاح:', response.data.id);
                
                // تخزين في الكاش
                this.accountCache.set(email, {
                    id: response.data.id,
                    password: password,
                    createdAt: Date.now()
                });
                
                return response.data;
            } else if (response.status === 422) {
                // البريد مستخدم مسبقاً
                throw new Error('البريد الإلكتروني مستخدم بالفعل، جاري إنشاء بريد جديد...');
            } else {
                throw new Error(`فشل في إنشاء الحساب: ${response.status} - ${JSON.stringify(response.data)}`);
            }

        } catch (error) {
            console.error('❌ فشل في إنشاء الحساب:', error.message);
            
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                throw new Error('خدمة Mail.tm غير متاحة حالياً. يرجى المحاولة لاحقاً.');
            }
            
            throw error;
        }
    }

    async getToken(email, password) {
        try {
            console.log(`🔄 جاري الحصول على التوكن لـ: ${email}`);

            const response = await axios.post(`${this.baseURL}/token`, {
                address: email,
                password: password
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/ld+json'
                },
                timeout: 15000,
                validateStatus: function (status) {
                    return status < 500;
                }
            });

            if (response.status === 200) {
                console.log('✅ تم الحصول على التوكن بنجاح');
                return response.data;
            } else if (response.status === 401) {
                throw new Error('بيانات الاعتماد غير صحيحة - الحساب قد انتهى أو كلمة المرور خاطئة');
            } else {
                throw new Error(`فشل في الحصول على التوكن: ${response.status} - ${JSON.stringify(response.data)}`);
            }

        } catch (error) {
            console.error('❌ فشل في الحصول على التوكن:', error.message);
            
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                throw new Error('خدمة Mail.tm غير متاحة حالياً.');
            }
            
            throw error;
        }
    }

    async getMessages(token) {
        try {
            console.log('🔄 جاري جلب الرسائل...');

            const response = await axios.get(`${this.baseURL}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 15000,
                validateStatus: function (status) {
                    return status < 500;
                }
            });

            if (response.status === 200) {
                const messages = response.data['hydra:member'] || [];
                console.log(`✅ تم جلب ${messages.length} رسالة`);
                return response.data;
            } else if (response.status === 401) {
                throw new Error('التوكن منتهي الصلاحية أو غير صالح');
            } else {
                throw new Error(`فشل في جلب الرسائل: ${response.status}`);
            }

        } catch (error) {
            console.error('❌ فشل في جلب الرسائل:', error.message);
            throw error;
        }
    }

    async getMessage(token, messageId) {
        try {
            console.log(`🔄 جاري جلب الرسالة: ${messageId}`);

            const response = await axios.get(`${this.baseURL}/messages/${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 15000
            });

            console.log('✅ تم جلب الرسالة بنجاح');
            return response.data;

        } catch (error) {
            console.error('❌ فشل في جلب الرسالة:', error.message);
            throw new Error(`فشل في جلب الرسالة: ${error.message}`);
        }
    }

    async getDomain() {
        if (this.domains.length === 0) {
            await this.loadDomains();
        }
        
        // اختيار نطاق عشوائي
        const randomIndex = Math.floor(Math.random() * this.domains.length);
        return this.domains[randomIndex].domain;
    }

    async validateToken(token) {
        try {
            const response = await axios.get(`${this.baseURL}/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/ld+json'
                },
                timeout: 10000
            });
            
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async checkAccountStatus(email, password) {
        try {
            const tokenData = await this.getToken(email, password);
            return {
                valid: true,
                token: tokenData.token
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // إنشاء إيميل وكلمة مرور تلقائياً
    async createAutoAccount() {
        const maxAttempts = 5;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`🔄 المحاولة ${attempt} لإنشاء حساب تلقائي...`);
                
                const domain = await this.getDomain();
                const username = this.generateUsername();
                const email = `${username}@${domain}`;
                const password = this.generatePassword();
                
                console.log(`🔄 محاولة إنشاء: ${email}`);
                
                const accountData = await this.createAccount(email, password);
                const tokenData = await this.getToken(email, password);
                
                if (accountData && tokenData) {
                    console.log(`✅ تم إنشاء حساب تلقائي بنجاح: ${email}`);
                    return {
                        success: true,
                        email: email,
                        password: password,
                        accountId: accountData.id,
                        token: tokenData.token
                    };
                }
                
            } catch (error) {
                console.log(`⚠️ فشلت المحاولة ${attempt}: ${error.message}`);
                
                if (attempt === maxAttempts) {
                    throw new Error(`فشل في إنشاء حساب بعد ${maxAttempts} محاولات`);
                }
                
                // انتظار قبل المحاولة التالية
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        throw new Error('فشل في إنشاء حساب تلقائي');
    }

    generateUsername() {
        const adjectives = ['quick', 'bold', 'calm', 'deep', 'fair', 'grand', 'high', 'just', 'keen'];
        const nouns = ['fox', 'wolf', 'eagle', 'lion', 'bear', 'hawk', 'deer', 'fish', 'owl'];
        const numbers = Math.floor(100 + Math.random() * 900);
        
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        
        return `${adjective}${noun}${numbers}`;
    }

    generatePassword() {
        const length = 16;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        
        return password;
    }

    // الحصول على حالة الخدمة
    getServiceStatus() {
        return {
            domains: this.domains.length,
            currentDomain: this.currentDomain,
            cachedAccounts: this.accountCache.size,
            status: this.domains.length > 0 ? 'active' : 'inactive'
        };
    }
}

module.exports = new ReliableEmailService();