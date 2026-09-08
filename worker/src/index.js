import { Hono } from 'hono';
import T from './templates.js';

const app = new Hono();

const enc = new TextEncoder();
const COOKIE_NAME = 'swu_session';

function bytesToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
}

function toBase64(buf) {
  let bin = '';
  const u8 = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToHex(sig);
}

async function hmacVerify(secret, data, sigHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, hexToBytes(sigHex), enc.encode(data));
}

async function createSession(secret, user) {
  const payload = b64urlEncode(JSON.stringify({ uid: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 }));
  const sig = await hmacSign(secret, payload);
  return `${payload}.${sig}`;
}

async function readSession(secret, cookieValue) {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const ok = await hmacVerify(secret, payload, sig);
  if (!ok) return null;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    if (!data.uid || !data.exp || Date.now() > data.exp) return null;
    return data.uid;
  } catch (err) {
    return null;
  }
}

async function getUser(c, uid) {
  const row = await c.env.DB.prepare(
    'SELECT id, email, name, department, role, department_name FROM users WHERE id = ?'
  ).bind(uid).first();
  return row || null;
}

function getCookie(req, name) {
  const header = req.headers.get('Cookie') || '';
  const parts = header.split(';');
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function logoutResponse() {
  return new Response('', {
    status: 302,
    headers: {
      Location: '/login',
      'Set-Cookie': `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`
    }
  });
}

async function guard(c, role) {
  const uid = await readSession(c.env.SESSION_SECRET, getCookie(c.req.raw, COOKIE_NAME));
  if (!uid) return { redirect: '/login' };
  const user = await getUser(c, uid);
  if (!user) return { redirect: '/login' };
  if (role && user.role !== role) return { forbidden: true };
  user.is_staff = user.role === 'Staff';
  return { user };
}

// ---------- Auth pages ----------

app.get('/login', (c) => c.html(T.loginPage(null)));

app.post('/login', async (c) => {
  const form = await c.req.formData();
  const email = (form.get('email') || '').trim();
  const password = form.get('password') || '';
  const row = await c.env.DB.prepare(
    'SELECT id, email, name, department, role, department_name, password FROM users WHERE email = ?'
  ).bind(email).first();

  if (!row || row.password !== password) {
    return c.html(T.loginPage('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), 401);
  }

  const token = await createSession(c.env.SESSION_SECRET, row);
  const base = { role: row.role };
  const path = base.role === 'Admin' ? '/admin' : base.role === 'Teacher' ? '/supervisor' : '/staff';

  return c.newResponse('', {
    status: 302,
    headers: {
      Location: path,
      'Set-Cookie': `${COOKIE_NAME}=${token}; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`
    }
  });
});

app.get('/logout', (c) => logoutResponse());

app.get('/', async (c) => {
  const g = await guard(c, null);
  if (g.redirect) return c.redirect(g.redirect);
  const path = g.user.role === 'Admin' ? '/admin' : g.user.role === 'Teacher' ? '/supervisor' : '/staff';
  return c.redirect(path);
});

app.get('/css/style.css', (c) => {
  return c.body(T.CSS, 200, { 'Content-Type': 'text/css; charset=utf-8' });
});

// ---------- Staff routes ----------

app.get('/staff', async (c) => {
  const g = await guard(c, 'Staff');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { results } = await c.env.DB.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, lr.supervisor_comment, lr.reviewed_at
    FROM leave_requests lr
    WHERE lr.user_id = ?
    ORDER BY lr.created_at DESC
  `).bind(g.user.id).all();

  return c.html(T.staffDashboard(g.user, results || []));
});

app.get('/staff/submit', async (c) => {
  const g = await guard(c, 'Staff');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);
  return c.html(T.staffSubmit(g.user, null));
});

app.post('/staff/submit', async (c) => {
  const g = await guard(c, 'Staff');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  let form;
  try {
    form = await c.req.formData();
  } catch (err) {
    return c.html(T.staffSubmit(g.user, 'ข้อมูลไม่ถูกต้อง'), 400);
  }

  const leaveType = form.get('leave_type');
  const startDate = form.get('start_date');
  const endDate = form.get('end_date');
  const reason = form.get('reason') || '';

  if (!leaveType || !startDate || !endDate) {
    return c.html(T.staffSubmit(g.user, 'กรุณากรอกข้อมูลให้ครบถ้วน'), 400);
  }

  const isOversea = leaveType === 'ลาไปต่างประเทศ';
  const hurisFile = form.get('huris_form');
  const travelFile = form.get('travel_approval');

  const hurisOk = hurisFile && hurisFile.name && hurisFile.type === 'application/pdf' && hurisFile.size <= 10 * 1024 * 1024;
  const travelOk = travelFile && travelFile.name && travelFile.type === 'application/pdf' && travelFile.size <= 10 * 1024 * 1024;

  if (isOversea && (!hurisOk || !travelOk)) {
    return c.html(T.staffSubmit(g.user, 'การลาไปต่างประเทศต้องแนบไฟล์ PDF 2 ไฟล์: ใบลา และ แบบขออนุมัติเดินทาง (ขนาดไม่เกิน 10MB)'), 400);
  }

  if (!isOversea && !hurisOk) {
    return c.html(T.staffSubmit(g.user, 'กรุณาแนบไฟล์ใบลาเป็น PDF (ขนาดไม่เกิน 10MB)'), 400);
  }

  const insertRes = await c.env.DB.prepare(
    "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')"
  ).bind(g.user.id, leaveType, startDate, endDate, reason).run();
  const lrId = insertRes.meta.last_row_id || 0;

  if (hurisOk) {
    const bytes = await hurisFile.arrayBuffer();
    await c.env.FILES.put(`leave_${lrId}_huris_form`, bytes, { metadata: { name: hurisFile.name } });
    await c.env.DB.prepare(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name) VALUES (?, 'huris_form', ?)"
    ).bind(lrId, hurisFile.name).run();
  }

  if (isOversea && travelOk) {
    const bytes = await travelFile.arrayBuffer();
    await c.env.FILES.put(`leave_${lrId}_travel_approval`, bytes, { metadata: { name: travelFile.name } });
    await c.env.DB.prepare(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name) VALUES (?, 'travel_approval', ?)"
    ).bind(lrId, travelFile.name).run();
  }

  return c.redirect('/staff');
});

app.get('/staff/download/:leaveId/:fileType', async (c) => {
  const g = await guard(c, 'Staff');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId, fileType } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT lf.original_name FROM leave_files lf JOIN leave_requests lr ON lf.leave_request_id = lr.id WHERE lr.id = ? AND lr.user_id = ? AND lf.file_type = ?'
  ).bind(leaveId, g.user.id, fileType).first();

  if (!row) return c.body('File not found', 404);

  const value = await c.env.FILES.get(`leave_${leaveId}_${fileType}`, { type: 'arrayBuffer' });
  if (!value) return c.body('File not found', 404);

  return c.body(value, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  });
});

// ---------- Supervisor routes ----------

app.get('/supervisor', async (c) => {
  const g = await guard(c, 'Teacher');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { results } = await c.env.DB.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, u.name AS staff_name, u.email AS staff_email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE u.department_name = ? AND u.role IN ('Staff','Admin')
    ORDER BY lr.created_at DESC
  `).bind(g.user.department_name).all();

  return c.html(T.supervisorDashboard(g.user, results || []));
});

app.get('/supervisor/review/:leaveId', async (c) => {
  const g = await guard(c, 'Teacher');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId } = c.req.param();
  const leave = await c.env.DB.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.reason,
           lr.status, lr.created_at, lr.supervisor_comment, lr.reviewed_at,
           u.name AS staff_name, u.email AS staff_email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.id = ? AND u.department_name = ? AND u.role IN ('Staff','Admin')
  `).bind(leaveId, g.user.department_name).first();

  if (!leave) return c.body('Not found', 404);

  const { results } = await c.env.DB.prepare(
    'SELECT id, file_type, original_name FROM leave_files WHERE leave_request_id = ?'
  ).bind(leaveId).all();

  return c.html(T.reviewPage(g.user, leave, results || []));
});

app.get('/supervisor/download/:leaveId/:fileType', async (c) => {
  const g = await guard(c, 'Teacher');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId, fileType } = c.req.param();
  const row = await c.env.DB.prepare(`
    SELECT lf.original_name FROM leave_files lf
    JOIN leave_requests lr ON lf.leave_request_id = lr.id
    JOIN users u ON lr.user_id = u.id
    WHERE lf.leave_request_id = ? AND lf.file_type = ? AND u.department_name = ?
  `).bind(leaveId, fileType, g.user.department_name).first();

  if (!row) return c.body('File not found', 404);

  const value = await c.env.FILES.get(`leave_${leaveId}_${fileType}`, { type: 'arrayBuffer' });
  if (!value) return c.body('File not found', 404);

  return c.body(value, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  });
});

app.post('/supervisor/approve/:leaveId', async (c) => {
  const g = await guard(c, 'Teacher');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId } = c.req.param();
  const leave = await c.env.DB.prepare(`
    SELECT lr.id FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.id = ? AND u.department_name = ? AND u.role IN ('Staff','Admin')
  `).bind(leaveId, g.user.department_name).first();

  if (!leave) return c.redirect('/supervisor');

  const form = await c.req.formData();
  const signedFile = form.get('signed_form');
  const comment = form.get('comment') || '';

  if (!signedFile || !signedFile.name || signedFile.type !== 'application/pdf' || signedFile.size > 10 * 1024 * 1024) {
    return c.redirect(`/supervisor/review/${leaveId}`);
  }

  const signedRow = await c.env.DB.prepare(
    "SELECT id FROM leave_files WHERE leave_request_id = ? AND file_type = 'huris_form'"
  ).bind(leaveId).first();

  const bytes = await signedFile.arrayBuffer();
  await c.env.FILES.put(`leave_${leaveId}_huris_signed`, bytes, { metadata: { name: signedFile.name } });

  if (signedRow) {
    await c.env.DB.prepare(
      "UPDATE leave_files SET file_type = 'huris_signed', original_name = ? WHERE id = ?"
    ).bind(signedFile.name, signedRow.id).run();
  } else {
    await c.env.DB.prepare(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name) VALUES (?, 'huris_signed', ?)"
    ).bind(leaveId, signedFile.name).run();
  }

  await c.env.DB.prepare(
    "UPDATE leave_requests SET status = 'approved', supervisor_comment = ?, reviewed_at = datetime('now','localtime') WHERE id = ?"
  ).bind(comment, leaveId).run();

  return c.redirect('/supervisor');
});

app.post('/supervisor/reject/:leaveId', async (c) => {
  const g = await guard(c, 'Teacher');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId } = c.req.param();
  const leave = await c.env.DB.prepare(`
    SELECT lr.id FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.id = ? AND u.department_name = ? AND u.role IN ('Staff','Admin')
  `).bind(leaveId, g.user.department_name).first();

  if (leave) {
    const form = await c.req.formData();
    const comment = form.get('comment') || '';
    await c.env.DB.prepare(
      "UPDATE leave_requests SET status = 'rejected', supervisor_comment = ?, reviewed_at = datetime('now','localtime') WHERE id = ?"
    ).bind(comment, leaveId).run();
  }

  return c.redirect('/supervisor');
});

// ---------- Admin routes ----------

app.get('/admin', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const fwdRes = await c.env.DB.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, u.name AS staff_name, u.email AS staff_email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.user_id != ? AND lr.status IN ('approved', 'pending')
    ORDER BY lr.created_at DESC
  `).bind(g.user.id).all();

  const myRes = await c.env.DB.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.status,
           lr.created_at, lr.supervisor_comment, lr.reviewed_at
    FROM leave_requests lr
    WHERE lr.user_id = ?
    ORDER BY lr.created_at DESC
  `).bind(g.user.id).all();

  return c.html(T.adminDashboard(g.user, fwdRes.results || [], myRes.results || []));
});

app.get('/admin/submit', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);
  return c.html(T.adminSubmit(g.user, null));
});

app.post('/admin/submit', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  let form;
  try {
    form = await c.req.formData();
  } catch (err) {
    return c.html(T.adminSubmit(g.user, 'ข้อมูลไม่ถูกต้อง'), 400);
  }

  const leaveType = form.get('leave_type');
  const startDate = form.get('start_date');
  const endDate = form.get('end_date');
  const reason = form.get('reason') || '';

  if (!leaveType || !startDate || !endDate) {
    return c.html(T.adminSubmit(g.user, 'กรุณากรอกข้อมูลให้ครบถ้วน'), 400);
  }

  const isOversea = leaveType === 'ลาไปต่างประเทศ';
  const hurisFile = form.get('huris_form');
  const travelFile = form.get('travel_approval');

  const hurisOk = hurisFile && hurisFile.name && hurisFile.type === 'application/pdf' && hurisFile.size <= 10 * 1024 * 1024;
  const travelOk = travelFile && travelFile.name && travelFile.type === 'application/pdf' && travelFile.size <= 10 * 1024 * 1024;

  if (isOversea && (!hurisOk || !travelOk)) {
    return c.html(T.adminSubmit(g.user, 'การลาไปต่างประเทศต้องแนบไฟล์ PDF 2 ไฟล์: ใบลา และ แบบขออนุมัติเดินทาง (ขนาดไม่เกิน 10MB)'), 400);
  }

  if (!isOversea && !hurisOk) {
    return c.html(T.adminSubmit(g.user, 'กรุณาแนบไฟล์ใบลาเป็น PDF (ขนาดไม่เกิน 10MB)'), 400);
  }

  const insertRes = await c.env.DB.prepare(
    "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')"
  ).bind(g.user.id, leaveType, startDate, endDate, reason).run();
  const lrId = insertRes.meta.last_row_id || 0;

  if (hurisOk) {
    const bytes = await hurisFile.arrayBuffer();
    await c.env.FILES.put(`leave_${lrId}_huris_form`, bytes, { metadata: { name: hurisFile.name } });
    await c.env.DB.prepare(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name) VALUES (?, 'huris_form', ?)"
    ).bind(lrId, hurisFile.name).run();
  }

  if (isOversea && travelOk) {
    const bytes = await travelFile.arrayBuffer();
    await c.env.FILES.put(`leave_${lrId}_travel_approval`, bytes, { metadata: { name: travelFile.name } });
    await c.env.DB.prepare(
      "INSERT INTO leave_files (leave_request_id, file_type, original_name) VALUES (?, 'travel_approval', ?)"
    ).bind(lrId, travelFile.name).run();
  }

  return c.redirect('/admin?tab=my');
});

app.get('/admin/manage/:leaveId', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId } = c.req.param();
  const leave = await c.env.DB.prepare(`
    SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.reason,
           lr.status, lr.created_at, lr.supervisor_comment, lr.reviewed_at,
           u.name AS staff_name, u.email AS staff_email, u.department_name
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.id = ?
  `).bind(leaveId).first();

  if (!leave) return c.body('Not found', 404);

  const { results } = await c.env.DB.prepare(
    'SELECT id, file_type, original_name FROM leave_files WHERE leave_request_id = ?'
  ).bind(leaveId).all();

  const settings = await c.env.DB.prepare(
    'SELECT hr_email, api_url, api_key, from_email FROM email_settings LIMIT 1'
  ).first();

  const s = settings || { hr_email: 'hr@swu.ac.th', api_url: '', api_key: '', from_email: '' };

  return c.html(T.managePage(g.user, leave, results || [], s, `/admin/forward/${leaveId}`, '/admin/download'));
});

app.get('/admin/download-my/:leaveId/:fileType', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId, fileType } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT lf.original_name FROM leave_files lf JOIN leave_requests lr ON lf.leave_request_id = lr.id WHERE lr.id = ? AND lr.user_id = ? AND lf.file_type = ?'
  ).bind(leaveId, g.user.id, fileType).first();

  if (!row) return c.body('File not found', 404);

  const value = await c.env.FILES.get(`leave_${leaveId}_${fileType}`, { type: 'arrayBuffer' });
  if (!value) return c.body('File not found', 404);

  return c.body(value, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  });
});

app.get('/admin/download/:leaveId/:fileType', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect(g.redirect);
  if (g.forbidden) return c.body('Access Denied', 403);

  const { leaveId, fileType } = c.req.param();
  const row = await c.env.DB.prepare(
    'SELECT lf.original_name FROM leave_files lf WHERE lf.leave_request_id = ? AND lf.file_type = ?'
  ).bind(leaveId, fileType).first();

  if (!row) return c.body('File not found', 404);

  const value = await c.env.FILES.get(`leave_${leaveId}_${fileType}`, { type: 'arrayBuffer' });
  if (!value) return c.body('File not found', 404);

  return c.body(value, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`
  });
});

app.post('/admin/forward/:leaveId', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.json({ success: false, error: 'กรุณาเข้าสู่ระบบก่อน' }, 401);
  if (g.forbidden) return c.json({ success: false, error: 'ไม่มีสิทธิ์' }, 403);

  const { leaveId } = c.req.param();
  let body = {};
  try {
    body = await c.req.json();
  } catch (err) {
    return c.json({ success: false, error: 'ข้อมูลไม่ถูกต้อง' }, 400);
  }

  const hrEmail = (body.hr_email || '').trim();
  if (!hrEmail) return c.json({ success: false, error: 'กรุณาระบุ email ของเจ้าหน้าที่บุคคล' }, 400);

  const { results: files } = await c.env.DB.prepare(
    'SELECT id, file_type, original_name FROM leave_files WHERE leave_request_id = ?'
  ).bind(leaveId).all();

  if (!files || files.length === 0) {
    return c.json({ success: false, error: 'ไม่พบไฟล์ใบลา' }, 400);
  }

  const staffRow = await c.env.DB.prepare(
    "SELECT u.name, lr.leave_type FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.id = ?"
  ).bind(leaveId).first();

  const staffName = staffRow ? staffRow.name : '';
  const leaveType = staffRow ? staffRow.leave_type : '';

  const attachments = [];
  for (const f of files) {
    const value = await c.env.FILES.get(`leave_${leaveId}_${f.file_type}`, { type: 'arrayBuffer' });
    if (value) attachments.push({ filename: f.original_name, content: toBase64(value) });
  }

  if (attachments.length === 0) {
    return c.json({ success: false, error: 'ไม่พบไฟล์ในระบบจัดเก็บ' }, 400);
  }

  const apiUrl = (body.api_url || '').trim();
  const apiKey = (body.api_key || '').trim();

  const from = (body.from_email || 'no-reply@swu.ac.th').trim();
  const subject = `ส่งต่อใบลาประเภท ${leaveType} ของ ${staffName}`;
  const text = `เอกสารใบลาได้รับการส่งต่อเพื่อพิจารณา\n\nชื่อผู้ลา: ${staffName}\nประเภทการลา: ${leaveType}\nเลขที่ใบลา: ${leaveId}\n\nโปรดตรวจสอบไฟล์แนบครับ/ค่ะ`;

  let simulated = false;
  let messageId = null;
  let errorMsg = null;

  if (apiUrl && apiKey) {
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from,
          to: hrEmail,
          subject,
          text,
          attachments
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        errorMsg = `ส่งอีเมลไม่สำเร็จ: ${JSON.stringify(data) || resp.status}`;
      } else {
        messageId = data.id || 'sent';
      }
    } catch (err) {
      errorMsg = 'ส่งอีเมลไม่สำเร็จ: ' + (err && err.message ? err.message : String(err));
    }
  } else {
    simulated = true;
  }

  await c.env.DB.prepare(
    "UPDATE email_settings SET hr_email = ?, api_url = ?, api_key = ?, from_email = ? WHERE id = 1"
  ).bind(hrEmail, apiUrl, apiKey, from).run();

  if (errorMsg && !simulated) {
    return c.json({ success: false, error: errorMsg }, 500);
  }

  await c.env.DB.prepare(
    "UPDATE leave_requests SET status = 'forwarded', reviewed_at = datetime('now','localtime') WHERE id = ?"
  ).bind(leaveId).run();

  return c.json({ success: true, messageId, simulated });
});

app.post('/admin/settings', async (c) => {
  const g = await guard(c, 'Admin');
  if (g.redirect) return c.redirect('/login');
  if (g.forbidden) return c.body('Access Denied', 403);

  const form = await c.req.formData();
  const hrEmail = (form.get('hr_email') || '').trim();
  await c.env.DB.prepare(
    'UPDATE email_settings SET hr_email = ? WHERE id = 1'
  ).bind(hrEmail || 'hr@swu.ac.th').run();

  return c.redirect('/admin');
});

app.all('*', (c) => {
  return c.body('Not Found', 404);
});

export default app;