const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../../config');

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dataDir = path.dirname(config.database.filename);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(config.database.filename, (err) => {
      if (err) {
        console.error('خطأ في فتح قاعدة البيانات:', err);
      } else {
        console.log('✓ تم الاتصال بقاعدة البيانات SQLite');
        this.createTables();
      }
    });
  }

  createTables() {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS email_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mailtm_id TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          token TEXT,
          session_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          is_active BOOLEAN DEFAULT 1,
          service_type TEXT DEFAULT 'mailtm'
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mailtm_message_id TEXT UNIQUE,
          email_id INTEGER NOT NULL,
          sender TEXT NOT NULL,
          subject TEXT,
          content TEXT,
          html_content TEXT,
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_read BOOLEAN DEFAULT 0,
          FOREIGN KEY (email_id) REFERENCES email_accounts (id)
      )`
    ];

    const indexQueries = [
      `CREATE INDEX IF NOT EXISTS idx_email_session ON email_accounts(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_email_mailtm_id ON email_accounts(mailtm_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_email ON messages(email_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at)`,
      `CREATE INDEX IF NOT EXISTS idx_email_service ON email_accounts(service_type)`
    ];

    this.db.serialize(() => {
      tableQueries.forEach((query, idx) => {
        this.db.run(query, (err) => {
          if (err) {
            console.error(`خطأ في إنشاء الجدول ${idx + 1}:`, err);
          } else {
            console.log(`✓ تم إنشاء/التحقق من الجدول ${idx + 1}`);
          }
        });
      });

      this.addNewColumns();

      indexQueries.forEach((query, idx) => {
        this.db.run(query, (err) => {
          if (err) {
            console.error(`خطأ في إنشاء الفهرس ${idx + 1}:`, err);
          } else {
            console.log(`✓ تم إنشاء/التحقق من الفهرس ${idx + 1}`);
          }
        });
      });
    });
  }

  addNewColumns() {
    console.log('🔄 التحقق من الأعمدة الجديدة...');
    
    const alterQueries = [
      `ALTER TABLE email_accounts ADD COLUMN service_type TEXT DEFAULT 'mailtm'`
    ];

    alterQueries.forEach((query, index) => {
      this.db.run(query, (err) => {
        if (err) {
          if (!err.message.includes('duplicate column name') && 
              !err.message.includes('already exists')) {
            console.error(`❌ خطأ في إضافة العمود ${index + 1}:`, err.message);
          } else {
            console.log(`✓ العمود ${index + 1} موجود بالفعل`);
          }
        } else {
          console.log(`✅ تم إضافة العمود الجديد ${index + 1} بنجاح`);
        }
      });
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

const database = new Database();

const initDatabase = async () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(database), 1000);
  });
};

module.exports = { database, initDatabase };