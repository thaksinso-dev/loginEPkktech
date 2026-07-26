# ⚡ Electrical Monitoring System v2.0

> **SCADA Dashboard พร้อมระบบ Login และจัดการผู้ใช้**
> 
> รองรับผู้ดูแลระบบ (Admin) และผู้ใช้งาน (User)
> พัฒนาด้วย Google Sheets + Google Apps Script + HTML5/CSS3/JS

---

## 📁 โครงสร้างไฟล์

```
electrical-monitoring-system-v2/
├── index.html      # SPA: Login + Dashboard + Admin Panel
├── style.css       # Glassmorphism Theme + Sidebar + Login
├── script.js       # Auth, Routing, Charts, API, Admin
├── Code.gs         # GAS Backend: Auth, Users, Data, Settings
└── README.md       # คู่มือการใช้งาน
```

---

## ✨ ฟีเจอร์ใหม่ใน v2.0

### 🔐 ระบบ Authentication
- **Login** ด้วย Username/Password
- **Session Management** ด้วย LocalStorage
- **Auto-redirect** ไปหน้า Login หากยังไม่ได้เข้าสู่ระบบ
- **Logout** พร้อมล้าง Session

### 👥 ระบบจัดการผู้ใช้ (Admin Only)
- **เพิ่มผู้ใช้ใหม่** พร้อมกำหนดสิทธิ์
- **ลบผู้ใช้** (ห้ามลบ Admin เริ่มต้น)
- **แสดงรายชื่อผู้ใช้ทั้งหมด** พร้อมสถานะ
- **Role Badge** แยก Admin (สีม่วง) / User (สีฟ้า)

### 🔒 Role-Based Access Control
| ฟีเจอร์ | Admin | User |
|---------|-------|------|
| ดู Dashboard | ✅ | ✅ |
| บันทึกข้อมูล | ✅ | ✅ |
| ดูประวัติข้อมูล | ✅ | ✅ |
| จัดการผู้ใช้ | ✅ | ❌ |
| ตั้งค่าระบบ | ✅ | ❌ |

### 📊 ประวัติข้อมูล (History)
- **กรองตามวันที่** และ **อุปกรณ์**
- **Pagination** แบ่งหน้า
- **Dropdown อุปกรณ์** อัปเดตอัตโนมัติ

### ⚙️ ตั้งค่าระบบ (Admin Only)
- ปรับเกณฑ์แจ้งเตือน (Voltage, Current, Frequency)
- ปรับช่วงเวลาอัปเดต (1-60 วินาที)
- บันทึกการตั้งค่าลง Google Sheet

---

## 🚀 วิธีติดตั้ง (Step-by-Step)

### ขั้นตอนที่ 1: สร้าง Google Sheet

1. เปิด [Google Sheets](https://sheets.new)
2. ตั้งชื่อ: `Electrical Monitoring System v2`
3. **สร้าง Sheet ใหม่** ให้มี 3 แท็บ:
   - `DATA`
   - `USERS`
   - `SETTINGS`

#### Sheet: DATA
แถวที่ 1 ใส่ Header:
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Timestamp | Device | Voltage | Current | Power | Energy | PowerFactor | Frequency |

#### Sheet: USERS
แถวที่ 1 ใส่ Header:
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Username | Password | FullName | Role | Email | Status | CreatedAt |

#### Sheet: SETTINGS
แถวที่ 1 ใส่ Header:
| A | B |
|---|---|
| Key | Value |

### ขั้นตอนที่ 2: ติดตั้ง Google Apps Script

1. ใน Sheet → **Extensions** → **Apps Script**
2. ลบโค้ดเดิม → วางโค้ดจาก `Code.gs`
3. กด **Save** ตั้งชื่อ: `ElectricalMonitoringAPIv2`
4. **รันฟังก์ชัน `initSheets()` ครั้งแรก**:
   - เลือกฟังก์ชัน `initSheets` ใน Dropdown
   - กด **Run** (▶️)
   - อนุญาต Permission ที่ขอ
   - ตรวจสอบว่ามี Admin ถูกสร้างใน Sheet USERS

> **บัญชีเริ่มต้น**: username=`admin` / password=`admin123`

### ขั้นตอนที่ 3: Deploy Web App

1. คลิก **Deploy** → **New deployment**
2. เลือก **Web app**
3. ตั้งค่า:
   - **Description**: `EMS API v2`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. กด **Deploy** → อนุญาต Permission → คัดลอก **URL**

### ขั้นตอนที่ 4: อัปเดต Front-end

1. เปิด `script.js` → แก้ `CONFIG.GAS_URL`
   ```javascript
   GAS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
   ```
2. แทนที่ `YOUR_SCRIPT_ID` ด้วย URL ที่ได้รับ
3. เปิด `index.html` ในเบราว์เซอร์ หรือ Deploy บน GitHub Pages/Netlify

---

## 🔧 วิธีใช้งาน

### การ Login ครั้งแรก
- Username: `admin`
- Password: `admin123`
- เข้าสู่ระบบแล้วจะเห็นเมนูครบทุกรายการ (เพราะเป็น Admin)

### การสร้างผู้ใช้ใหม่
1. คลิกเมนู **จัดการผู้ใช้**
2. กดปุ่ม **เพิ่มผู้ใช้**
3. กรอกข้อมูล → เลือกสิทธิ์ `user` หรือ `admin`
4. กด **บันทึก**

### การ Logout
- คลิกปุ่ม **ออกจากระบบ** ที่ Sidebar ด้านล่าง

---

## 📋 API Endpoints

### GET Endpoints
| Endpoint | Parameters | คำอธิบาย |
|----------|-----------|---------|
| `?action=login` | `username`, `password` | เข้าสู่ระบบ |
| `?action=getLatest` | `limit` (optional) | ดึงข้อมูลล่าสุด |
| `?action=getAll` | - | ดึงข้อมูลทั้งหมด |
| `?action=getUsers` | - | ดึงรายชื่อผู้ใช้ |
| `?action=getSettings` | - | ดึงการตั้งค่า |

### POST Endpoints (JSON Body)
| Action | Fields | คำอธิบาย |
|--------|--------|---------|
| `saveData` | device, voltage, current, power, energy, powerFactor, frequency | บันทึกข้อมูลไฟฟ้า |
| `addUser` | username, password, fullName, email, role | เพิ่มผู้ใช้ |
| `deleteUser` | username | ลบผู้ใช้ |
| `saveSettings` | voltageMax, voltageMin, currentMax, frequencyMax, frequencyMin, updateInterval | บันทึกการตั้งค่า |

---

## 🛡️ ความปลอดภัย

- ✅ ตรวจสอบ Username/Password ก่อนเข้าใช้งาน
- ✅ แยกสิทธิ์ Admin/User
- ✅ ซ่อนเมนู Admin จากผู้ใช้ทั่วไป
- ✅ ห้ามลบ Admin เริ่มต้น
- ✅ ตรวจสอบข้อมูล Input ทั้ง Front-end และ Back-end
- ✅ ป้องกัน XSS (Escape HTML)
- ✅ จำกัดจำนวนแถวข้อมูล (ป้องกัน Sheet โตเกินไป)

---

## 🐛 แก้ไขปัญหาเบื้องต้น

### ลืมรหัสผ่าน Admin
1. เปิด Google Sheet → แท็บ `USERS`
2. หาแถวที่มี username = `admin`
3. แก้คอลัมน์ B (Password) เป็นรหัสผ่านใหม่

### ผู้ใช้ใหม่ Login ไม่ได้
- ตรวจสอบว่าสถานะ (Status) เป็น `active` ใน Sheet USERS
- ตรวจสอบว่าชื่อผู้ใช้และรหัสผ่านตรงกัน (case-sensitive)

### CORS Error
- ตรวจสอบว่า Deploy เป็น Web App แล้ว
- ตรวจสอบว่า `Access` ตั้งค่าเป็น `Anyone`

---

## 🔮 แนวทางพัฒนาต่อ

| Phase | ฟีเจอร์ |
|-------|---------|
| **v2.1** | แก้ไขรหัสผ่าน, รีเซ็ตรหัสผ่าน, โปรไฟล์ผู้ใช้ |
| **v2.2** | ส่ง Email/Line Notify เมื่อ Alarm |
| **v2.3** | รองรับหลายมิเตอร์, แยก Dashboard ตาม Zone |
| **v3.0** | เชื่อมต่อ ESP32/Arduino, MQTT, Firebase |

---

## 📄 License

MIT License

**พัฒนาโดย**: Senior Software Engineer Team
**สำหรับ**: โรงงานและอาคารอุตสาหกรรม

---

**หมายเหตุ**: หากพบปัญหา กรุณาตรวจสอบ Console Log (F12) และ Apps Script Log (View > Executions)