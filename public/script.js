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
        
        // Auto refresh every 20 seconds
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
            this.log(`Creating new email...`, 'info');
            
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
                    password: result.password
                };
                this.updateAccountsList();
                this.updateServiceStatus();
                this.autoRefresh = true;
                
                // Show account details
                this.showAccountDetails(result);
            }
        } catch (error) {
            this.log(`❌ Failed to create email: ${error.message}`, 'error');
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
                            <li>Messages will appear here when received</li>
                            <li>You can create multiple emails simultaneously</li>
                            <li>Email valid for 2 hours from creation time</li>
                            <li>Works with all platforms</li>
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
            this.log('Checking for messages...', 'info');
            
            const result = await this.apiCall(
                `/api/email/messages?accountId=${encodeURIComponent(this.currentAccount.accountId)}&email=${encodeURIComponent(this.currentAccount.email)}`
            );
            
            if (result.success) {
                this.updateMessagesList(result.messages);
                this.log(`✅ Messages updated: ${result.messages.length} found`, 'success');
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
                this.currentAccount = {
                    email: result.accounts[0].email,
                    accountId: result.accounts[0].id,
                    service: result.accounts[0].service
                };
                this.updateAccountsList();
                this.log(`📧 Account loaded: ${this.currentAccount.email}`, 'success');
            }
        } catch (error) {
            console.log('No active accounts in session');
        }
    }

    updateServicesStatus(services) {
        const statusElement = document.getElementById('servicesStatus');
        if (statusElement) {
            let statusHTML = '<div class="services-grid">';
            
            statusHTML += `
                <div class="service-status active">
                    <span class="service-name">instant</span>
                    <span class="service-indicator">✅ Active</span>
                </div>
            `;
            
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
                    <span class="account-service">${this.currentAccount.service}</span>
                </div>
                <div class="account-actions">
                    <button class="copy-btn" onclick="copyToClipboard('${this.currentAccount.email}')" title="Copy Email">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="refresh-btn" onclick="checkMessages()" title="Refresh Messages">
                        <i class="fas fa-sync"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteAccount('${this.currentAccount.email}')" title="Delete Account">
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
                    <p>No messages yet</p>
                    <small>Messages will appear here when received</small>
                    <br>
                    <small>Use the email above to register on platforms</small>
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
                        <strong class="message-subject">${message.subject || 'No Subject'}</strong>
                        <span class="message-date">${message.date || new Date().toLocaleString('en-US')}</span>
                    </div>
                    <div class="message-preview">${message.preview || 'No preview available'}</div>
                    <div class="message-sender">
                        <i class="fas fa-user"></i>
                        <span>${message.sender || 'Unknown Sender'}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        messagesCount.textContent = messages.length.toString();
    }

    async rotateService() {
        try {
            this.log('Rotating service...', 'info');
            const result = await this.apiCall('/api/email/services/rotate', {
                method: 'POST'
            });
            
            if (result.success) {
                this.log(`✅ Service rotated: ${result.currentService}`, 'success');
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
        }, 20000);
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
            }
        }
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

// Global functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.hackmail) {
            window.hackmail.log('Copied to clipboard', 'success');
        }
        showTempNotification('Copied to clipboard!');
    }).catch(err => {
        if (window.hackmail) {
            window.hackmail.log('Failed to copy', 'error');
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
        // Implementation for reset
        if (window.hackmail) {
            window.hackmail.log('System reset requested', 'info');
        }
    }
}

function deleteAccount(email) {
    if (confirm('Are you sure you want to delete this account?')) {
        if (window.hackmail) {
            window.hackmail.log(`Account ${email} deleted`, 'success');
            window.hackmail.currentAccount = null;
            window.hackmail.updateAccountsList();
            window.hackmail.updateMessagesList([]);
        }
    }
}

// Initialize system
document.addEventListener('DOMContentLoaded', () => {
    window.hackmail = new HackMailPro();
});

// Update status every minute
setInterval(() => {
    if (window.hackmail) {
        window.hackmail.loadServiceStatus();
    }
}, 60000);
