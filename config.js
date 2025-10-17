const path = require('path');

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
        filename: path.join(__dirname, 'data', 'database.sqlite')
    },
    server: {
        port: process.env.PORT || 3001,
        host: process.env.HOST || 'localhost'
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // إعدادات الأمان والمرونة
    security: {
        maxRequestsPerMinute: 100,
        sessionTimeout: 24 * 60 * 60 * 1000 // 24 ساعة
    }
};