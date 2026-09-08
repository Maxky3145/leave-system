const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { getDB, saveDB } = require('../db');
const { requireRole } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', 'uploads');

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

function STATUS_TEXT(status) {
  switch (status) {
    case 'pending': return 'รอดำเนินการ';
    case 'approved': return 'อนุมัติแล้ว';
    case 'rejected': return 'ไม่อนุมัติ';
    case 'forwarded': return 'ส่งต่อแล้ว';
    default: return status;
  }
}

const leaveStorage = multer.diskStorage({
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

const leaveUpload = multer({
  storage: leaveStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('อนุญาตเฉพาะไฟล์ PDF เท่านั้น'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', requireRole('Admin'), (req, res) => {
  const db = getDB();
  const user = req.session.user;

  // Forwarding list: approved leaves of OTHER users (Staff)
  const fwdResult = db.exec(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, u.name, u.email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.user_id != ? AND lr.status IN ('approved', 'pending')
    ORDER BY lr.created_at DESC
  `, [user.id]);

  const forwardList = fwdResult.length > 0
    ? fwdResult[0].values.map(r => ({
        id: r[0], leave_type: r[1], start_date: r[2], end_date: r[3],
        status: r[4], created_at: r[5], staff_name: r[6], staff_email: r[7], dept_name: r[8]
      }))
    : [];

  // Admin's own leaves
  const myResult = db.exec(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, lr.supervisor_comment, lr.reviewed_at
    FROM leave_requests lr
    WHERE lr.user_id = ?
    ORDER BY lr.created_at DESC
  `, [user.id]);

  const myLeaves = myResult.length > 0
    ? myResult[0].values.map(r => ({
        id: r[0], leave_type: r[1], start_date: r[2], end_date: r[3],
        status: r[4], created_at: r[5], supervisor_comment: r[6], reviewed_at: r[7]
      }))
    : [];

  res.render('admin/dashboard', { user, forwardList, myLeaves, statusText: STATUS_TEXT });
});

router.get('/submit', requireRole('Admin'), (req, res) => {
  res.render('admin/submit', {
    user: req.session.user,
    leaveTypes: LEAVE_TYPES,
    error: null
  });
});

router.post('/submit', requireRole('Admin'), leaveUpload.fields([
  { name: 'huris_form', maxCount: 1 },
  { name: 'travel_approval', maxCount: 1 }
]), (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  const { leave_type, start_date, end_date, reason } = req.body;

  if (!leave_type || !start_date || !end_date) {
    return res.render('admin/submit', {
      user: req.session.user, leaveTypes: LEAVE_TYPES,
      error: 'กรุณากรอกข้อมูลให้ครบถ้วน'
    });
  }

  const isOversea = leave_type === 'ลาไปต่างประเทศ';
  if (isOversea && (!req.files || !req.files['huris_form'] || !req.files['travel_approval'])) {
    return res.render('admin/submit', {
      user: req.session.user, leaveTypes: LEAVE_TYPES,
      error: 'การลาไปต่างประเทศต้องแนบไฟล์ 2 ไฟล์: ใบลา และ แบบขออนุมัติเดินทาง'
    });
  }

  if (!isOversea && (!req.files || !req.files['huris_form'])) {
    return res.render('admin/submit', {
      user: req.session.user, leaveTypes: LEAVE_TYPES,
      error: 'กรุณาแนบไฟล์ใบลา'
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
    const finalDir = path.join(uploadDir, `leave_${lrId}`);
    fs.mkdirSync(finalDir, { recursive: true });
    const storedName = `ใบลา${path.extname(file.originalname)}`;
    fs.renameSync(file.path, path.join(finalDir, storedName));
    db.run(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name, stored_name) VALUES (?, 'huris_form', ?, ?)",
      [lrId, file.originalname, storedName]
    );
  }

  if (isOversea && req.files && req.files['travel_approval']) {
    const file = req.files['travel_approval'][0];
    const finalDir = path.join(uploadDir, `leave_${lrId}`);
    const storedName = `ขออนุมัติเดินทาง${path.extname(file.originalname)}`;
    fs.renameSync(file.path, path.join(finalDir, storedName));
    db.run(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name, stored_name) VALUES (?, 'travel_approval', ?, ?)",
      [lrId, file.originalname, storedName]
    );
  }

  saveDB();
  res.redirect('/admin?tab=my');
});

router.get('/download-my/:leaveId/:fileType', requireRole('Admin'), (req, res) => {
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

router.get('/manage/:leaveId', requireRole('Admin'), (req, res) => {
  const db = getDB();
  const { leaveId } = req.params;

  const lrResult = db.exec(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.reason,
           lr.status, lr.created_at, lr.supervisor_comment, lr.reviewed_at,
           u.name, u.email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.id = ?
  `, [leaveId]);

  if (lrResult.length === 0 || lrResult[0].values.length === 0) {
    return res.status(404).send('Not found');
  }

  const r = lrResult[0].values[0];
  const leave = {
    id: r[0], leave_type: r[1], start_date: r[2], end_date: r[3],
    reason: r[4], status: r[5], created_at: r[6],
    supervisor_comment: r[7], reviewed_at: r[8],
    staff_name: r[9], staff_email: r[10], dept_name: r[11]
  };

  const filesResult = db.exec(
    "SELECT id, file_type, original_name, stored_name FROM leave_files WHERE leave_request_id = ?", [leaveId]
  );

  const files = filesResult.length > 0
    ? filesResult[0].values.map(r => ({
        id: r[0], file_type: r[1], original_name: r[2], stored_name: r[3]
      }))
    : [];

  const settingsResult = db.exec("SELECT hr_email FROM email_settings LIMIT 1");
  const hrEmail = settingsResult.length > 0 ? settingsResult[0].values[0][0] : 'hr@swu.ac.th';

  const staffResult = db.exec(
    "SELECT id, name, role FROM users WHERE role = 'Staff' ORDER BY name"
  );
  const hrStaff = staffResult.length > 0
    ? staffResult[0].values.map(r => ({ id: r[0], name: r[1], role: r[2] }))
    : [];

  res.render('admin/manage', { user: req.session.user, leave, files, hrEmail, hrStaff });
});

router.get('/download/:leaveId/:fileType', requireRole('Admin'), (req, res) => {
  const db = getDB();
  const { leaveId, fileType } = req.params;

  const result = db.exec(
    "SELECT lf.stored_name, lf.original_name FROM leave_files lf WHERE lf.leave_request_id = ? AND lf.file_type = ?",
    [leaveId, fileType]
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

router.post('/forward/:leaveId', requireRole('Admin'), async (req, res) => {
  const db = getDB();
  const { leaveId } = req.params;
  const { hr_email, smtp_host, smtp_port, smtp_user, smtp_pass } = req.body;

  if (!hr_email) {
    return res.status(400).json({ success: false, error: 'กรุณาระบุ email ของเจ้าหน้าที่บุคคล' });
  }

  const filesResult = db.exec(
    "SELECT lf.stored_name, lf.original_name FROM leave_files lf WHERE lf.leave_request_id = ?",
    [leaveId]
  );

  if (filesResult.length === 0 || filesResult[0].values.length === 0) {
    return res.status(400).json({ success: false, error: 'ไม่พบไฟล์ใบลา' });
  }

  const staffResult = db.exec(
    "SELECT u.name, lr.leave_type FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.id = ?",
    [leaveId]
  );

  const staffName = staffResult.length > 0 ? staffResult[0].values[0][0] : '';
  const leaveType = staffResult.length > 0 ? staffResult[0].values[0][1] : '';

  const attachments = [];
  for (const r of filesResult[0].values) {
    const [storedName, originalName] = r;
    const filePath = path.join(uploadDir, `leave_${leaveId}`, storedName);
    if (fs.existsSync(filePath)) {
      attachments.push({ filename: originalName, path: filePath });
    }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp_host || 'smtp.swu.ac.th',
      port: Number(smtp_port) || 587,
      secure: false,
      auth: smtp_user && smtp_pass ? { user: smtp_user, pass: smtp_pass } : undefined
    });

    const mailOptions = {
      from: smtp_user || 'leave-system@swu.ac.th',
      to: hr_email,
      subject: `ส่งต่อใบลาประเภท ${leaveType} ของ ${staffName}`,
      text: `เอกสารใบลาได้รับการส่งต่อเพื่อพิจารณา\n\nชื่อผู้ลา: ${staffName}\nประเภทการลา: ${leaveType}\nเลขที่ใบลา: ${leaveId}\n\nโปรดตรวจสอบไฟล์แนบครับ/ค่ะ`,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    db.run(
      "UPDATE leave_requests SET status = 'forwarded', reviewed_at = datetime('now','localtime') WHERE id = ?",
      [leaveId]
    );
    saveDB();

    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('Email sending failed:', err);
    res.status(500).json({ success: false, error: 'ส่งอีเมลไม่สำเร็จ: ' + err.message });
  }
});

router.post('/settings', requireRole('Admin'), (req, res) => {
  const db = getDB();
  const { hr_email } = req.body;

  db.run("UPDATE email_settings SET hr_email = ? WHERE id = 1", [hr_email || 'hr@swu.ac.th']);
  saveDB();
  res.redirect('/admin');
});

module.exports = router;