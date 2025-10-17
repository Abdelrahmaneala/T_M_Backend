// file name: public/script.js
class HackMailPro {
    constructor() {
        this.baseURL = window.BASE_URL || window.location.origin;
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
            // إضافة timestamp لمنع التخزين المؤقت
            const timestamp = new Date().getTime();
            const url = endpoint.includes('?') 
                ? `${this.baseURL}${endpoint}&t=${timestamp}`
                : `${this.baseURL}${endpoint}?t=${timestamp}`;

            const response = await fetch(url, {
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

    async createEmail(service = 'auto') {
        try {
            this.log(`جاري إنشاء إيميل جديد...`, 'info');
            
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
                    token: result.token,
                    password: result.password
                };
                this.updateAccountsList();
                this.updateServiceStatus();
                this.autoRefresh = true;
                
                // عرض تفاصيل الحساب
                this.showAccountDetails(result);
                
                // جلب الرسائل تلقائياً بعد 3 ثواني
                setTimeout(() => this.checkMessages(), 3000);
            }
        } catch (error) {
            this.log(`❌ فشل في إنشاء الإيميل: ${error.message}`, 'error');
            
            // محاولة إنشاء إيميل احتياطي
            setTimeout(() => {
                this.log('🔄 محاولة إنشاء إيميل احتياطي...', 'warning');
                this.createEmail('auto');
            }, 2000);
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
                        <p><strong>🔐 كلمة المرور:</strong> ${result.password || 'غير مطلوبة'}</p>
                        <p><strong>🛠️ الخدمة:</strong> ${result.service}</p>
                        <p><strong>🌐 النطاق:</strong> ${result.email.split('@')[1]}</p>
                        <p><strong>⏰ انتهاء الصلاحية:</strong> ${result.expiresAt ? new Date(result.expiresAt).toLocaleString('ar-EG') : 'ساعتين'}</p>
                    </div>
                    <div class="account-actions">
                        <button class="btn btn-primary" onclick="copyToClipboard('${result.email}')">
                            📋 نسخ الإيميل
                        </button>
                        <button class="btn btn-success" onclick="checkMessages()">
                            📨 فحص الرسائل
                        </button>
                        <button class="btn btn-warning" onclick="createEmail('auto')">
                            🔄 إنشاء إيميل جديد
                        </button>
                    </div>
                    <div class="account-tips">
                        <p><strong>💡 نصائح للاستخدام:</strong></p>
                        <ul>
                            <li>انسخ الإيميل واستخدمه للتسجيل في أي منصة</li>
                            <li>الرسائل تظهر تلقائياً خلال 20 ثانية</li>
                            <li>يمكنك إنشاء multiple إيميلات في نفس الوقت</li>
                            <li>الإيميل صالح لمدة ساعتين من وقت الإنشاء</li>
                            <li>يعمل مع جميع المنصات: فيسبوك, جوجل, تويتر, انستجرام, etc.</li>
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
                `/api/email/messages?accountId=${encodeURIComponent(this.currentAccount.accountId)}&email=${encodeURIComponent(this.currentAccount.email)}&service=${this.currentAccount.service}`
            );
            
            if (result.success) {
                this.updateMessagesList(result.messages);
                this.log(`✅ تم تحديث الرسائل: ${result.messages.length} رسالة`, 'success');
                
                // إشعار إذا كانت هناك رسائل جديدة غير مقروءة
                const unreadMessages = result.messages.filter(msg => msg.unread);
                if (unreadMessages.length > 0) {
                    this.showNotification(`لديك ${unreadMessages.length} رسالة جديدة!`);
                }
            } else {
                this.log('⚠️ لا توجد رسائل جديدة', 'info');
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
                this.updateServicesStatus(result);
            } else {
                this.updateConnectionStatus('offline');
            }
        } catch (error) {
            this.updateConnectionStatus('offline');
            this.log('⚠️ لا يمكن الاتصال بالخادم', 'warning');
        }
    }

    async loadSessionAccounts() {
        try {
            const result = await this.apiCall(`/api/email/session/${this.sessionId}`);
            if (result.success && result.accounts.length > 0) {
                // استخدام آخر حساب تم إنشاؤه
                const lastAccount = result.accounts[0];
                this.currentAccount = {
                    email: lastAccount.email,
                    accountId: lastAccount.id,
                    service: lastAccount.service
                };
                this.updateAccountsList();
                
                this.log(`📧 تم استعادة الحساب: ${lastAccount.email}`, 'success');
                
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
            
            // عرض الخدمات المتاحة
            if (services.availableServices && services.availableServices.length > 0) {
                services.availableServices.forEach(service => {
                    const isActive = service === services.currentService;
                    statusHTML += `
                        <div class="service-status ${isActive ? 'active' : 'inactive'}">
                            <span class="service-name">${service}</span>
                            <span class="service-indicator">${isActive ? '✅' : '⚡'} ${isActive ? 'نشط' : 'احتياطي'}</span>
                        </div>
                    `;
                });
            } else {
                statusHTML += `
                    <div class="service-status active">
                        <span class="service-name">instant</span>
                        <span class="service-indicator">✅ نشط</span>
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
                <div class="account-meta">
                    <small>تم الإنشاء: ${new Date().toLocaleString('ar-EG')}</small>
                </div>
                <div class="account-actions">
                    <button class="copy-btn" onclick="copyToClipboard('${this.currentAccount.email}')" title="نسخ الإيميل">
                        <i class="fas fa-copy"></i> نسخ
                    </button>
                    <button class="refresh-btn" onclick="checkMessages()" title="تحديث الرسائل">
                        <i class="fas fa-sync"></i> تحديث
                    </button>
                    <button class="delete-btn" onclick="deleteAccount('${this.currentAccount.email}')" title="حذف الحساب">
                        <i class="fas fa-trash"></i> حذف
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
                    <br>
                    <small>استخدم الإيميل أعلاه للتسجيل في أي منصة وسيظهر رمز التفعيل هنا</small>
                </div>
            `;
            messagesCount.textContent = '0';
            return;
        }

        messagesList.innerHTML = messages.map(message => `
            <div class="message-item ${message.unread ? 'unread' : ''}" onclick="viewMessage('${message.id}')">
                <div class="message-icon">
                    <i class="fas fa-envelope${message.unread ? '' : '-open'}"></i>
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <strong class="message-subject">${message.subject || 'بدون عنوان'}</strong>
                        <span class="message-date">${message.date || new Date().toLocaleString('ar-EG')}</span>
                    </div>
                    <div class="message-preview">${message.preview || 'لا يوجد معاينة'}</div>
                    <div class="message-sender">
                        <i class="fas fa-user"></i>
                        <span>${message.sender || 'مرسل غير معروف'}</span>
                        ${message.unread ? '<span class="unread-badge">جديد</span>' : ''}
                    </div>
                </div>
                <div class="message-actions">
                    <button class="btn btn-small" onclick="event.stopPropagation(); viewMessage('${message.id}')" title="عرض الرسالة">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        messagesCount.textContent = messages.length.toString();
        
        // إشعار إذا كانت هناك رسائل جديدة
        const unreadCount = messages.filter(msg => msg.unread).length;
        if (unreadCount > 0) {
            this.log(`📬 لديك ${unreadCount} رسالة جديدة`, 'success');
            this.showNotification(`📨 ${unreadCount} رسالة جديدة!`);
        }
    }

    async viewMessage(messageId) {
        if (!this.currentAccount) return;
        
        try {
            this.showLoading();
            const result = await this.apiCall(
                `/api/email/messages/${messageId}?accountId=${encodeURIComponent(this.currentAccount.accountId)}&email=${encodeURIComponent(this.currentAccount.email)}&service=${this.currentAccount.service}`
            );
            
            if (result.success) {
                this.showMessageDetails(result.message);
            }
        } catch (error) {
            this.log(`❌ فشل في عرض الرسالة: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    showMessageDetails(message) {
        const outputElement = document.getElementById('output');
        if (outputElement) {
            const content = message.content || message.text || message.mail_body || 'لا يوجد محتوى';
            const sender = message.sender || message.from?.name || message.from?.address || message.mail_from || 'غير معروف';
            const subject = message.subject || message.mail_subject || 'بدون عنوان';
            const date = message.date || new Date().toLocaleString('ar-EG');
            
            outputElement.innerHTML = `
                <div class="message-details">
                    <div class="message-header">
                        <h3>${subject}</h3>
                        <button class="btn btn-small" onclick="checkMessages()">
                            <i class="fas fa-arrow-left"></i> رجوع للقائمة
                        </button>
                    </div>
                    <div class="message-meta">
                        <p><strong>👤 المرسل:</strong> ${sender}</p>
                        <p><strong>📅 التاريخ:</strong> ${date}</p>
                        <p><strong>📧 إلى:</strong> ${this.currentAccount?.email || 'غير معروف'}</p>
                    </div>
                    <div class="message-body">
                        <div class="message-content">
                            <pre>${content}</pre>
                        </div>
                    </div>
                    <div class="message-actions">
                        <button class="btn btn-primary" onclick="copyToClipboard(\`${content.replace(/`/g, '\\`')}\`)">
                            <i class="fas fa-copy"></i> نسخ المحتوى
                        </button>
                        <button class="btn" onclick="checkMessages()">
                            <i class="fas fa-sync"></i> تحديث الرسائل
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

    showNotification(message) {
        // إنشاء إشعار مؤقت
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-bell"></i>
                <span>${message}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
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
        
        // حفظ عدد محدود من السجلات
        const logs = consoleOutput.querySelectorAll('.log-entry');
        if (logs.length > 50) {
            logs[0].remove();
        }
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

    // دالة لإعادة تعيين النظام
    async resetSystem() {
        try {
            const result = await this.apiCall('/api/email/services/reset', {
                method: 'POST'
            });
            
            if (result.success) {
                this.log('✅ تم إعادة تعيين النظام بنجاح', 'success');
                this.currentAccount = null;
                this.updateAccountsList();
                this.updateMessagesList([]);
                
                const outputElement = document.getElementById('output');
                if (outputElement) {
                    outputElement.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-redo"></i>
                            <p>تم إعادة تعيين النظام</p>
                            <small>يمكنك إنشاء إيميل جديد الآن</small>
                        </div>
                    `;
                }
            }
        } catch (error) {
            this.log('❌ فشل في إعادة تعيين النظام', 'error');
        }
    }
}

// الدوال العامة للاستخدام في الأزرار
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.hackmail) {
            window.hackmail.log('تم نسخ النص إلى الحافظة', 'success');
        }
        showTempNotification('تم النسخ إلى الحافظة!');
    }).catch(err => {
        // طريقة بديلة للنسخ
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (window.hackmail) {
            window.hackmail.log('تم النسخ إلى الحافظة', 'success');
        }
        showTempNotification('تم النسخ إلى الحافظة!');
    });
}

function showTempNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'temp-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--success-color);
        color: #000;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: fadeInOut 3s ease-in-out;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function createEmail(service = 'auto') {
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

// إضافة أنيميشن للـ CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .unread-badge {
        background: var(--primary-color);
        color: #000;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
        margin-right: 8px;
    }
    
    .temp-notification {
        font-family: 'Tajawal', sans-serif;
    }
`;
document.head.appendChild(style);

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // تحديد الـ Base URL تلقائياً إذا لم يكن محدداً
    if (!window.BASE_URL) {
        window.BASE_URL = window.location.origin;
    }
    
    window.hackmail = new HackMailPro();
    
    // إضافة event listener لأزرار الخدمات
    const serviceButtons = document.querySelectorAll('.service-btn');
    serviceButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            serviceButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const service = this.getAttribute('data-service');
            createEmail(service);
        });
    });
});

// تحديث الحالة كل دقيقة
setInterval(() => {
    if (window.hackmail) {
        window.hackmail.loadServiceStatus();
    }
}, 60000);

// تحديث العنوان تلقائياً مع حالة الاتصال
setInterval(() => {
    if (window.hackmail && document.title) {
        const isOnline = document.getElementById('connectionStatus')?.textContent.includes('متصل');
        document.title = isOnline 
            ? 'HackMail Pro - نظام الإيميل المؤقت 🟢' 
            : 'HackMail Pro - نظام الإيميل المؤقت 🔴';
    }
}, 5000);
