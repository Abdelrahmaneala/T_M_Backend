class HackMailPro {
    constructor() {
        this.baseURL = window.location.origin;
        this.sessionId = this.generateSessionId();
        this.currentAccount = null;
        this.autoRefresh = false;
        
        this.init();
    }

    init() {
        this.log('نظام HackMail Pro جاهز للتشغيل', 'success');
        this.updateConnectionStatus();
        this.loadServiceStatus();
        
        // تحديث تلقائي كل 30 ثانية
        setInterval(() => {
            if (this.autoRefresh && this.currentAccount) {
                this.checkMessages();
            }
        }, 30000);
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

    async createEmail() {
        try {
            this.log('جاري إنشاء إيميل جديد...', 'info');
            
            const result = await this.apiCall('/api/email/create', {
                method: 'POST',
                body: JSON.stringify({ sessionId: this.sessionId })
            });

            if (result.success) {
                this.log(`✅ تم إنشاء الإيميل: ${result.email}`, 'success');
                this.currentAccount = result;
                this.updateAccountsList();
                this.updateServiceStatus();
                this.autoRefresh = true;
            }
        } catch (error) {
            this.log(`❌ فشل في إنشاء الإيميل: ${error.message}`, 'error');
        }
    }

    async checkMessages() {
        if (!this.currentAccount) {
            this.log('⚠️ لا يوجد حساب نشط', 'warning');
            return;
        }

        try {
            this.log('جاري التحقق من الرسائل...', 'info');
            
            const result = await this.apiCall(`/api/email/messages?accountId=${this.currentAccount.accountId}`);
            
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
                this.log(`✅ تم التبديل إلى خدمة: ${result.currentService}`, 'success');
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
                this.log('✅ تم إعادة تعيين النظام بنجاح', 'success');
                this.currentAccount = null;
                this.updateAccountsList();
                this.updateMessagesList([]);
                this.updateServiceStatus();
            }
        } catch (error) {
            this.log(`❌ فشل في إعادة التعيين: ${error.message}`, 'error');
        }
    }

    async loadServiceStatus() {
        try {
            const result = await this.apiCall('/api/email/services/status');
            
            if (result.success) {
                document.getElementById('currentService').textContent = result.currentService;
                this.updateConnectionStatus('online');
            }
        } catch (error) {
            this.updateConnectionStatus('offline');
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
                    <small>تم الإنشاء: ${new Date().toLocaleString('ar-EG')}</small>
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
            </div>
        `).join('');
        
        messagesCount.textContent = messages.length.toString();
    }

    updateConnectionStatus(status = 'online') {
        const statusElement = document.getElementById('connectionStatus');
        statusElement.textContent = status === 'online' ? 'متصل' : 'غير متصل';
        statusElement.className = status === 'online' ? 'status-online' : 'status-offline';
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

function createEmail() {
    hackmail.createEmail();
}

function checkMessages() {
    hackmail.checkMessages();
}

function rotateService() {
    hackmail.rotateService();
}

function resetSystem() {
    if (confirm('هل أنت متأكد من إعادة تعيين النظام؟')) {
        hackmail.resetSystem();
    }
}

// تهيئة النظام عند تحميل الصفحة
let hackmail;
document.addEventListener('DOMContentLoaded', () => {
    hackmail = new HackMailPro();
});

// تحديث الحالة كل 10 ثوان
setInterval(() => {
    if (hackmail) {
        hackmail.loadServiceStatus();
    }
}, 10000);