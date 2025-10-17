const path = require('path');
const fs = require('fs');

// استخدام مسار قاعدة بيانات من متغير بيئي أو المسار الافتراضي
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite');

// التأكد من وجود مجلد data
const ensureDataDirectory = () => {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('📁 تم إنشاء مجلد data');
    }
};

// تنفيذ التأكد من المجلد
ensureDataDirectory();

module.exports = {
    email: {
        // نطاقات متنوعة لزيادة فرص القبول
        domains: [
            'tiffincrane.com',
            'gmailix.com',
            'mailinator.com',
            'tempmail.com',
            '10minutemail.com',
            'guerrillamail.com',
            'yopmail.com',
            'disposablemail.com'
        ],
        maxEmailsPerSession: 10,
        messageRetentionHours: 48,
        services: {
            mailtm: {
                api: 'https://api.mail.tm'
            },
            guerrillamail: {
                api: 'https://api.guerrillamail.com'
            },
            tempMail: {
                api: 'https://api.temp-mail.org'
            }
        }
    },
    database: {
        filename: DB_PATH // استخدام المتغير الجديد
    },
    server: {
        port: process.env.PORT || 3001,
        host: process.env.HOST || '0.0.0.0' // تغيير من localhost إلى 0.0.0.0
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // إعدادات الأمان والمرونة
    security: {
        maxRequestsPerMinute: 100,
        sessionTimeout: 24 * 60 * 60 * 1000 // 24 ساعة
    }
};