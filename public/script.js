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
        
        // تحديث تلقائي كل 20 ثانية
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

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.hideLoading();
            
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
                this.showAccountDetails(result);
            }
        } catch (error) {
            this.log(`❌ فشل في إنشاء الإيميل: ${error.message}`, 'error');
            
            // حاول مع خدمة أخرى في حالة الفشل
            if (service === 'mailtm') {
                this.log('🔄 جرب مع GuerrillaMail...', 'warning');
                await this.createEmail('guerrillamail');
            } else if (service === 'guerrillamail') {
                this.log('🔄 جرب مع TempMail...', 'warning');
                await this.createEmail('tempMail');
            }
        }
    }

    showAccountDetails(result) {
        const outputElement = document.getElementById('output');
        if (outputElement) {
            outputElement.innerHTML = `
                <div class="account-details">
                    <h3>✅ تم إنشاء الإيميل بنجاح</h3>
                    <div class="account-info">
                        <p><strong>📧 الإيميل:</strong> ${result.email}</p>
                        <p><strong>🛠️ الخدمة:</strong> ${result.service}</p>
                        <p><strong>🔐 كلمة المرور:</strong> ${result.password}</p>
                        <p><strong>⏰ انتهاء الصلاحية:</strong> ${new Date(result.expiresAt).toLocaleString('ar-EG')}</p>
                    </div>
                    <div class="account-actions">
                        <button class="btn btn-primary" onclick="copyToClipboard('${result.email}')">
                            📋 نسخ الإيميل
                        </button>
                        <button class="btn btn-success" onclick="checkMessages()">
                            📨 فحص الرسائل
                        </button>
                    </div>
                    <div class="account-tips">
                        <p><strong>💡 نصائح:</strong></p>
                        <ul>
                            <li>استخدم هذا الإيميل لتسجيل الحسابات المؤقتة</li>
                            <li>الرسائل تظهر تلقائياً خلال 20 ثانية</li>
                            <li>الإيميل صالح لمدة ساعتين</li>
                        </ul>
                    </div>
                </div>
            `;
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
                `/api/email/messages?accountId=${encodeURIComponent(this.currentAccount.email)}&service=${this.currentAccount.service}`
            );
            
            if (result.success) {
                this.updateMessagesList(result.messages);
                this.log(`✅ تم تحديث الرسائل: ${result.messages.length} رسالة`, 'success');
            }
        } catch (error) {
            this.log(`❌ فشل في جلب الرسائل: ${error.message}`, 'error');
        }
    }

    async loadServiceStatus() {
        try {
            const result = await this.apiCall('/api/email/services/status');
            
            if (result.success) {
                this.updateConnectionStatus('online');
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
                // جلب الرسائل تلقائياً بعد 3 ثواني
                setTimeout(() => this.checkMessages(), 3000);
            }
        } catch (error) {
            console.log('لا توجد حسابات نشطة في الجلسة');
        }
    }

    updateServicesStatus(services) {
        const statusElement = document.getElementById('servicesStatus');
        if (statusElement) {
            let statusHTML = '<div class="services-grid">';
            for (const [service, status] of Object.entries(services)) {
                const statusIcon = status === 'active' ? '✅' : '❌';
                statusHTML += `
                    <div class="service-status ${status}">
                        <span class="service-name">${service}</span>
                        <span class="service-indicator">${statusIcon} ${status}</span>
                    </div>
                `;
            }
            statusHTML += '</div>';
            statusElement.innerHTML = statusHTML;
        }
    }

    updateAccountsList() {
        const accountsList = document.getElementById('accountsList');
        const accountsCount = document.getElementById('accountsCount');
        
        if (!accountsList || !accountsCount) return;
        
        if (!this.currentAccount) {
            accountsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد حسابات نشطة</p>
                    <small>انقر على "إنشاء إيميل جديد" لبدء الاستخدام</small>
                </div>
            `;
            accountsCount.textContent = '0';
            return;
        }

        accountsList.innerHTML = `
            <div class="account-item active">
                <div class="account-header">
                    <span class="account-email">${this.currentAccount.email}</span>
                    <span class="account-service ${this.currentAccount.service}">${this.currentAccount.service}</span>
                </div>
                <div class="account-actions">
                    <button class="copy-btn" onclick="copyToClipboard('${this.currentAccount.email}')" title="نسخ الإيميل">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="refresh-btn" onclick="checkMessages()" title="تحديث الرسائل">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteAccount('${this.currentAccount.email}')" title="حذف الحساب">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        accountsCount.textContent = '1';
    }

    updateMessagesList(messages) {
        const messagesList = document.getElementById('messagesList');
        const messagesCount = document.getElementById('messagesCount');
        
        if (!messagesList || !messagesCount) return;
        
        if (!messages || messages.length === 0) {
            messagesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-envelope-open"></i>
                    <p>لا توجد رسائل جديدة</p>
                    <small>سيتم فحص الرسائل تلقائياً كل 20 ثانية</small>
                </div>
            `;
            messagesCount.textContent = '0';
            return;
        }

        messagesList.innerHTML = messages.map(message => `
            <div class="message-item ${message.unread ? 'unread' : ''}">
                <div class="message-icon">
                    <i class="fas fa-envelope${message.unread ? '' : '-open'}"></i>
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <strong class="message-subject">${message.subject}</strong>
                        <span class="message-date">${message.date}</span>
                    </div>
                    <div class="message-preview">${message.preview}</div>
                    <div class="message-sender">
                        <i class="fas fa-user"></i>
                        <span>${message.sender}</span>
                    </div>
                </div>
                <div class="message-actions">
                    <button class="btn btn-small" onclick="viewMessage('${message.id}')" title="عرض الرسالة">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        messagesCount.textContent = messages.length.toString();
        
        // إشعار إذا كانت هناك رسائل جديدة
        if (messages.length > 0) {
            this.log(`📬 لديك ${messages.length} رسالة جديدة`, 'success');
        }
    }

    async viewMessage(messageId) {
        if (!this.currentAccount) return;
        
        try {
            const result = await this.apiCall(
                `/api/email/messages/${messageId}?accountId=${encodeURIComponent(this.currentAccount.email)}&service=${this.currentAccount.service}`
            );
            
            if (result.success) {
                this.showMessageDetails(result.message);
            }
        } catch (error) {
            this.log(`❌ فشل في عرض الرسالة: ${error.message}`, 'error');
        }
    }

    showMessageDetails(message) {
        const outputElement = document.getElementById('output');
        if (outputElement) {
            const content = message.content || message.mail_body || message.text || 'لا يوجد محتوى';
            const sender = message.sender || message.mail_from || message.from?.address || 'غير معروف';
            const subject = message.subject || message.mail_subject || 'بدون عنوان';
            const date = message.date || new Date().toLocaleString('ar-EG');
            
            outputElement.innerHTML = `
                <div class="message-details">
                    <div class="message-header">
                        <h3>${subject}</h3>
                        <button class="btn btn-small" onclick="checkMessages()">
                            <i class="fas fa-arrow-left"></i> رجوع
                        </button>
                    </div>
                    <div class="message-meta">
                        <p><strong>👤 المرسل:</strong> ${sender}</p>
                        <p><strong>📅 التاريخ:</strong> ${date}</p>
                    </div>
                    <div class="message-body">
                        <pre>${content}</pre>
                    </div>
                    <div class="message-actions">
                        <button class="btn" onclick="copyToClipboard(\`${content}\`)">
                            <i class="fas fa-copy"></i> نسخ المحتوى
                        </button>
                    </div>
                </div>
            `;
        }
    }

    async deleteAccount(email) {
        try {
            const result = await this.apiCall(`/api/email/${encodeURIComponent(email)}`, {
                method: 'DELETE'
            });
            
            if (result.success) {
                this.log(`✅ ${result.message}`, 'success');
                this.currentAccount = null;
                this.updateAccountsList();
                this.updateMessagesList([]);
                
                // مسح منطقة الإخراج
                const outputElement = document.getElementById('output');
                if (outputElement) {
                    outputElement.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-trash"></i>
                            <p>تم حذف الحساب بنجاح</p>
                            <small>يمكنك إنشاء إيميل جديد عندما تحتاج</small>
                        </div>
                    `;
                }
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
        }, 20000); // تحديث كل 20 ثانية
    }

    updateConnectionStatus(status = 'online') {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status === 'online' ? '🟢 متصل' : '🔴 غير متصل';
            statusElement.className = `status-${status}`;
        }
    }

    updateServiceStatus() {
        if (this.currentAccount) {
            const currentServiceElement = document.getElementById('currentService');
            if (currentServiceElement) {
                currentServiceElement.textContent = this.currentAccount.service;
                currentServiceElement.className = `service-${this.currentAccount.service}`;
            }
        }
    }

    log(message, type = 'info') {
        const consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput) return;
        
        const timestamp = new Date().toLocaleTimeString('ar-EG');
        const typeIcon = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        }[type] || '📝';
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="type-icon">${typeIcon}</span>
            <span class="message">${message}</span>
        `;
        
        consoleOutput.appendChild(logEntry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
}

// الدوال العامة للاستخدام في الأزرار
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.hackmail) {
            window.hackmail.log('تم نسخ النص إلى الحافظة', 'success');
        }
        // إشعار مؤقت
        showTempNotification('تم النسخ إلى الحافظة!');
    }).catch(err => {
        if (window.hackmail) {
            window.hackmail.log('فشل في النسخ', 'error');
        }
    });
}

function showTempNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: #000;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        font-weight: bold;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function createEmail(service = 'mailtm') {
    if (window.hackmail) {
        window.hackmail.createEmail(service);
    }
}

function checkMessages() {
    if (window.hackmail) {
        window.hackmail.checkMessages();
    }
}

function rotateService() {
    if (window.hackmail) {
        window.hackmail.rotateService();
    }
}

function resetSystem() {
    if (confirm('هل أنت متأكد من إعادة تعيين النظام؟ سيتم حذف جميع الحسابات والرسائل.')) {
        if (window.hackmail) {
            window.hackmail.resetSystem();
        }
    }
}

function viewMessage(messageId) {
    if (window.hackmail) {
        window.hackmail.viewMessage(messageId);
    }
}

function deleteAccount(email) {
    if (confirm('هل أنت متأكد من حذف هذا الحساب؟ سيتم فقدان جميع الرسائل المرتبطة به.')) {
        if (window.hackmail) {
            window.hackmail.deleteAccount(email);
        }
    }
}

function selectService(service) {
    const buttons = document.querySelectorAll('.service-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    createEmail(service);
}

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    window.hackmail = new HackMailPro();
});

// تحديث الحالة كل دقيقة
setInterval(() => {
    if (window.hackmail) {
        window.hackmail.loadServiceStatus();
    }
}, 60000);
