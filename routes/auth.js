const express = require('express');
const router = express.Router();
const { getDB, saveDB } = require('../db');

router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(getDashboard(req.session.user.role));
  }
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = getDB();

  const result = db.exec("SELECT id, email, name, role, department, department_name FROM users WHERE email = ? AND password = ?", [email, password]);

  if (result.length === 0 || result[0].values.length === 0) {
    return res.render('login', { error: 'Email หรือ Password ไม่ถูกต้อง' });
  }

  const row = result[0].values[0];
  req.session.user = {
    id: row[0],
    email: row[1],
    name: row[2],
    role: row[3],
    department: row[4],
    department_name: row[5]
  };

  return res.redirect(getDashboard(row[3]));
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

function getDashboard(role) {
  switch (role) {
    case 'Staff': return '/staff';
    case 'Teacher': return '/supervisor';
    case 'Admin': return '/admin';
    default: return '/login';
  }
}

module.exports = router;
