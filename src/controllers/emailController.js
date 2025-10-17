// file name: emailController.js
// استبدل محتوى الملف بالكود التالي:

const emailService = require('../services/emailService');

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
                    id: msg.id,
                    sender: msg.from?.name || msg.from?.address || 'غير معروف',
                    subject: msg.subject || 'بدون عنوان',
                    content: msg.text || 'لا يوجد محتوى',
                    date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
                    preview: (msg.text || '').substring(0, 100) + '...',
                    unread: !msg.seen
                };
            } else if (serviceType === 'guerrillamail') {
                processedMsg = {
                    id: msg.id,
                    sender: msg.from?.name || msg.from?.address || 'غير معروف',
                    subject: msg.subject || 'بدون عنوان',
                    content: msg.text || 'لا يوجد محتوى',
                    date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
                    preview: (msg.text || '').substring(0, 100) + '...',
                    unread: !msg.seen
                };
            } else if (serviceType === 'temp-mail') {
                processedMsg = {
                    id: msg.id,
                    sender: msg.from?.name || msg.from?.address || 'غير معروف',
                    subject: msg.subject || 'بدون عنوان',
                    content: msg.text || 'لا يوجد محتوى',
                    date: msg.createdAt ? new Date(msg.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG'),
                    preview: (msg.text || '').substring(0, 100) + '...',
                    unread: !msg.seen
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

            console.log('🔄 بدء إنشاء إيميل ذكي...');

            const accountResult = await emailService.createAccount(sessionId);
            
            if (!accountResult.success) {
                throw new Error('فشل في إنشاء الحساب');
            }

            const { email, password, accountId, token, service } = accountResult;

            console.log(`✅ تم إنشاء إيميل ${service}: ${email}`);

            res.status(201).json({
                success: true,
                email: email,
                password: password,
                accountId: accountId,
                token: token,
                service: service,
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

            const emails = emailService.getSessionAccounts(sessionId);

            res.json({ 
                success: true, 
                emails: emails.map(email => ({
                    id: email.accountId,
                    email: email.email,
                    service: email.service,
                    createdAt: new Date().toISOString()
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
            const { accountId, email, service } = req.query;
            
            if (!accountId || !email || !service) {
                return res.status(400).json({ 
                    success: false,
                    error: 'بيانات الحساب مطلوبة' 
                });
            }

            console.log(`🔄 جلب الرسائل لـ: ${email} (${service})`);

            const accountInfo = {
                email: email,
                accountId: accountId,
                service: service
            };

            const messagesData = await emailService.getMessages(accountInfo);
            const processedMessages = processMessagesForFrontend(messagesData['hydra:member'] || [], service);
            
            res.json({
                success: true,
                messages: processedMessages,
                count: processedMessages.length,
                service: service,
                email: email
            });

        } catch (error) {
            console.error('❌ خطأ في جلب الرسائل:', error);
            res.status(500).json({
                success: false,
                error: 'فشل في جلب الرسائل: ' + error.message
            });
        }
    }

    async getMessage(req, res) {
        try {
            const { id } = req.params;
            const { accountId, email, service } = req.query;
            
            if (!accountId || !email || !service) {
                return res.status(400).json({ 
                    success: false,
                    error: 'بيانات الحساب مطلوبة' 
                });
            }

            console.log(`🔄 جلب رسالة كاملة: ${id} من ${service}`);

            const accountInfo = {
                email: email,
                accountId: accountId,
                service: service
            };

            const message = await emailService.getMessage(accountInfo, id);
            
            res.json({
                success: true,
                message: {
                    id: message.id,
                    sender: message.from?.name || message.from?.address || 'غير معروف',
                    subject: message.subject || 'بدون عنوان',
                    content: message.text || message.html || 'لا يوجد محتوى',
                    date: message.createdAt ? new Date(message.createdAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG')
                },
                service: service
            });

        } catch (error) {
            console.error('❌ خطأ في جلب الرسالة الكاملة:', error);
            res.status(500).json({ 
                success: false,
                error: 'فشل في جلب الرسالة: ' + error.message 
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
}

module.exports = new SmartEmailController();
