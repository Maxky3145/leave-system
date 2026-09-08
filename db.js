const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'leave_system.db');

let db = null;

function ensureDirs() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

async function initDB() {
  ensureDirs();
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      role TEXT NOT NULL CHECK(role IN ('Admin','Teacher','Staff')),
      department_name TEXT,
      password TEXT NOT NULL DEFAULT '123456'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','forwarded')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      supervisor_comment TEXT,
      reviewed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS leave_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leave_request_id INTEGER NOT NULL,
      file_type TEXT NOT NULL CHECK(file_type IN ('huris_form','huris_signed','travel_approval')),
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      uploaded_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hr_email TEXT NOT NULL DEFAULT 'hr@swu.ac.th',
      smtp_host TEXT DEFAULT 'smtp.swu.ac.th',
      smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT DEFAULT '',
      smtp_pass TEXT DEFAULT '',
      smtp_secure INTEGER DEFAULT 0
    )
  `);

  const existing = db.exec("SELECT COUNT(*) as cnt FROM email_settings");
  if (existing[0] && existing[0].values[0][0] === 0) {
    db.run("INSERT INTO email_settings (hr_email) VALUES ('hr@swu.ac.th')");
  }

  seedUsersIfEmpty();

  saveDB();
  return db;
}

function seedUsersIfEmpty() {
  const result = db.exec("SELECT COUNT(*) as cnt FROM users");
  if (result[0] && result[0].values[0][0] > 0) return;

  const xlsxPath = path.join(__dirname, 'data.xlsx');
  if (!fs.existsSync(xlsxPath)) return;

  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(xlsxPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let imported = 0;
    for (const row of rows) {
      const email = row['User_Email'];
      const name = row['Name'];
      const role = row['Role'];
      if (!email || !name || !role) continue;

      db.run(
        "INSERT INTO users (email, name, department, role, department_name, password) VALUES (?, ?, ?, ?, ?, ?)",
        [email, name, row['Department'] || '', role, row['Department_Name'] || '', '123456']
      );
      imported++;
    }
    console.log(`[seed] Imported ${imported} users from data.xlsx`);
  } catch (err) {
    console.error('[seed] Failed to seed users:', err.message);
  }
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  return db;
}

module.exports = { initDB, getDB, saveDB };
