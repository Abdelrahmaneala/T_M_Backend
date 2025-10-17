// server.js
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات الثابتة للواجهة الأمامية
app.use(express.static(path.join(__dirname, 'public')));

// استيراد routes الباك إند
app.use('/api/email', require('./src/routes/emailRoutes'));
app.use('/api/messages', require('./src/routes/messageRoutes'));

// API Routes الأساسية
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

// جميع الطلبات الأخرى ترسل إلى الواجهة الأمامية
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 HackMail Pro running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`🔗 API: http://localhost:${PORT}/api/health`);
});

module.exports = app;
