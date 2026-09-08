const XLSX = require('xlsx');
const path = require('path');
const { initDB, getDB, saveDB } = require('./db');

async function importData() {
  await initDB();
  const db = getDB();

  const xlsxPath = path.join(__dirname, 'data.xlsx');
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = row['User_Email'];
    const name = row['Name'];
    const department = row['Department'];
    const role = row['Role'];
    const deptName = row['Department_Name'];

    if (!email || !name || !role) {
      skipped++;
      continue;
    }

    const existing = db.exec("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      skipped++;
      continue;
    }

    db.run(
      "INSERT INTO users (email, name, department, role, department_name, password) VALUES (?, ?, ?, ?, ?, ?)",
      [email, name, department || '', role, deptName || '', '123456']
    );
    imported++;
  }

  saveDB();
  console.log(`Import complete: ${imported} users imported, ${skipped} skipped`);

  const users = db.exec("SELECT email, name, role FROM users ORDER BY role, name");
  if (users.length > 0) {
    console.log('\nAll users:');
    for (const row of users[0].values) {
      console.log(`  ${row[2].padEnd(8)} | ${row[0].padEnd(35)} | ${row[1]}`);
    }
  }
}

importData().catch(console.error);
