-- 0001_init.sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  role TEXT NOT NULL CHECK(role IN ('Admin','Teacher','Staff')),
  department_name TEXT,
  password TEXT NOT NULL DEFAULT '123456'
);

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
);

CREATE TABLE IF NOT EXISTS leave_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  leave_request_id INTEGER NOT NULL,
  file_type TEXT NOT NULL CHECK(file_type IN ('huris_form','huris_signed','travel_approval')),
  original_name TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hr_email TEXT NOT NULL DEFAULT 'hr@swu.ac.th'
);

INSERT OR IGNORE INTO email_settings (id, hr_email) VALUES (1, 'hr@swu.ac.th');

INSERT INTO users (email, name, department, role, department_name, password) VALUES ("chanok@g.swu.ac.th","นางสาวชนก พูลสวัสดิ์","เจ้าหน้าที่ภาควิชา","Admin","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("narut@g.swu.ac.th","ผศ.ดร.นรุตตม์ สหนาวิน","ห้วหน้าภาควิชาสาธารณสุขศาสตร์","Teacher","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("songpol@g.swu.ac.th","ผศ.ดร.ทรงพล ต่อนี","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("sapsatree@g.swu.ac.th","ผศ.ดร.ทรัพย์สตรี แสนทวีสุข","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("isareej@g.swu.ac.th","ผศ.ดร.อิสรี จิรจริยาเวช","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("teepapipat@g.swu.ac.th","ผศ.ดร.ทีปพิพัฒน์ เลิศวรายุทธ์","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("sarunyaw@g.swu.ac.th","ผศ.ดร.สรัญญา วันจรารัตต์","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("kkphoyen@gmail.com","อ.ดร.กิตติ โพธิ์เย็น","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("jirawant@g.swu.ac.th","อ.ดร.จิราวรรณ ตอฤทธิ์","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("nuttapong@g.swu.ac.th","อ.ดร.ณััฐพงศ์ แสนทวี","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("prat@g.swu.ac.th","อ.ดร.ปรัชญ์ อินทรศักดิ์สิทธิ์","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("panita@g.swu.ac.th","อ.ดร.พนิตา คำภูษา","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("panity@g.swu.ac.th","อ.ดร.พานิชย์ ยามชื่น","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("patchareen@g.swu.ac.th","อ.ดร.พัชรี เนียมศรี","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("anongh@g.swu.ac.th","อ.ดร.อนงค์ หาญสกุล","อาจารย์","Staff","ภาควิชาสาธารณสุขศาสตร์","123456");
INSERT INTO users (email, name, department, role, department_name, password) VALUES ("Saowalukru@g.swu.ac.th","นางสาวเสาวลักษณ์ รุ่งเรือง","เจ้าหน้าที่สารบรรณกลาง","Staff","งานบริหารและธุรการ","123456");