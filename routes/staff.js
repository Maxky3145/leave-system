const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB, saveDB } = require('../db');
const { requireRole } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, `leave_${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    req.uploadDir = dir;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.fieldname === 'huris_form' ? 'ใบลา' : 'ขออนุมัติเดินทาง';
    cb(null, `${prefix}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์ PDF เท่านั้น'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const LEAVE_TYPES = [
  'ลาป่วย',
  'ลาคลอดบุตร',
  'ลากิจส่วนตัว',
  'ลาพักผ่อน',
  'ลาอุปสมบทหรือไปประกอบพิธีฮัจย์',
  'เข้ารับการตรวจเลือกหรือเข้ารับการเตรียมพล',
  'ลาติดตามคู่สมรส',
  'ลาหยุดโดยไม่ถือเป็นวันลาเนื่องจากวิกฤตอุทกภัย',
  'ลากิจส่วนตัวเพื่อเลี้ยงดูบุตร',
  'ลาป่วยเนื่องจากต้องรักษาตัวเป็นเวลานาน',
  'ลาไปช่วยเหลือภริยาที่คลอดบุตร',
  'ลาไปต่างประเทศ'
];

router.get('/', requireRole('Staff'), (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;

  const result = db.exec(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, lr.supervisor_comment, lr.reviewed_at
    FROM leave_requests lr
    WHERE lr.user_id = ?
    ORDER BY lr.created_at DESC
  `, [userId]);

  const leaves = result.length > 0
    ? result[0].values.map(r => ({
        id: r[0], leave_type: r[1], start_date: r[2], end_date: r[3],
        status: r[4], created_at: r[5], supervisor_comment: r[6], reviewed_at: r[7]
      }))
    : [];

  res.render('staff/dashboard', { user: req.session.user, leaves });
});

router.get('/submit', requireRole('Staff'), (req, res) => {
  res.render('staff/submit', {
    user: req.session.user,
    leaveTypes: LEAVE_TYPES,
    error: null,
    success: null
  });
});

router.post('/submit', requireRole('Staff'), upload.fields([
  { name: 'huris_form', maxCount: 1 },
  { name: 'travel_approval', maxCount: 1 }
]), (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  const { leave_type, start_date, end_date, reason } = req.body;

  if (!leave_type || !start_date || !end_date) {
    return res.render('staff/submit', {
      user: req.session.user,
      leaveTypes: LEAVE_TYPES,
      error: 'กรุณากรอกข้อมูลให้ครบถ้วน',
      success: null
    });
  }

  const isOversea = leave_type === 'ลาไปต่างประเทศ';
  if (isOversea && (!req.files || !req.files['huris_form'] || !req.files['travel_approval'])) {
    return res.render('staff/submit', {
      user: req.session.user,
      leaveTypes: LEAVE_TYPES,
      error: 'การลาไปต่างประเทศต้องแนบไฟล์ 2 ไฟล์: ใบลา และ แบบขออนุมัติเดินทาง',
      success: null
    });
  }

  if (!isOversea && (!req.files || !req.files['huris_form'])) {
    return res.render('staff/submit', {
      user: req.session.user,
      leaveTypes: LEAVE_TYPES,
      error: 'กรุณาแนบไฟล์ใบลา',
      success: null
    });
  }

  db.run(
    "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')",
    [userId, leave_type, start_date, end_date, reason || '']
  );

  const lrIdResult = db.exec("SELECT last_insert_rowid()");
  const lrId = lrIdResult[0].values[0][0];

  if (req.files && req.files['huris_form']) {
    const file = req.files['huris_form'][0];
    const finalPath = path.join(uploadDir, `leave_${lrId}`);
    fs.mkdirSync(finalPath, { recursive: true });
    const storedName = `ใบลา${path.extname(file.originalname)}`;
    fs.renameSync(file.path, path.join(finalPath, storedName));
    db.run(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name, stored_name) VALUES (?, 'huris_form', ?, ?)",
      [lrId, file.originalname, storedName]
    );
  }

  if (isOversea && req.files && req.files['travel_approval']) {
    const file = req.files['travel_approval'][0];
    const finalPath = path.join(uploadDir, `leave_${lrId}`);
    const storedName = `ขออนุมัติเดินทาง${path.extname(file.originalname)}`;
    fs.renameSync(file.path, path.join(finalPath, storedName));
    db.run(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name, stored_name) VALUES (?, 'travel_approval', ?, ?)",
      [lrId, file.originalname, storedName]
    );
  }

  saveDB();
  res.redirect('/staff');
});

router.get('/download/:leaveId/:fileType', requireRole('Staff'), (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  const { leaveId, fileType } = req.params;

  const result = db.exec(
    "SELECT lf.stored_name, lf.original_name FROM leave_files lf JOIN leave_requests lr ON lf.leave_request_id = lr.id WHERE lr.id = ? AND lr.user_id = ? AND lf.file_type = ?",
    [leaveId, userId, fileType]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return res.status(404).send('File not found');
  }

  const [storedName, originalName] = result[0].values[0];
  const filePath = path.join(uploadDir, `leave_${leaveId}`, storedName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found on disk');
  }

  res.download(filePath, originalName);
});

module.exports = router;
