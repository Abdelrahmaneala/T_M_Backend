class HackMailPro {
    constructor() {
        this.baseURL = window.location.origin;
        this.sessionId = this.generateSessionId();
        this.currentAccount = null;
        this.autoRefresh = true;
        this.refreshInterval = null;
        
        this.init();
    }

    init() {
        this.log('نظام HackMail Pro جاهز للتشغيل', 'success');
        this.updateConnectionStatus();
        this.loadServiceStatus();
        
        // تحديث تلقائي كل 15 ثانية
        this.startAutoRefresh();
        
        // تحميل الحسابات النشطة
        this.loadSessionAccounts();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async apiCall(endpoint, options = {}) {
        this.showLoading();
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();
            this.hideLoading();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            this.hideLoading();
            this.log(`خطأ في الاتصال: ${error.message}`, 'error');
            throw error;
        }
    }

    async createEmail(service = 'mailtm') {
        try {
            this.log(`جاري إنشاء إيميل جديد باستخدام ${service}...`, 'info');
            
            const result = await this.apiCall('/api/email/create', {
                method: 'POST',
                body: JSON.stringify({ 
                    sessionId: this.sessionId,
                    service: service 
                })
            });

            if (result.success) {
                this.log(`✅ تم إنشاء الإيميل: ${result.email}`, 'success');
                this.currentAccount = {
                    email: result.email,
                    accountId: result.accountId,
                    service: result.service,
                    token: result.token
                };
                this.updateAccountsList();
                this.updateServiceStatus();
                this.autoRefresh = true;
                
                // عرض تفاصيل الحساب
                document.getElementById('output').innerHTML = `
                    <div class="account-details">
                        <h3>✅ تم إنشاء الإيميل بنجاح</h3>
                        <p><strong>الإيميل:</strong> ${result.email}</p>
                        <p><strong>الخدمة:</strong> ${result.service}</p>
                        <p><strong>كلمة المرور:</strong> ${result.password}</p>
                        <p><strong>انتهاء الصلاحية:</strong> ${new Date(result.expiresAt).toLocaleString('ar-EG')}</p>
                        <button class="btn btn-primary" onclick="copyToClipboard('${result.email}')">
                            نسخ الإيميل
                        </button>
                        <button class="btn" onclick="checkMessages()">
                            فحص الرسائل
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            this.log(`❌ فشل في إنشاء الإيميل: ${error.message}`, 'error');
            
            // حاول مع خدمة أخرى في حالة الفشل
            if (service === 'mailtm') {
                this.log('🔄 جرب مع GuerrillaMail...', 'warning');
                await this.createEmail('guerrillamail');
            }
        }
    }

    async checkMessages() {
        if (!this.currentAccount) {
            this.log('⚠️ لا يوجد حساب نشط', 'warning');
            return;
        }

        try {
            this.log('جاري التحقق من الرسائل...', 'info');
            
            const result = await this.apiCall(
                `/api/email/messages?accountId=${this.currentAccount.email}&service=${this.currentAccount.service}`
            );
            
            if (result.success) {
                this.updateMessagesList(result.messages);
                this.log(`✅ تم تحديث الرسائل: ${result.messages.length} رسالة`, 'success');
                
                if (result.accountReplaced) {
                    this.log(`🔄 تم استبدال الحساب تلقائياً بـ: ${result.email}`, 'warning');
                    this.currentAccount.email = result.email;
                    this.updateAccountsList();
                }
            }
        } catch (error) {
            this.log(`❌ فشل في جلب الرسائل: ${error.message}`, 'error');
        }
    }

    async rotateService() {
        try {
            this.log('جاري تبديل الخدمة...', 'info');
            
            const result = await this.apiCall('/api/email/services/rotate', {
                method: 'POST'
            });

            if (result.success) {
                this.log(`✅ ${result.message}`, 'success');
                this.updateServiceStatus();
            }
        } catch (error) {
            this.log(`❌ فشل في تبديل الخدمة: ${error.message}`, 'error');
        }
    }

    async resetSystem() {
        try {
            this.log('جاري إعادة تعيين النظام...', 'warning');
            
            const result = await this.apiCall('/api/email/services/reset', {
                method: 'POST'
            });

            if (result.success) {
                this.log(`✅ ${result.message}`, 'success');
                this.currentAccount = null;
                this.updateAccountsList();
                this.updateMessagesList([]);
                this.updateServiceStatus();
                this.loadSessionAccounts();
            }
        } catch (error) {
            this.log(`❌ فشل في إعادة التعيين: ${error.message}`, 'error');
        }
    }

    async loadServiceStatus() {
        try {
            const result = await this.apiCall('/api/email/services/status');
            
            if (result.success) {
                document.getElementById('currentService').textContent = 'mailtm';
                this.updateConnectionStatus('online');
                
                // تحديث حالة الخدمات في الواجهة
                this.updateServicesStatus(result.services);
            }
        } catch (error) {
            this.updateConnectionStatus('offline');
        }
    }

    async loadSessionAccounts() {
        try {
            const result = await this.apiCall(`/api/email/session/${this.sessionId}`);
            if (result.success && result.accounts.length > 0) {
                this.currentAccount = {
                    email: result.accounts[0].email,
                    service: result.accounts[0].service
                };
                this.updateAccountsList();
                this.checkMessages(); // جلب الرسائل تلقائياً
            }
        } catch (error) {
            console.log('No active accounts in session');
        }
    }

    updateServicesStatus(services) {
        const statusElement = document.getElementById('servicesStatus');
        if (statusElement) {
            let statusHTML = '';
            for (const [service, status] of Object.entries(services)) {
                statusHTML += `<span class="service-status ${status}">${service}: ${status}</span> `;
            }
            statusElement.innerHTML = statusHTML;
        }
    }

    updateAccountsList() {
        const accountsList = document.getElementById('accountsList');
        const accountsCount = document.getElementById('accountsCount');
        
        if (!this.currentAccount) {
            accountsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد حسابات نشطة</p>
                </div>
            `;
            accountsCount.textContent = '0';
            return;
        }

        accountsList.innerHTML = `
            <div class="account-item">
                <div class="account-header">
                    <span class="account-email">${this.currentAccount.email}</span>
                    <span class="account-service">${this.currentAccount.service}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${this.currentAccount.email}')">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="account-info">
                    <small>الخدمة: ${this.currentAccount.service}</small>
                    <button class="btn btn-small" onclick="deleteAccount('${this.currentAccount.email}')">
                        حذف
                    </button>
                </div>
            </div>
        `;
        accountsCount.textContent = '1';
    }

    updateMessagesList(messages) {
        const messagesList = document.getElementById('messagesList');
        const messagesCount = document.getElementById('messagesCount');
        
        if (!messages || messages.length === 0) {
            messagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <p>لا توجد رسائل جديدة</p>
                </div>
            `;
            messagesCount.textContent = '0';
            return;
        }

        messagesList.innerHTML = messages.map(message => `
            <div class="message-item ${message.unread ? 'message-unread' : ''}">
                <div class="message-header">
                    <strong class="message-subject">${message.subject}</strong>
                    <small>${message.date}</small>
                </div>
                <div class="message-preview">${message.preview}</div>
                <div class="message-sender">
                    <small>من: ${message.sender}</small>
                </div>
                <div class="message-actions">
                    <button class="btn btn-small" onclick="viewMessage('${message.id}')">
                        عرض
                    </button>
                </div>
            </div>
        `).join('');
        
        messagesCount.textContent = messages.length.toString();
    }

    async viewMessage(messageId) {
        if (!this.currentAccount) return;
        
        try {
            const result = await this.apiCall(
                `/api/email/messages/${messageId}?accountId=${this.currentAccount.email}&service=${this.currentAccount.service}`
            );
            
            if (result.success) {
                document.getElementById('output').innerHTML = `
                    <div class="message-details">
                        <h3>${result.message.subject}</h3>
                        <p><strong>من:</strong> ${result.message.sender}</p>
                        <p><strong>التاريخ:</strong> ${result.message.date}</p>
                        <div class="message-content">
                            ${result.message.content || result.message.mail_body || 'لا يوجد محتوى'}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            this.log(`❌ فشل في عرض الرسالة: ${error.message}`, 'error');
        }
    }

    async deleteAccount(email) {
        try {
            const result = await this.apiCall(`/api/email/${email}`, {
                method: 'DELETE'
            });
            
            if (result.success) {
                this.log(`✅ ${result.message}`, 'success');
                this.currentAccount = null;
                this.updateAccountsList();
                this.updateMessagesList([]);
            }
        } catch (error) {
            this.log(`❌ فشل في حذف الحساب: ${error.message}`, 'error');
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(() => {
            if (this.autoRefresh && this.currentAccount) {
                this.checkMessages();
            }
        }, 15000); // تحديث كل 15 ثانية
    }

    updateConnectionStatus(status = 'online') {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status === 'online' ? 'متصل' : 'غير متصل';
            statusElement.className = status === 'online' ? 'status-online' : 'status-offline';
        }
    }

    updateServiceStatus() {
        if (this.currentAccount) {
            document.getElementById('currentService').textContent = this.currentAccount.service;
        }
    }

    log(message, type = 'info') {
        const consoleOutput = document.getElementById('consoleOutput');
        const timestamp = new Date().toLocaleTimeString('ar-EG');
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            ${message}
        `;
        
        consoleOutput.appendChild(logEntry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

// الدوال العامة للاستخدام في الأزرار
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        hackmail.log('تم نسخ الإيميل إلى الحافظة', 'success');
    }).catch(err => {
        hackmail.log('فشل في النسخ', 'error');
    });
}

function createEmail(service = 'mailtm') {
    hackmail.createEmail(service);
}

function checkMessages() {
    hackmail.checkMessages();
}

function rotateService() {
    hackmail.rotateService();
}

function resetSystem() {
    if (confirm('هل أنت متأكد من إعادة تعيين النظام؟ سيتم حذف جميع الحسابات.')) {
        hackmail.resetSystem();
    }
}

function viewMessage(messageId) {
    hackmail.viewMessage(messageId);
}

function deleteAccount(email) {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
        hackmail.deleteAccount(email);
    }
}

// تهيئة النظام عند تحميل الصفحة
let hackmail;
document.addEventListener('DOMContentLoaded', () => {
    hackmail = new HackMailPro();
});

// تحديث الحالة كل 30 ثانية
setInterval(() => {
    if (hackmail) {
        hackmail.loadServiceStatus();
    }
}, 30000);
