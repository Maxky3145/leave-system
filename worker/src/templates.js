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

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status) {
  switch (status) {
    case 'pending':
      return '<span class="badge bg-warning text-dark"><i class="bi bi-clock"></i> รอดำเนินการ</span>';
    case 'approved':
      return '<span class="badge bg-success"><i class="bi bi-check-circle"></i> อนุมัติ</span>';
    case 'rejected':
      return '<span class="badge bg-danger"><i class="bi bi-x-circle"></i> ไม่อนุมัติ</span>';
    case 'forwarded':
      return '<span class="badge bg-primary"><i class="bi bi-send"></i> ส่งต่อแล้ว</span>';
    default:
      return esc(status);
  }
}

const CSS = `:root{--primary:#0d6efd;--secondary:#6c757d;}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,'Noto Sans Thai',sans-serif;background-color:#f4f6f9;min-height:100vh;}
.login-page{background:linear-gradient(135deg,#e0e7ff 0%,#f3f4ff 100%);}
.table-responsive{border-radius:0.5rem;overflow:hidden;}
.card{border-radius:0.75rem;}
.navbar{padding-top:0.6rem;padding-bottom:0.6rem;}
.list-group-item{border-left:4px solid var(--bs-dark);}
@media (max-width:767px){body{padding-bottom:70px;}.table th,.table td{font-size:0.85rem;padding:0.5rem;}.navbar .btn-sm{font-size:0.8rem;}}`;

function layout(opts) {
  const { title, user, navColor, content, activeNav, extraScript } = opts;
  const navLinks = {
    staff: [
      ['/staff', 'staff', 'bi-house', 'หน้าหลัก'],
      ['/staff/submit', 'submit', 'bi-plus-circle', 'ยื่นใบลา']
    ],
    supervisor: [
      ['/supervisor', 'supervisor', 'bi-house', 'หน้าหลัก']
    ],
    admin: [
      ['/admin', 'admin', 'bi-house', 'หน้าหลัก'],
      ['/admin/submit', 'submit', 'bi-plus-circle', 'ยื่นใบลา']
    ]
  }[navColor];

  const roleBadge = {
    staff: '<span class="badge bg-light text-primary ms-1">Staff</span>',
    supervisor: '<span class="badge bg-light text-success ms-1">หัวหน้า</span>',
    admin: '<span class="badge bg-light text-danger ms-1">Admin</span>'
  }[navColor];

  const linksHtml = (navLinks || [])
    .map(([href, key, icon, label]) =>
      `<li class="nav-item"><a class="nav-link ${activeNav === key ? 'active' : ''}" href="${href}"><i class="bi ${icon}"></i> ${label}</a></li>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<nav class="navbar navbar-expand-lg navbar-dark ${navColor === 'staff' ? 'bg-primary' : navColor === 'supervisor' ? 'bg-success' : 'bg-danger'} shadow-sm">
  <div class="container-fluid">
    <a class="navbar-brand" href="/${navColor}"><i class="bi bi-calendar-check"></i> ระบบการลา</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navContent">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navContent">
      <ul class="navbar-nav me-auto">${linksHtml}</ul>
      <div class="d-flex align-items-center">
        <span class="text-white me-3 d-none d-md-inline">
          <i class="bi bi-person-circle"></i> ${esc(user.name)} ${roleBadge}
        </span>
        <a href="/logout" class="btn btn-outline-light btn-sm"><i class="bi bi-box-arrow-right"></i> ออกจากระบบ</a>
      </div>
    </div>
  </div>
</nav>
<div class="container-fluid py-3 py-md-4">${content}</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
var ttl=[].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
ttl.forEach(function(el){ new bootstrap.Tooltip(el); });
</script>
${extraScript || ''}
</body>
</html>`;
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>เข้าสู่ระบบ - ระบบการลา</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<style>${CSS}</style>
</head>
<body class="login-page">
<div class="container d-flex justify-content-center align-items-center min-vh-100">
  <div class="col-md-4">
    <div class="text-center mb-4">
      <h1 class="h3 text-primary"><i class="bi bi-calendar-check"></i> ระบบการลา</h1>
      <p class="text-muted">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
    </div>
    <div class="card shadow-lg border-0">
      <div class="card-body p-4">
        ${error ? `<div class="alert alert-danger" role="alert"><i class="bi bi-exclamation-triangle"></i> ${esc(error)}</div>` : ''}
        <form action="/login" method="POST">
          <div class="mb-3">
            <label class="form-label">Email</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-envelope"></i></span>
              <input type="email" name="email" class="form-control" placeholder="example@g.swu.ac.th" required>
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label">Password</label>
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-lock"></i></span>
              <input type="password" name="password" class="form-control" placeholder="กรอกรหัสผ่าน" required>
            </div>
          </div>
          <div class="d-grid gap-2">
            <button type="submit" class="btn btn-primary"><i class="bi bi-box-arrow-in-right"></i> เข้าสู่ระบบ</button>
          </div>
        </form>
        <div class="text-center mt-3"><small class="text-muted">Default Password: <code>123456</code></small></div>
      </div>
    </div>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

function staffDashboard(user, leaves) {
  const body = leaves.length === 0
    ? `<div class="text-center py-5"><i class="bi bi-inbox display-1 text-muted"></i><p class="text-muted mt-3">ยังไม่มีรายการลา</p><a href="/staff/submit" class="btn btn-primary mt-2"><i class="bi bi-plus-circle"></i> ยื่นใบลาใหม่</a></div>`
    : `<div class="table-responsive"><table class="table table-hover align-middle bg-white rounded shadow-sm">
        <thead class="table-light"><tr><th>ลำดับ</th><th>ประเภทการลา</th><th>วันที่ลา</th><th>สถานะ</th><th>วันที่สร้าง</th><th>จัดการ</th></tr></thead>
        <tbody>
        ${leaves.map((l, i) => `<tr>
          <td>${i + 1}</td>
          <td><span class="badge bg-info text-dark">${esc(l.leave_type)}</span></td>
          <td><small>${esc(l.start_date)}<br><i class="bi bi-arrow-down"></i> ${esc(l.end_date)}</small></td>
          <td>${statusBadge(l.status)}</td>
          <td><small>${esc(l.created_at)}</small></td>
          <td>${l.supervisor_comment ? `<button class="btn btn-sm btn-outline-secondary" data-bs-toggle="tooltip" title="${esc(l.supervisor_comment)}"><i class="bi bi-chat-left-text"></i></button>` : ''}</td>
        </tr>`).join('')}
        </tbody></table></div>`;

  return layout({
    title: 'ระบบการลา - หน้าบุคลากร',
    user, navColor: 'staff', activeNav: 'staff',
    content: `<h5 class="fw-bold mb-3"><i class="bi bi-list-check"></i> ประวัติการลาของคุณ</h5>${body}`,
    extraScript: `<div class="d-md-none fixed-bottom bg-white border-top p-2 text-center"><a href="/staff/submit" class="btn btn-primary w-100"><i class="bi bi-plus-circle"></i> ยื่นใบลาใหม่</a></div>`
  });
}

function leaveFormPage(navColor, user, error, actionPath) {
  const body = `
    <div class="row justify-content-center"><div class="col-lg-8">
      <h5 class="fw-bold mb-3"><i class="bi bi-file-earmark-text"></i> ยื่นใบลาใหม่</h5>
      ${error ? `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ${esc(error)}</div>` : ''}
      <div class="card border-0 shadow-sm"><div class="card-body p-3 p-md-4">
        <form action="${actionPath}" method="POST" enctype="multipart/form-data" id="leaveForm">
          <div class="mb-3"><label class="form-label fw-bold">ชื่อ-นามสกุล</label>
            <input type="text" class="form-control" value="${esc(user.name)}" disabled></div>
          <div class="mb-3"><label class="form-label fw-bold">ประเภทการลา <span class="text-danger">*</span></label>
            <select name="leave_type" class="form-select" id="leaveType" required>
              <option value="">-- เลือกประเภทการลา --</option>
              ${LEAVE_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
            </select></div>
          <div class="row mb-3">
            <div class="col-md-6 mb-2 mb-md-0"><label class="form-label fw-bold">วันที่เริ่มลา <span class="text-danger">*</span></label>
              <input type="date" name="start_date" class="form-control" required></div>
            <div class="col-md-6"><label class="form-label fw-bold">วันที่สิ้นสุดลา <span class="text-danger">*</span></label>
              <input type="date" name="end_date" class="form-control" required></div>
          </div>
          <div class="mb-3"><label class="form-label fw-bold">เหตุผลในการลา</label>
            <textarea name="reason" class="form-control" rows="3" placeholder="กรอกเหตุผล (ถ้ามี)"></textarea></div>
          <div class="mb-3"><label class="form-label fw-bold">แนบไฟล์ใบลาจาก Huris <span class="text-danger">*</span> <small class="text-muted">(PDF)</small></label>
            <input type="file" name="huris_form" class="form-control" accept=".pdf" required id="hurisFile">
            <div class="form-text">ดาวน์โหลดใบลาได้จากระบบ Huris</div></div>
          <div class="mb-3" id="travelGroup" style="display:none;"><label class="form-label fw-bold">แนบไฟล์ขออนุมัติเดินทางไปต่างประเทศ HRM-01 <span class="text-danger">*</span> <small class="text-muted">(PDF)</small></label>
            <input type="file" name="travel_approval" class="form-control" accept=".pdf" id="travelFile">
            <div class="form-text">โหลดแบบฟอร์มได้จาก <a href="https://hr.op.swu.ac.th/publications/download/forms" target="_blank">https://hr.op.swu.ac.th/publications/download/forms</a></div></div>
          <div class="d-flex gap-2 flex-wrap">
            <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i> ส่งใบลา</button>
            <a href="/${navColor}" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> ย้อนกลับ</a>
          </div>
        </form>
      </div></div>
    </div></div>
    <script>
      document.getElementById('leaveType').addEventListener('change', function(){
        var tg = document.getElementById('travelGroup'), tf = document.getElementById('travelFile');
        if (this.value === 'ลาไปต่างประเทศ') { tg.style.display = 'block'; tf.required = true; }
        else { tg.style.display = 'none'; tf.required = false; tf.value = ''; }
      });
    </script>`;

  return layout({
    title: 'ยื่นใบลา - ระบบการลา',
    user, navColor, activeNav: 'submit',
    content: body
  });
}

function staffSubmit(user, error) {
  return leaveFormPage('staff', user, error, '/staff/submit');
}

function supervisorDashboard(user, leaves) {
  const body = leaves.length === 0
    ? `<div class="text-center py-5"><i class="bi bi-inbox display-1 text-muted"></i><p class="text-muted mt-3">ไม่มีรายการลาในขณะนี้</p></div>`
    : `<div class="table-responsive"><table class="table table-hover align-middle bg-white rounded shadow-sm">
        <thead class="table-light"><tr><th>ลำดับ</th><th>ชื่อผู้ลา</th><th>ประเภทการลา</th><th>วันที่ลา</th><th>สถานะ</th><th>วันที่สร้าง</th><th>จัดการ</th></tr></thead>
        <tbody>
        ${leaves.map((l, i) => `<tr>
          <td>${i + 1}</td>
          <td><i class="bi bi-person"></i> ${esc(l.staff_name)}<br><small class="text-muted">${esc(l.staff_email)}</small></td>
          <td><span class="badge bg-info text-dark">${esc(l.leave_type)}</span></td>
          <td><small>${esc(l.start_date)}<br><i class="bi bi-arrow-down"></i> ${esc(l.end_date)}</small></td>
          <td>${statusBadge(l.status)}</td>
          <td><small>${esc(l.created_at)}</small></td>
          <td><a href="/supervisor/review/${l.id}" class="btn btn-sm btn-outline-success"><i class="bi bi-eye"></i> พิจารณา</a></td>
        </tr>`).join('')}
        </tbody></table></div>`;

  return layout({
    title: 'ระบบการลา - หน้าผู้บังคับบัญชา',
    user, navColor: 'supervisor', activeNav: 'supervisor',
    content: `<h5 class="fw-bold mb-3"><i class="bi bi-clipboard-check"></i> รายการลาที่รอพิจารณา</h5>
      <small class="text-muted d-block mb-3">ภาควิชา: ${esc(user.department_name)}</small>${body}`
  });
}

function reviewPage(user, leave, files) {
  const fileRows = files.length === 0
    ? '<p class="text-muted">ไม่มีไฟล์แนบ</p>'
    : `<div class="list-group">${files.map(f => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div><i class="bi bi-file-earmark-pdf text-danger"></i> ${esc(f.original_name)}<br><small class="text-muted">(${esc(f.file_type)})</small></div>
          <a href="/supervisor/download/${leave.id}/${esc(f.file_type)}" class="btn btn-sm btn-outline-primary"><i class="bi bi-download"></i> ดาวน์โหลด</a>
        </div>`).join('')}</div>`;

  const actions = leave.status === 'pending' ? `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-success text-white fw-bold"><i class="bi bi-check2-square"></i> พิจารณาและลงนาม</div>
      <div class="card-body">
        <form action="/supervisor/approve/${leave.id}" method="POST" enctype="multipart/form-data" id="approveForm">
          <div class="mb-3"><label class="form-label fw-bold">Upload ไฟล์ใบลาที่ลงนามแล้ว <span class="text-danger">*</span></label>
            <input type="file" name="signed_form" class="form-control" accept=".pdf" required id="signedFile">
            <div class="form-text">ดาวน์โหลดใบลา ลงนาม แล้วอัพโหลดกลับเข้าระบบ</div></div>
          <div class="mb-3"><label class="form-label fw-bold">ความเห็น (ถ้ามี)</label>
            <textarea name="comment" class="form-control" rows="2" placeholder="กรอกความเห็นเพิ่มเติม"></textarea></div>
          <div class="d-flex gap-2 flex-wrap">
            <button type="submit" class="btn btn-success"><i class="bi bi-check-circle"></i> อนุมัติ</button>
            <button type="button" class="btn btn-danger" data-bs-toggle="modal" data-bs-target="#rejectModal"><i class="bi bi-x-circle"></i> ไม่อนุมัติ</button>
            <a href="/supervisor" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> ย้อนกลับ</a>
          </div>
        </form>
      </div></div>
    <div class="modal fade" id="rejectModal" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header bg-danger text-white"><h5 class="modal-title"><i class="bi bi-x-circle"></i> ไม่อนุมัติใบลา</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
        <form action="/supervisor/reject/${leave.id}" method="POST">
          <div class="modal-body">
            <div class="mb-3"><label class="form-label fw-bold">เหตุผลที่ไม่อนุมัติ</label>
              <textarea name="comment" class="form-control" rows="3" placeholder="กรอกเหตุผล"></textarea></div>
          </div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">ยกเลิก</button>
            <button type="submit" class="btn btn-danger">ยืนยันไม่อนุมัติ</button></div>
        </form>
      </div></div>
    </div>` : '';

  const body = `<div class="row justify-content-center"><div class="col-lg-8">
    <h5 class="fw-bold mb-3"><i class="bi bi-clipboard-check"></i> พิจารณาใบลา #${leave.id}</h5>
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-light fw-bold"><i class="bi bi-info-circle"></i> ข้อมูลการลา</div>
      <div class="card-body"><div class="row g-3">
        <div class="col-md-6"><label class="form-label text-muted">ชื่อผู้ลา</label><div class="fw-bold">${esc(leave.staff_name)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">Email</label><div>${esc(leave.staff_email)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">ภาควิชา/งาน</label><div>${esc(leave.dept_name)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">ประเภทการลา</label><div><span class="badge bg-info text-dark">${esc(leave.leave_type)}</span></div></div>
        <div class="col-md-6"><label class="form-label text-muted">วันที่เริ่มลา</label><div>${esc(leave.start_date)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">วันที่สิ้นสุดลา</label><div>${esc(leave.end_date)}</div></div>
        ${leave.reason ? `<div class="col-12"><label class="form-label text-muted">เหตุผล</label><div>${esc(leave.reason)}</div></div>` : ''}
        <div class="col-12"><label class="form-label text-muted">สถานะ</label><div>${statusBadge(leave.status)}</div></div>
      </div></div></div>
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-light fw-bold"><i class="bi bi-paperclip"></i> ไฟล์แนบ</div>
      <div class="card-body">${fileRows}</div></div>
    ${actions}
  </div></div>`;

  return layout({
    title: 'พิจารณาใบลา - ระบบการลา',
    user, navColor: 'supervisor', activeNav: 'supervisor',
    content: body
  });
}

function adminDashboard(user, forwardList, myLeaves) {
  const fwdBody = forwardList.length === 0
    ? `<div class="text-center py-5"><i class="bi bi-inbox display-1 text-muted"></i><p class="text-muted mt-3">ยังไม่มีรายการที่อนุมัติแล้วและรอส่งต่อ</p></div>`
    : `<div class="table-responsive"><table class="table table-hover align-middle bg-white rounded shadow-sm">
        <thead class="table-light"><tr><th>ลำดับ</th><th>ชื่อผู้ลา</th><th>ภาควิชา/งาน</th><th>ประเภทการลา</th><th>วันที่ลา</th><th>สถานะ</th><th>จัดการ</th></tr></thead>
        <tbody>
        ${forwardList.map((l, i) => `<tr>
          <td>${i + 1}</td>
          <td><i class="bi bi-person"></i> ${esc(l.staff_name)}</td>
          <td><small>${esc(l.dept_name)}</small></td>
          <td><span class="badge bg-info text-dark">${esc(l.leave_type)}</span></td>
          <td><small>${esc(l.start_date)}<br><i class="bi bi-arrow-down"></i> ${esc(l.end_date)}</small></td>
          <td>${statusBadge(l.status)}</td>
          <td><a href="/admin/manage/${l.id}" class="btn btn-sm btn-outline-primary"><i class="bi bi-gear"></i> จัดการ</a></td>
        </tr>`).join('')}
        </tbody></table></div>`;

  const myBody = myLeaves.length === 0
    ? `<div class="text-center py-5"><i class="bi bi-inbox display-1 text-muted"></i><p class="text-muted mt-3">ยังไม่เคยยื่นใบลา</p><a href="/admin/submit" class="btn btn-primary mt-2"><i class="bi bi-plus-circle"></i> ยื่นใบลาใหม่</a></div>`
    : `<div class="table-responsive"><table class="table table-hover align-middle bg-white rounded shadow-sm">
        <thead class="table-light"><tr><th>ลำดับ</th><th>ประเภทการลา</th><th>วันที่ลา</th><th>สถานะ</th><th>วันที่สร้าง</th><th>จัดการ</th></tr></thead>
        <tbody>
        ${myLeaves.map((l, i) => `<tr>
          <td>${i + 1}</td>
          <td><span class="badge bg-info text-dark">${esc(l.leave_type)}</span></td>
          <td><small>${esc(l.start_date)}<br><i class="bi bi-arrow-down"></i> ${esc(l.end_date)}</small></td>
          <td>${statusBadge(l.status)}</td>
          <td><small>${esc(l.created_at)}</small></td>
          <td>${l.supervisor_comment ? `<button class="btn btn-sm btn-outline-secondary" data-bs-toggle="tooltip" title="${esc(l.supervisor_comment)}"><i class="bi bi-chat-left-text"></i></button>` : ''}</td>
        </tr>`).join('')}
        </tbody></table></div>`;

  const body = `<ul class="nav nav-tabs mb-3" id="adminTab" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="forwardTabBtn" data-bs-toggle="tab" data-bs-target="#forwardTab" type="button" role="tab">
          <i class="bi bi-send"></i> ส่งต่อเอกสาร ${forwardList.length > 0 ? `<span class="badge bg-primary ms-1">${forwardList.length}</span>` : ''}
        </button></li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="myTabBtn" data-bs-toggle="tab" data-bs-target="#myTab" type="button" role="tab">
          <i class="bi bi-person"></i> ใบลาของฉัน ${myLeaves.length > 0 ? `<span class="badge bg-secondary ms-1">${myLeaves.length}</span>` : ''}
        </button></li>
    </ul>
    <div class="tab-content">
      <div class="tab-pane fade show active" id="forwardTab" role="tabpanel">
        <h5 class="fw-bold mb-3"><i class="bi bi-send"></i> รายการส่งต่อเอกสารการลา</h5>${fwdBody}
      </div>
      <div class="tab-pane fade" id="myTab" role="tabpanel">
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h5 class="fw-bold mb-0"><i class="bi bi-person"></i> ประวัติการลาของฉัน</h5>
          <a href="/admin/submit" class="btn btn-primary btn-sm"><i class="bi bi-plus-circle"></i> ยื่นใบลาใหม่</a>
        </div>${myBody}
      </div>
    </div>
    <div class="d-md-none fixed-bottom bg-white border-top p-2 text-center"><a href="/admin/submit" class="btn btn-primary w-100"><i class="bi bi-plus-circle"></i> ยื่นใบลาใหม่</a></div>
    <script>
      var params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'my') {
        var tb = document.getElementById('myTabBtn');
        if (tb) new bootstrap.Tab(tb).show();
      }
    </script>`;

  return layout({
    title: 'ระบบการลา - หน้าเจ้าหน้าที่ธุรการ',
    user, navColor: 'admin', activeNav: 'admin',
    content: body
  });
}

function adminSubmit(user, error) {
  return leaveFormPage('admin', user, error, '/admin/submit');
}

function managePage(user, leave, files, settings, forwardPath, downloadPrefix) {
  const fileRows = files.length === 0
    ? '<p class="text-muted">ไม่มีไฟล์แนบ</p>'
    : `<div class="list-group">${files.map(f => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div><i class="bi bi-file-earmark-pdf text-danger"></i> ${esc(f.original_name)}<br><small class="text-muted">(${esc(f.file_type)})</small></div>
          <a href="${downloadPrefix}/${leave.id}/${esc(f.file_type)}" class="btn btn-sm btn-outline-primary"><i class="bi bi-download"></i> ดาวน์โหลด</a>
        </div>`).join('')}</div>`;

  const forwardForm = leave.status === 'approved' ? `
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-primary text-white fw-bold"><i class="bi bi-envelope"></i> ส่งต่อไฟล์ไปยังงาน HR</div>
      <div class="card-body">
        <form id="forwardForm">
          <div class="mb-3"><label class="form-label fw-bold">Email ของเจ้าหน้าที่บุคคล / HR <span class="text-danger">*</span></label>
            <input type="email" class="form-control" id="hrEmail" value="${esc(settings.hr_email)}" required>
            <div class="form-text">ระบุ email ของเจ้าหน้าที่บุคคลที่ต้องการส่งเอกสารไป</div></div>
          <div class="border rounded p-3 bg-light mb-3">
            <h6 class="fw-bold mb-3"><i class="bi bi-gear"></i> ตั้งค่า Email API (สำหรับ Workers)</h6>
            <div class="row g-2">
              <div class="col-12"><label class="form-label small">API URL</label>
                <input type="text" class="form-control form-control-sm" id="apiUrl" value="${esc(settings.api_url)}" placeholder="https://api.resend.com/emails"></div>
              <div class="col-md-6"><label class="form-label small">API Key</label>
                <input type="password" class="form-control form-control-sm" id="apiKey" value="${esc(settings.api_key)}" placeholder="re_..."></div>
              <div class="col-md-6"><label class="form-label small">From Email</label>
                <input type="email" class="form-control form-control-sm" id="fromEmail" value="${esc(settings.from_email)}" placeholder="leave-system@example.com"></div>
              <div class="col-12"><small class="text-muted">ใช้ Resend-compatible API (POST JSON: from/to/subject/text/attachments base64) ถ้าไม่มี API Key จะบันทึกสถานะเป็นการจำลองการส่ง</small></div>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" id="forwardBtn"><i class="bi bi-send"></i> ส่งต่อเอกสาร</button>
          <span id="forwardMsg" class="ms-2"></span>
        </form>
      </div></div>` : '';

  const body = `<div class="row justify-content-center"><div class="col-lg-8">
    <h5 class="fw-bold mb-3"><i class="bi bi-send"></i> จัดการใบลา #${leave.id}</h5>
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-light fw-bold"><i class="bi bi-info-circle"></i> ข้อมูลการลา</div>
      <div class="card-body"><div class="row g-3">
        <div class="col-md-6"><label class="form-label text-muted">ชื่อผู้ลา</label><div class="fw-bold">${esc(leave.staff_name)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">Email</label><div>${esc(leave.staff_email)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">ภาควิชา/งาน</label><div>${esc(leave.dept_name)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">ประเภทการลา</label><div><span class="badge bg-info text-dark">${esc(leave.leave_type)}</span></div></div>
        <div class="col-md-6"><label class="form-label text-muted">วันที่เริ่มลา</label><div>${esc(leave.start_date)}</div></div>
        <div class="col-md-6"><label class="form-label text-muted">วันที่สิ้นสุดลา</label><div>${esc(leave.end_date)}</div></div>
        ${leave.reason ? `<div class="col-12"><label class="form-label text-muted">เหตุผล</label><div>${esc(leave.reason)}</div></div>` : ''}
        <div class="col-12"><label class="form-label text-muted">สถานะ</label><div>${statusBadge(leave.status)}</div></div>
        ${leave.supervisor_comment ? `<div class="col-12"><label class="form-label text-muted">ความเห็นหัวหน้า</label><div class="border rounded p-2 bg-light">${esc(leave.supervisor_comment)}</div></div>` : ''}
      </div></div></div>
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-light fw-bold"><i class="bi bi-paperclip"></i> ไฟล์แนบ</div>
      <div class="card-body">${fileRows}</div></div>
    ${forwardForm}
    <a href="/admin" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> กลับไปรายการ</a>
  </div></div>
  <script>
    if (document.getElementById('forwardForm')) {
      document.getElementById('forwardForm').addEventListener('submit', async function(e){
        e.preventDefault();
        var btn = document.getElementById('forwardBtn'), msg = document.getElementById('forwardMsg');
        btn.disabled = true;
        msg.innerHTML = '<span class="text-primary"><i class="bi bi-hourglass"></i> กำลังส่ง...</span>';
        var payload = {
          hr_email: document.getElementById('hrEmail').value,
          api_url: document.getElementById('apiUrl').value,
          api_key: document.getElementById('apiKey').value,
          from_email: document.getElementById('fromEmail').value
        };
        try {
          var resp = await fetch('${forwardPath}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await resp.json();
          if (data.success) {
            msg.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> ' + (data.simulated ? 'ส่งต่อสำเร็จ (จำลองการส่ง / อีเมลไม่ถูกส่งจริง)' : 'ส่งต่อสำเร็จ') + '</span>';
            setTimeout(() => location.reload(), 1500);
          } else {
            msg.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle"></i> ' + data.error + '</span>';
            btn.disabled = false;
          }
        } catch (err) {
          msg.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle"></i> เกิดข้อผิดพลาด</span>';
          btn.disabled = false;
        }
      });
    }
  </script>`;

  return layout({
    title: 'จัดการใบลา - ระบบการลา',
    user, navColor: 'admin', activeNav: 'admin',
    content: body
  });
}

export default {
  LEAVE_TYPES,
  esc,
  layout,
  loginPage,
  staffDashboard,
  staffSubmit,
  supervisorDashboard,
  reviewPage,
  adminDashboard,
  adminSubmit,
  managePage,
  statusBadge
};