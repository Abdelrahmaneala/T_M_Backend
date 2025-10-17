const { database } = require('../models/database');
const emailService = require('../services/emailService');
const config = require('../../config');

function processMessagesForFrontend(messages, serviceType) {
    if (!messages || !Array.isArray(messages)) {
        return [];
    }

    return messages.map((msg, index) => {
        let processedMsg = {
            id: msg.id || `msg-${Date.now()}-${index}`,
            sender: 'غير معروف',
            subject: 'بدون عنوان',
            content: 'لا يوجد محتوى',
            date: new Date().toLocaleString('ar-EG'),
            preview: 'لا يوجد معاينة',
            unread: true
        };

        try {
            if (serviceType === 'mailtm') {
                processedMsg = {
                    id: msg.id || `msg-${Date.now()}-${index}`,
                    sender: msg.from?.address || msg.from?.name || msg.from || 'غير معروف',
                    subject: msg.subject || 'بدون عنوان',
                    content: msg.text || msg.intro || 'لا يوجد محتوى',
                    html: msg.html || '',
                    date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
                    preview: msg.intro || (msg.text ? msg.text.substring(0, 100) + '...' : 'لا يوجد معاينة'),
                    unread: !msg.seen
                };
            } else if (serviceType === 'guerrillamail') {
                processedMsg = {
                    id: msg.id || `msg-${Date.now()}-${index}`,
                    sender: msg.from?.address || msg.from?.name || msg.from || msg.mail_from || 'غير معروف',
                    subject: msg.subject || msg.mail_subject || 'بدون عنوان',
                    content: msg.mail_body || msg.text || msg.intro || 'لا يوجد محتوى',
                    html: msg.mail_body || '',
                    date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('ar-EG') : 
                         (msg.mail_timestamp ? new Date(msg.mail_timestamp * 1000).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG')),
                    preview: msg.mail_excerpt || msg.intro || (msg.mail_body ? msg.mail_body.substring(0, 100) + '...' : 'لا يوجد معاينة'),
                    unread: !(msg.seen || msg.mail_read === 1)
                };
            }
        } catch (error) {
            console.error('❌ خطأ في معالجة الرسالة:', error);
        }

        return processedMsg;
    });
}

class SmartEmailController {
    async createEmail(req, res) {
        try {
            const { sessionId } = req.body;
            
            if (!sessionId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'معرف الجلسة مطلوب' 
                });
            }

            const emailCount = await database.all(
                'SELECT COUNT(*) as count FROM email_accounts WHERE session_id = ? AND is_active = 1',
                [sessionId]
            );

            if (emailCount[0].count >= config.email.maxEmailsPerSession) {
                return res.status(429).json({ 
                    success: false,
                    error: 'تجاوزت الحد المسموح به من الإيميلات لهذه الجلسة' 
                });
            }

            console.log('🔄 بدء إنشاء إيميل ذكي...');

            const accountResult = await emailService.createAccount();
            
            if (!accountResult.success) {
                throw new Error(accountResult.error || 'فشل في إنشاء الحساب');
            }

            const { email, password, accountId, token, service } = accountResult;
            const expiresAt = new Date(Date.now() + (config.email.messageRetentionHours * 60 * 60 * 1000));

            const dbResult = await database.run(
                `INSERT INTO email_accounts (mailtm_id, email, password, token, session_id, expires_at, service_type, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [accountId, email, password, token, sessionId, expiresAt.toISOString(), service]
            );

            console.log(`✅ تم إنشاء إيميل ${service}: ${email}`);

            res.status(201).json({
                success: true,
                email: email,
                accountId: dbResult.id,
                service: service,
                expiresAt: expiresAt,
                message: `تم إنشاء الإيميل باستخدام ${service}`
            });

        } catch (error) {
            console.error('❌ خطأ في إنشاء الإيميل:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message || 'فشل في إنشاء الإيميل' 
            });
        }
    }

    async getEmails(req, res) {
        try {
            const { sessionId } = req.params;

            const emails = await database.all(
                `SELECT id, email, mailtm_id, created_at, expires_at, is_active, service_type
                 FROM email_accounts 
                 WHERE session_id = ? 
                 ORDER BY created_at DESC`,
                [sessionId]
            );

            res.json({ 
                success: true, 
                emails: emails.map(email => ({
                    id: email.id,
                    email: email.email,
                    mailtmId: email.mailtm_id,
                    createdAt: email.created_at,
                    expiresAt: email.expires_at,
                    isActive: email.is_active,
                    service: email.service_type
                }))
            });
        } catch (error) {
            console.error('❌ خطأ في جلب الإيميلات:', error);
            res.status(500).json({ 
                success: false,
                error: 'فشل في جلب الإيميلات' 
            });
        }
    }

    async getMessages(req, res) {
        try {
            const { accountId } = req.query;
            
            if (!accountId) {
                return res.status(400).json({ 
                    success: false,
                    error: 'معرف الحساب مطلوب' 
                });
            }

            const account = await database.get(
                'SELECT id, email, token, password, service_type FROM email_accounts WHERE id = ?',
                [accountId]
            );

            if (!account) {
                return res.status(404).json({ 
                    success: false,
                    error: 'الحساب غير موجود' 
                });
            }

            console.log(`🔄 جلب الرسائل لـ: ${account.email} (${account.service_type})`);

            const accountInfo = {
                email: account.email,
                token: account.token,
                password: account.password,
                service: account.service_type
            };

            try {
                const messagesData = await emailService.getMessages(accountInfo);
                
                const processedMessages = processMessagesForFrontend(messagesData['hydra:member'] || [], accountInfo.service);
                
                res.json({
                    success: true,
                    messages: processedMessages,
                    count: processedMessages.length,
                    service: accountInfo.service,
                    email: accountInfo.email,
                    message: `تم جلب الرسائل من ${accountInfo.service}`
                });

            } catch (serviceError) {
                console.error('❌ فشل في جلب الرسائل من الخدمة:', serviceError.message);
                
                if (serviceError.message.includes('401') || 
                    serviceError.message.includes('انتهت صلاحية') ||
                    serviceError.message.includes('منتهي') ||
                    serviceError.message.includes('غير صالح')) {
                    
                    console.log('🔄 استبدال تلقائي للحساب المنتهي...');
                    
                    try {
                        const newAccountResult = await emailService.createAccount();
                        
                        if (!newAccountResult.success) {
                            throw new Error(newAccountResult.error || 'فشل في إنشاء حساب جديد');
                        }

                        await database.run(
                            `UPDATE email_accounts 
                             SET email = ?, token = ?, password = ?, service_type = ?, 
                                 created_at = datetime('now'), is_active = 1
                             WHERE id = ?`,
                            [newAccountResult.email, newAccountResult.token, 
                             newAccountResult.password, newAccountResult.service, accountId]
                        );

                        console.log(`✅ تم استبدال الحساب بنجاح: ${newAccountResult.email}`);

                        res.json({
                            success: true,
                            messages: [],
                            count: 0,
                            service: newAccountResult.service,
                            email: newAccountResult.email,
                            accountReplaced: true,
                            message: `تم استبدال الحساب تلقائياً بـ: ${newAccountResult.email}`
                        });

                    } catch (replaceError) {
                        console.error('❌ فشل في الاستبدال التلقائي:', replaceError.message);
                        
                        res.status(410).json({
                            success: false,
                            error: 'انتهت صلاحية الحساب. يرجى إنشاء إيميل جديد.',
                            accountExpired: true,
                            details: replaceError.message
                        });
                    }
                    
                } else {
                    console.error('❌ خطأ آخر في الخدمة:', serviceError.message);
                    res.json({
                        success: true,
                        messages: [],
                        count: 0,
                        service: accountInfo.service,
                        email: accountInfo.email,
                        message: 'لا توجد رسائل جديدة'
                    });
                }
            }

        } catch (error) {
            console.error('❌ خطأ عام في جلب الرسائل:', error);
            res.status(500).json({
                success: false,
                error: 'حدث خطأ غير متوقع في الخادم',
                details: error.message
            });
        }
    }

    async getMessage(req, res) {
        try {
            const { id } = req.params;
            const { accountId } = req.query;
            
            if (!accountId) {
                return res.status(400).json({ 
                    success: false,
                    error: 'معرف الحساب مطلوب' 
                });
            }

            const account = await database.get(
                'SELECT id, email, token, password, service_type FROM email_accounts WHERE id = ?',
                [accountId]
            );

            if (!account) {
                return res.status(404).json({ 
                    success: false,
                    error: 'الحساب غير موجود' 
                });
            }

            console.log(`🔄 جلب رسالة كاملة: ${id} من ${account.service_type}`);

            const accountInfo = {
                email: account.email,
                token: account.token,
                password: account.password,
                service: account.service_type
            };

            const message = await emailService.getMessage(accountInfo, id);
            
            let content = 'لا يوجد محتوى';
            let htmlContent = '';
            
            if (account.service_type === 'mailtm') {
                content = message.text || message.intro || 'لا يوجد محتوى';
                htmlContent = message.html || '';
            } else if (account.service_type === 'guerrillamail') {
                content = message.mail_body || message.text || 'لا يوجد محتوى';
                htmlContent = message.mail_body || '';
            }

            res.json({
                success: true,
                message: {
                    id: message.id,
                    sender: message.from?.address || message.from?.name || message.from || 'غير معروف',
                    subject: message.subject || message.mail_subject || 'بدون عنوان',
                    content: content,
                    html: htmlContent,
                    text: message.text,
                    mail_body: message.mail_body,
                    date: message.createdAt ? new Date(message.createdAt).toLocaleString('ar-EG') : 
                         (message.mail_timestamp ? new Date(message.mail_timestamp * 1000).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'))
                },
                service: account.service_type
            });

        } catch (error) {
            console.error('❌ خطأ في جلب الرسالة الكاملة:', error);
            res.status(500).json({ 
                success: false,
                error: 'فشل في جلب الرسالة: ' + error.message 
            });
        }
    }

    async deleteEmail(req, res) {
        try {
            const { email } = req.params;
            const { sessionId } = req.body;

            const emailRecord = await database.get(
                'SELECT id FROM email_accounts WHERE email = ? AND session_id = ?',
                [email, sessionId]
            );

            if (!emailRecord) {
                return res.status(404).json({ 
                    success: false,
                    error: 'الإيميل غير موجود أو لا ينتمي لهذه الجلسة' 
                });
            }

            await database.run('DELETE FROM messages WHERE email_id = ?', [emailRecord.id]);
            await database.run('DELETE FROM email_accounts WHERE id = ?', [emailRecord.id]);

            console.log(`✅ تم حذف الإيميل: ${email}`);

            res.json({ 
                success: true, 
                message: 'تم حذف الإيميل بنجاح' 
            });

        } catch (error) {
            console.error('❌ خطأ في حذف الإيميل:', error);
            res.status(500).json({ 
                success: false,
                error: 'فشل في حذف الإيميل' 
            });
        }
    }

    async checkServiceStatus(req, res) {
        try {
            const status = emailService.getServiceStatus();
            
            res.json({
                success: true,
                ...status,
                message: `الخدمة الحالية: ${status.currentService}`
            });
        } catch (error) {
            res.json({
                success: false,
                status: 'inactive',
                error: 'فشل في التحقق من حالة الخدمة: ' + error.message
            });
        }
    }

    async getAvailableServices(req, res) {
        try {
            const status = emailService.getServiceStatus();
            
            res.json({
                success: true,
                services: status.availableServices,
                currentService: status.currentService,
                message: 'الخدمات المتاحة'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'فشل في جلب الخدمات'
            });
        }
    }

    async rotateService(req, res) {
        try {
            const newService = emailService.rotateService();
            
            res.json({
                success: true,
                message: 'تم تبديل الخدمة',
                currentService: newService
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'فشل في تبديل الخدمة'
            });
        }
    }

    async resetServices(req, res) {
        try {
            await emailService.initialize();
            res.json({
                success: true,
                message: 'تم إعادة تعيين الخدمات'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'فشل في إعادة تعيين الخدمات'
            });
        }
    }

    async autoReplaceExpiredAccount(req, res) {
        try {
            const { accountId } = req.body;
            
            if (!accountId) {
                return res.status(400).json({ 
                    success: false,
                    error: 'معرف الحساب مطلوب' 
                });
            }

            const account = await database.get(
                'SELECT id, session_id FROM email_accounts WHERE id = ?',
                [accountId]
            );

            if (!account) {
                return res.status(404).json({ 
                    success: false,
                    error: 'الحساب غير موجود' 
                });
            }

            console.log('🔄 استبدال تلقائي لحساب منتهي...');

            const newAccount = await emailService.createAccount();
            
            await database.run(
                `UPDATE email_accounts 
                 SET email = ?, token = ?, password = ?, service_type = ?, created_at = datetime('now'), is_active = 1
                 WHERE id = ?`,
                [newAccount.email, newAccount.token, newAccount.password, newAccount.service, accountId]
            );

            console.log(`✅ تم استبدال الحساب بـ: ${newAccount.email}`);

            res.json({
                success: true,
                email: newAccount.email,
                accountId: accountId,
                service: newAccount.service,
                message: 'تم استبدال الحساب المنتهي تلقائياً'
            });

        } catch (error) {
            console.error('❌ خطأ في الاستبدال التلقائي:', error);
            res.status(500).json({ 
                success: false,
                error: 'فشل في استبدال الحساب: ' + error.message 
            });
        }
    }
}

module.exports = new SmartEmailController();
