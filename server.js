const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const staffRoutes = require('./routes/staff');
const supervisorRoutes = require('./routes/supervisor');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
  await initDB();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(session({
    secret: 'leave-system-secret-key-swmu-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 }
  }));

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
  });

  app.get('/', (req, res) => {
    if (req.session && req.session.user) {
      const dashboard = req.session.user.role === 'Staff' ? '/staff'
        : req.session.user.role === 'Teacher' ? '/supervisor'
        : '/admin';
      return res.redirect(dashboard);
    }
    res.redirect('/login');
  });

  app.use(authRoutes);
  app.use('/staff', staffRoutes);
  app.use('/supervisor', supervisorRoutes);
  app.use('/admin', adminRoutes);

  app.use((req, res) => {
    res.status(404).send('Page Not Found');
  });

  app.use((err, req, res, next) => {
    console.error('ERROR:', err.stack || err);
    res.status(500).send('Server Error');
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);