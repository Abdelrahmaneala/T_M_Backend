# استخدم نسخة Node.js مناسبة
FROM node:20-alpine

# تحديد مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات المشروع
COPY package*.json ./

# تثبيت التبعيات
RUN npm install --production

# نسخ باقي الملفات
COPY . .

# تحديد المنفذ (زي ما السيرفر بيستخدمه)
EXPOSE 3000

# أمر التشغيل الافتراضي
CMD ["node", "server.js"]
