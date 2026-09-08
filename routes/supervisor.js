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
    const dir = path.join(uploadDir, `leave_${req.params.leaveId}`);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ใบลาลงนาม${ext}`);
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

router.get('/', requireRole('Teacher'), (req, res) => {
  const db = getDB();
  const user = req.session.user;

  const result = db.exec(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, u.name, u.email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE u.department_name = ? AND u.role IN ('Staff','Admin')
    ORDER BY lr.created_at DESC
  `, [user.department_name]);

  const leaves = result.length > 0
    ? result[0].values.map(r => ({
        id: r[0], leave_type: r[1], start_date: r[2], end_date: r[3],
        status: r[4], created_at: r[5], staff_name: r[6], staff_email: r[7], dept_name: r[8]
      }))
    : [];

  res.render('supervisor/dashboard', { user, leaves });
});

router.get('/review/:leaveId', requireRole('Teacher'), (req, res) => {
  const db = getDB();
  const user = req.session.user;
  const { leaveId } = req.params;

  const lrResult = db.exec(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.reason,
           lr.status, lr.created_at, lr.supervisor_comment, lr.reviewed_at,
           u.name, u.email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.id = ? AND u.department_name = ? AND u.role IN ('Staff','Admin')
  `, [leaveId, user.department_name]);

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

  res.render('supervisor/review', { user, leave, files });
});

router.get('/download/:leaveId/:fileType', requireRole('Teacher'), (req, res) => {
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

router.post('/approve/:leaveId', requireRole('Teacher'), upload.single('signed_form'), (req, res) => {
  const db = getDB();
  const { leaveId } = req.params;
  const { comment } = req.body;

  if (!req.file) {
    return res.redirect(`/supervisor/review/${leaveId}`);
  }

  const leaveDir = path.join(uploadDir, `leave_${leaveId}`);
  fs.mkdirSync(leaveDir, { recursive: true });
  const ext = path.extname(req.file.originalname);
  const storedName = `ใบลาลงนาม${ext}`;
  const finalPath = path.join(leaveDir, storedName);
  fs.renameSync(req.file.path, finalPath);

  db.run(
    "UPDATE leave_files SET file_type = 'huris_signed', original_name = ?, stored_name = ? WHERE leave_request_id = ? AND file_type = 'huris_form'",
    [req.file.originalname, storedName, leaveId]
  );

  db.run(
    "UPDATE leave_requests SET status = 'approved', supervisor_comment = ?, reviewed_at = datetime('now','localtime') WHERE id = ?",
    [comment || '', leaveId]
  );

  saveDB();
  res.redirect('/supervisor');
});

router.post('/reject/:leaveId', requireRole('Teacher'), (req, res) => {
  const db = getDB();
  const { leaveId } = req.params;
  const { comment } = req.body;

  db.run(
    "UPDATE leave_requests SET status = 'rejected', supervisor_comment = ?, reviewed_at = datetime('now','localtime') WHERE id = ?",
    [comment || '', leaveId]
  );

  saveDB();
  res.redirect('/supervisor');
});

module.exports = router;
