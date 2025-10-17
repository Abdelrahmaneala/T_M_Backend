const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use(limiter);

// Routes الأساسية
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'الخادم يعمل بشكل طبيعي',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    system: 'HackMail Pro',
    version: '2.0.0',
    status: 'operational',
    services: {
      mailtm: 'active',
      guerrillamail: 'active',
      database: 'connected'
    }
  });
});

// Routes للبريد الإلكتروني
app.post('/api/email/create', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'معرف الجلسة مطلوب' 
      });
    }

    // محاكاة إنشاء إيميل (يمكنك إضافة المنطق الحقيقي هنا)
    const domains = ['tiffincrane.com', 'mail.tm', 'guerrillamail.com'];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    const username = `user${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const email = `${username}@${randomDomain}`;
    
    res.json({
      success: true,
      email: email,
      password: 'auto_generated_password',
      accountId: `acc_${Date.now()}`,
      service: randomDomain.includes('guerrilla') ? 'guerrillamail' : 'mailtm',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      message: 'تم إنشاء الإيميل بنجاح'
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/email/messages', async (req, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false,
        error: 'معرف الحساب مطلوب' 
      });
    }

    // محاكاة جلب الرسائل
    const mockMessages = [
      {
        id: 'msg_1',
        sender: 'noreply@example.com',
        subject: 'مرحباً بك في HackMail Pro',
        content: 'شكراً لاستخدامك نظام الإيميل المؤقت المتقدم.',
        preview: 'شكراً لاستخدامك نظام الإيميل المؤقت المتقدم...',
        date: new Date().toLocaleString('ar-EG'),
        unread: true
      },
      {
        id: 'msg_2', 
        sender: 'support@hackmail.com',
        subject: 'دليل الاستخدام',
        content: 'تعلم كيفية استخدام جميع ميزات النظام.',
        preview: 'تعلم كيفية استخدام جميع ميزات النظام...',
        date: new Date(Date.now() - 300000).toLocaleString('ar-EG'),
        unread: false
      }
    ];

    res.json({
      success: true,
      messages: mockMessages,
      count: mockMessages.length,
      service: 'mailtm',
      email: 'test@example.com'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'حدث خطأ في جلب الرسائل'
    });
  }
});

app.get('/api/email/services/status', (req, res) => {
  res.json({
    success: true,
    currentService: 'mailtm',
    domains: 3,
    availableServices: ['mailtm', 'guerrillamail'],
    status: 'active'
  });
});

app.post('/api/email/services/rotate', (req, res) => {
  res.json({
    success: true,
    message: 'تم تبديل الخدمة',
    currentService: 'guerrillamail'
  });
});

app.post('/api/email/services/reset', (req, res) => {
  res.json({
    success: true,
    message: 'تم إعادة تعيين الخدمات'
  });
});

// معالجة جميع الطلبات الأخرى
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'الصفحة غير موجودة',
    path: req.path
  });
});

module.exports = app;