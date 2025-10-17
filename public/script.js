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
        this.log('HackMail Pro System Ready', 'success');
        this.updateConnectionStatus();
        this.loadServiceStatus();
        
        // Auto refresh every 15 seconds
        this.startAutoRefresh();
        
        // Load active accounts
        this.loadSessionAccounts();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async apiCall(endpoint, options = {}) {
        this.showLoading();
        
        try {
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
            this.log(`Connection Error: ${error.message}`, 'error');
            throw error;
        }
    }

    async createEmail() {
        try {
            this.log(`Creating new REAL email...`, 'info');
            
            const result = await this.apiCall('/api/email/create', {
                method: 'POST',
                body: JSON.stringify({ 
                    sessionId: this.sessionId
                })
            });

            if (result.success) {
                this.log(`✅ Email Created: ${result.email}`, 'success');
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
                
                // Show account details
                this.showAccountDetails(result);
                
                // Auto check messages after 3 seconds
                setTimeout(() => this.checkMessages(), 3000);
            }
        } catch (error) {
            this.log(`❌ Failed to create email: ${error.message}`, 'error');
            
            // Retry after 2 seconds
            setTimeout(() => {
                this.log('🔄 Retrying email creation...', 'warning');
                this.createEmail();
            }, 2000);
        }
    }

    showAccountDetails(result) {
        const outputElement = document.getElementById('output');
        if (outputElement) {
            outputElement.innerHTML = `
                <div class="account-details">
                    <h3>✅ Email Created Successfully</h3>
                    <div class="account-info">
                        <p><strong>📧 Email:</strong> ${result.email}</p>
                        <p><strong>🔐 Password:</strong> ${result.password || 'not required'}</p>
                        <p><strong>🛠️ Service:</strong> ${result.service}</p>
                        <p><strong>🌐 Domain:</strong> ${result.email.split('@')[1]}</p>
                        <p><strong>⏰ Expires:</strong> ${result.expiresAt ? new Date(result.expiresAt).toLocaleString('en-US') : '2 hours'}</p>
                    </div>
                    <div class="account-actions">
                        <button class="btn btn-primary" onclick="copyToClipboard('${result.email}')">
                            📋 Copy Email
                        </button>
                        <button class="btn btn-success" onclick="checkMessages()">
                            📨 Check Messages
                        </button>
                        <button class="btn btn-warning" onclick="createEmail()">
                            🔄 New Email
                        </button>
                    </div>
                    <div class="account-tips">
                        <p><strong>💡 Usage Tips:</strong></p>
                        <ul>
                            <li>Copy the email and use it to register on any platform</li>
                            <li>Messages appear automatically every 15 seconds</li>
                            <li>You can create multiple emails simultaneously</li>
                            <li>Email valid for 2 hours from creation time</li>
                            <li>Works with all platforms: Facebook, Google, Twitter, Instagram, etc.</li>
                            <li>Check messages regularly for activation codes</li>
                        </ul>
                    </div>
                </div>
            `;
        }
    }

    async checkMessages() {
        if (!this.currentAccount) {
            this.log('⚠️ No active account', 'warning');
            return;
        }

        try {
            this.log('Checking for new messages...', 'info');
            
            const result = await this.apiCall(
                `/api/email/messages?accountId=${encodeURIComponent(this.currentAccount.accountId)}&email=${encodeURIComponent(this.currentAccount.email)}&service=${this.currentAccount.service}&token=${encodeURIComponent(this.currentAccount.token || '')}`
            );
            
            if (result.success) {
                this.updateMessagesList(result.messages);
                this.log(`✅ Messages updated: ${result.messages.length} found`, 'success');
                
                // Notification for new unread messages
                const unreadMessages = result.messages.filter(msg => msg.unread);
                if (unreadMessages.length > 0) {
                    this.showNotification(`You have ${unreadMessages.length} new messages!`);
                }
            } else {
                this.log('⚠️ No new messages', 'info');
            }
        } catch (error) {
            this.log(`❌ Failed to fetch messages: ${error.message}`, 'error');
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
            this.log('⚠️ Cannot connect to server', 'warning');
        }
    }

    async loadSessionAccounts() {
        try {
            const result = await this.apiCall(`/api/email/session/${this.sessionId}`);
            if (result.success && result.accounts.length > 0) {
                // Use the most recent account
                const lastAccount = result.accounts[0];
                this.currentAccount = {
                    email: lastAccount.email,
                    accountId: lastAccount.id,
                    service: lastAccount.service
                };
                this.updateAccountsList();
                
                this.log(`📧 Account restored: ${lastAccount.email}`, 'success');
                
                // Auto check messages after 3 seconds
                setTimeout(() => this.checkMessages(), 3000);
            }
        } catch (error) {
            console.log('No active accounts in session');
        }
    }

    updateServicesStatus(services) {
        const statusElement = document.getElementById('servicesStatus');
        if (statusElement) {
            let statusHTML = '<div class="services-grid">';
            
            // Show available services
            if (services.availableServices && services.availableServices.length > 0) {
                services.availableServices.forEach(service => {
                    const isActive = service === services.currentService;
                    statusHTML += `
                        <div class="service-status ${isActive ? 'active' : 'inactive'}">
                            <span class="service-name">${service}</span>
                            <span class="service-indicator">${isActive ? '✅' : '⚡'} ${isActive ? 'Active' : 'Backup'}</span>
                        </div>
                    `;
                });
            } else {
                statusHTML += `
                    <div class="service-status active">
                        <span class="service-name">real</span>
                        <span class="service-indicator">✅ Active</span>
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
                    <p>No active accounts</p>
                    <small>Click "Create New Email" to start</small>
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
                    <small>Created: ${new Date().toLocaleString('en-US')}</small>
                </div>
                <div class="account-actions">
                    <button class="copy-btn" onclick="copyToClipboard('${this.currentAccount.email}')" title="Copy Email">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="refresh-btn" onclick="checkMessages()" title="Refresh Messages">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                    <button class="delete-btn" onclick="deleteAccount('${this.currentAccount.email}')" title="Delete Account">
                        <i class="fas fa-trash"></i> Delete
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
                    <p>No new messages</p>
                    <small>Messages will be checked automatically every 15 seconds</small>
                    <br>
                    <small>Use the email above to register on any platform and activation codes will appear here</small>
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
                        <strong class="message-subject">${message.subject || 'No Subject'}</strong>
                        <span class="message-date">${message.date || new Date().toLocaleString('en-US')}</span>
                    </div>
                    <div class="message-preview">${message.preview || 'No preview available'}</div>
                    <div class="message-sender">
                        <i class="fas fa-user"></i>
                        <span>${message.sender || 'Unknown Sender'}</span>
                        ${message.unread ? '<span class="unread-badge">NEW</span>' : ''}
                    </div>
                </div>
                <div class="message-actions">
                    <button class="btn btn-small" onclick="event.stopPropagation(); viewMessage('${message.id}')" title="View Message">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        messagesCount.textContent = messages.length.toString();
        
        // Notification for new messages
        const unreadCount = messages.filter(msg => msg.unread).length;
        if (unreadCount > 0) {
            this.log(`📬 You have ${unreadCount} new messages`, 'success');
            this.showNotification(`📨 ${unreadCount} new messages!`);
        }
    }

    async viewMessage(messageId) {
        if (!this.currentAccount) return;
        
        try {
            this.showLoading();
            const result = await this.apiCall(
                `/api/email/messages/${messageId}?accountId=${encodeURIComponent(this.currentAccount.accountId)}&email=${encodeURIComponent(this.currentAccount.email)}&service=${this.currentAccount.service}&token=${encodeURIComponent(this.currentAccount.token || '')}`
            );
            
            if (result.success) {
                this.showMessageDetails(result.message);
            }
        } catch (error) {
            this.log(`❌ Failed to view message: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    showMessageDetails(message) {
        const outputElement = document.getElementById('output');
        if (outputElement) {
            const content = message.content || 'No content available';
            const sender = message.sender || 'Unknown Sender';
            const subject = message.subject || 'No Subject';
            const date = message.date || new Date().toLocaleString('en-US');
            
            outputElement.innerHTML = `
                <div class="message-details">
                    <div class="message-header">
                        <h3>${subject}</h3>
                        <button class="btn btn-small" onclick="checkMessages()">
                            <i class="fas fa-arrow-left"></i> Back to List
                        </button>
                    </div>
                    <div class="message-meta">
                        <p><strong>👤 From:</strong> ${sender}</p>
                        <p><strong>📅 Date:</strong> ${date}</p>
                        <p><strong>📧 To:</strong> ${this.currentAccount?.email || 'Unknown'}</p>
                    </div>
                    <div class="message-body">
                        <div class="message-content">
                            <pre>${content}</pre>
                        </div>
                    </div>
                    <div class="message-actions">
                        <button class="btn btn-primary" onclick="copyToClipboard(\`${content.replace(/`/g, '\\`')}\`)">
                            <i class="fas fa-copy"></i> Copy Content
                        </button>
                        <button class="btn" onclick="checkMessages()">
                            <i class="fas fa-sync"></i> Refresh Messages
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
                
                // Clear output area
                const outputElement = document.getElementById('output');
                if (outputElement) {
                    outputElement.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-trash"></i>
                            <p>Account deleted successfully</p>
                            <small>You can create a new email when needed</small>
                        </div>
                    `;
                }
            }
        } catch (error) {
            this.log(`❌ Failed to delete account: ${error.message}`, 'error');
        }
    }

    async rotateService() {
        try {
            this.log('Rotating service...', 'info');
            const result = await this.apiCall('/api/email/services/rotate', {
                method: 'POST'
            });
            
            if (result.success) {
                this.log(`✅ Service rotated to: ${result.currentService}`, 'success');
                this.loadServiceStatus();
            }
        } catch (error) {
            this.log(`❌ Failed to rotate service: ${error.message}`, 'error');
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
        }, 15000); // Refresh every 15 seconds
    }

    updateConnectionStatus(status = 'online') {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = status === 'online' ? '🟢 Connected' : '🔴 Disconnected';
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
        // Create temporary notification
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
        
        const timestamp = new Date().toLocaleTimeString('en-US');
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
        
        // Keep limited number of logs
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

    // System reset function
    async resetSystem() {
        try {
            const result = await this.apiCall('/api/email/services/reset', {
                method: 'POST'
            });
            
            if (result.success) {
                this.log('✅ System reset successfully', 'success');
                this.currentAccount = null;
                this.updateAccountsList();
                this.updateMessagesList([]);
                
                const outputElement = document.getElementById('output');
                if (outputElement) {
                    outputElement.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-redo"></i>
                            <p>System reset completed</p>
                            <small>You can create a new email now</small>
                        </div>
                    `;
                }
            }
        } catch (error) {
            this.log('❌ Failed to reset system', 'error');
        }
    }
}

// Global functions for button usage
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.hackmail) {
            window.hackmail.log('Copied to clipboard', 'success');
        }
        showTempNotification('Copied to clipboard!');
    }).catch(err => {
        // Fallback copy method
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (window.hackmail) {
            window.hackmail.log('Copied to clipboard', 'success');
        }
        showTempNotification('Copied to clipboard!');
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

function createEmail() {
    if (window.hackmail) {
        window.hackmail.createEmail();
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
    if (confirm('Are you sure you want to reset the system? All accounts and messages will be deleted.')) {
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
    if (confirm('Are you sure you want to delete this account? All associated messages will be lost.')) {
        if (window.hackmail) {
            window.hackmail.deleteAccount(email);
        }
    }
}

// Add CSS animations
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
        margin-left: 8px;
    }
    
    .temp-notification {
        font-family: 'Courier New', monospace;
    }
`;
document.head.appendChild(style);

// Initialize system when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Auto-detect base URL if not set
    if (!window.BASE_URL) {
        window.BASE_URL = window.location.origin;
    }
    
    window.hackmail = new HackMailPro();
});

// Update status every minute
setInterval(() => {
    if (window.hackmail) {
        window.hackmail.loadServiceStatus();
    }
}, 60000);

// Update title automatically with connection status
setInterval(() => {
    if (window.hackmail && document.title) {
        const isOnline = document.getElementById('connectionStatus')?.textContent.includes('Connected');
        document.title = isOnline 
            ? 'HackMail Pro - Real Email System 🟢' 
            : 'HackMail Pro - Real Email System 🔴';
    }
}, 5000);
