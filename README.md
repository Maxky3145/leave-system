# ระบบการลา (Leave Management System)

ระบบติดตามสถานะเอกสารการลา สำหรับอาจารย์/บุคลากร (Staff), หัวหน้างาน (Teacher/Supervisor) และเจ้าหน้าที่ธุรการ (Admin)

**ออนไลน์ที่:** https://swu-leave.chanok-282.workers.dev (Cloudflare Workers)

## สองเวอร์ชันของระบบ

| เวอร์ชัน | โฟลเดอร์ | รันที่ไหน | Database | ไฟล์แนบ |
|---|---|---|---|---|
| **Cloudflare (แนะนำ)** | `worker/` | https://swu-leave.chanok-282.workers.dev | Cloudflare D1 | Cloudflare KV |
| **Local (เดิม)** | รากโปรเจกต์ | http://localhost:3000 | SQLite (sql.js) | uploads/ folder |

---

## เวอร์ชัน Cloudflare (Deploy แล้ว)

Stack: Cloudflare Workers + Hono + D1 + KV + Bootstrap 5

### การ Deploy ใหม่
```bash
cd worker
npm install
npx wrangler d1 migrations apply swu-leave-db --remote   # สร้างตาราง + seed ผู้ใช้ครั้งแรก
npx wrangler deploy
```

### การตั้งค่า
- **SESSION_SECRET**: ตั้งค่าได้ใน `worker/wrangler.toml` → เปลี่ยนจากค่าเริ่มต้นก่อนใช้งานจริง
- **ไฟล์ใบลา**: เก็บใน KV namespace `FILES` (ค่าสูงสุด 25MB/ไฟล์, ใช้ได้กับ PDF <10MB)

### ข้อจำกัดที่ต่างจากเวอร์ชัน Local
- **อีเมล**: บน Cloudflare Workers ไม่มี SMTP แบบ nodemailer ตรงๆ → ระบบใช้ **`worker-mailer`** (ไลบรารี SMTP ผ่าน Cloudflare TCP Sockets API) ส่งอีเมลจริงพร้อมไฟล์แนบ PDF ได้
  - SWU ใช้ **Google Workspace** (MX = Google) โดย `smtp.swu.ac.th` เป็น SMTP ภายในเท่านั้น (ไม่ resolve ใน DNS สาธารณะ) → **ไม่สามารถใช้จาก Cloudflare ได้**
  - แนะนำให้ใช้ **`smtp.gmail.com:465` (SSL)** + **App Password** ของบัญชี `@g.swu.ac.th` เพื่อส่งถึง inbox ของ มศว รับประกันการจัดส่ง
  - วิธีสร้าง App Password: เปิด 2-Step Verification ที่ `myaccount.google.com` → สร้าง App Password ที่ `myaccount.google.com/apppasswords` (16 หลัก)
  - Admin ตั้งค่า **SMTP Host / Port / User / Pass + SSL** ในหน้าจัดการใบลา (หน้า `/admin/manage/:leaveId`)
  - ถ้าไม่กรอก User/Pass ระบบจะบันทึกสถานะเป็น **ส่งต่อสำเร็จ (จำลอง)** — สถานะในระบบยังครบ แต่ไม่มีอีเมลจริงถูกส่ง
- **หมายเหตุ**: ตั้งค่า SMTP ด้วยค่าเริ่มต้น `smtp.gmail.com:465` (กาช่อง SSL)

---

## เวอร์ชัน Local (เดิม)

### การติดตั้ง
```bash
npm install
npm run import   # นำเข้าผู้ใช้จาก data.xlsx ลงใน SQLite
npm start        # เปิด http://localhost:3000
```

## บัญชีผู้ใช้ (Password เริ่มต้นทั้งหมด: `123456`)

| บทบาท | Email | รายละเอียด |
|--------|-------|-----------|
| **Admin** | `chanok@g.swu.ac.th` | เจ้าหน้าที่ธุรการ (ส่งต่อไฟล์ไป HR) |
| **Teacher** | `narut@g.swu.ac.th` | หัวหน้างาน (อนุมัติ/ลงนาม) |
| **Staff** | `songpol@g.swu.ac.th` | อาจารย์/บุคลากร (ยื่นใบลา) |

## ฟังก์ชันของระบบ

### 1. Staff (บุคลากร)
- ยื่นใบลา 12 ประเภท (ลาป่วย, ลาคลอด, ลากิจส่วนตัว, ลาพักผ่อน, ลาอุปสมบท/ฮัจย์, เป็นต้น)
- แนบไฟล์ใบลาจาก Huris (1 ไฟล์ PDF)
- ถ้าเป็น **ลาไปต่างประเทศ** ต้องแนบ 2 ไฟล์ (ใบลา + แบบขออนุมัติเดินทาง HRM-01)
- ดูประวัติการลาและสถานะ

### 2. สถานะเอกสาร
| สถานะ | ความหมาย |
|--------|----------|
| `pending` | รอพิจารณา/รอดำเนินการ |
| `approved` | อนุมัติโดยหัวหน้าแล้ว |
| `rejected` | ไม่อนุมัติ |
| `forwarded` | ส่งต่อไปงาน HR แล้ว |

### 3. Supervisor (หัวหน้างาน)
- เห็นรายการลาของบุคลากรในภาควิชา/งานที่ตนเองสังกัด (สถานะ รอพิจารณา)
- รวมถึงใบลาของเจ้าหน้าที่ธุรการ (Admin) ที่อยู่ในภาควิชาเดียวกัน
- ดาวน์โหลดไฟล์ใบลา → ลงนาม → อัพโหลดไฟล์ที่ลงนามแล้วกลับ
- อนุมัติหรือไม่อนุมัติ พร้อมแสดงความคิดเห็น

### 4. Admin (เจ้าหน้าที่ธุรการ)
- หน้าแบ่งเป็น 2 แท็บ: **ส่งต่อเอกสาร** และ **ใบลาของฉัน**
- **ส่งต่อเอกสาร:** เห็นรายการลาที่อนุมัติแล้ว ดาวน์โหลดไฟล์ที่ลงนามเรียบร้อย และส่งต่อเอกสารทางอีเมลไปยังเจ้าหน้าที่บุคคล/HR โดยระบุ email
- **ใบลาของฉัน:** Admin สามารถยื่นใบลาของตนเองได้เหมือน Staff (แนบไฟล์ PDF, ลาไปต่างประเทศต้อง 2 ไฟล์) และติดตามสถานะ

## โครงสร้างโปรเจกต์
```
worker/              # เวอร์ชัน Cloudflare Workers (แนะนำ)
  wrangler.toml      # config: D1 + KV + vars
  migrations/        # SQL migrations (schema + seed ผู้ใช้)
  src/index.js       # Hono app (routes ทั้งหมด)
  src/templates.js   # HTML templates
server.js            # จุดเริ่มต้น Express (เวอร์ชัน Local)
db.js                # จัดการ SQLite
import_data.js       # นำเข้าข้อมูลจาก data.xlsx
routes/              # Express routes (เวอร์ชัน Local)
views/               # EJS templates (เวอร์ชัน Local)
public/              # CSS
uploads/             # ไฟล์ใบลาที่อัพโหลด (เวอร์ชัน Local)
data/                # ฐานข้อมูล SQLite (เวอร์ชัน Local)
```