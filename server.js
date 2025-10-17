const app = require('./src/app');
const { initDatabase } = require('./src/models/database');
const emailService = require('./src/services/emailService');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// إصلاح مشكلة X-Forwarded-For في Replit
app.set('trust proxy', 1);

// تأكد من وجود مجلد data
const ensureDataDirectory = () => {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 تم إنشاء مجلد data');
    }
};

// إضافة route أساسي للتحقق من عمل السيرفر
app.get('/', (req, res) => {
    res.json({
        message: '🚀 نظام الإيميل المؤقت الذكي يعمل بنجاح',
        version: '1.0.0',
        status: 'active',
        features: [
            'تبديل تلقائي بين خدمات البريد',
            'استبدال تلقائي للحسابات المنتهية',
            'دعم متعدد للخدمات (Mail.tm + GuerrillaMail)',
            'نظام مرن ومعالجة أخطاء محسنة'
        ]
    });
});

// إضافة route للتحقق من صحة النظام
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'HackMail Backend',
        environment: process.env.NODE_ENV || 'development'
    });
});

// تهيئة النظام
async function initializeSystem() {
    try {
        console.log('🚀 بدء تشغيل نظام الإيميل الذكي...');

        // 0. التأكد من وجود مجلد data
        ensureDataDirectory();

        // 1. تهيئة قاعدة البيانات
        await initDatabase();
        console.log('✅ قاعدة البيانات جاهزة');

        // 2. تهيئة خدمة البريد الذكية
        const emailServiceReady = await emailService.initialize();
        if (emailServiceReady) {
            console.log('✅ خدمة البريد الذكية جاهزة');
        } else {
            console.log('⚠️ خدمة البريد تعمل في الوضع المحدود');
        }

        // 3. تشغيل الخادم
        app.listen(PORT, HOST, () => {
            console.log(`🎉 الخادم يعمل على http://${HOST}:${PORT}`);
            console.log('📧 نظام الإيميل المؤقت الذكي جاهز للاستخدام');
            console.log('💡 المميزات:');
            console.log('   • تبديل تلقائي بين الخدمات');
            console.log('   • استبدال تلقائي للحسابات المنتهية');
            console.log('   • دعم متعدد للخدمات (Mail.tm + GuerrillaMail)');
            console.log('   • نظام مرن ومعالجة أخطاء محسنة');
            console.log('\n🔗 روابط الاختبار:');
            console.log(`   • الصفحة الرئيسية: http://${HOST}:${PORT}/`);
            console.log(`   • حالة النظام: http://${HOST}:${PORT}/health`);
        });

    } catch (error) {
        console.error('💥 فشل في تشغيل النظام:', error);
        process.exit(1);
    }
}

// بدء التشغيل
initializeSystem();