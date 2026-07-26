/**
 * ============================================
 * ELECTRICAL MONITORING SYSTEM v2.0
 * Google Apps Script - REST API with Authentication
 * ============================================
 * 
 * Sheets ที่ต้องสร้าง:
 * 1. DATA    - ข้อมูลค่าไฟฟ้า
 * 2. USERS   - ข้อมูลผู้ใช้งาน
 * 3. SETTINGS - การตั้งค่าระบบ
 * 
 * วิธีใช้:
 * 1. สร้าง Google Sheet ใหม่
 * 2. สร้าง Sheet ชื่อ: DATA, USERS, SETTINGS
 * 3. ใส่ Header ตามฟังก์ชัน initSheets()
 * 4. วางโค้ดนี้ใน Apps Script
 * 5. Deploy เป็น Web App (Execute as: Me, Access: Anyone)
 * 6. รัน initSheets() ครั้งแรกเพื่อสร้าง Admin เริ่มต้น
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    SHEETS: {
        DATA: 'DATA',
        USERS: 'USERS',
        SETTINGS: 'SETTINGS'
    },
    MAX_DATA_ROWS: 10000,
    DEFAULT_ADMIN: {
        username: 'admin',
        password: 'admin123',
        fullName: 'ผู้ดูแลระบบ',
        role: 'admin',
        email: 'admin@example.com'
    }
};

// ============================================
// MAIN HANDLERS
// ============================================
function doGet(e) {
    try {
        const action = e.parameter.action || 'getLatest';

        switch (action) {
            case 'login':
                return handleLogin(e.parameter.username, e.parameter.password);
            case 'getLatest':
                return handleGetLatest(e.parameter.limit);
            case 'getAll':
                return handleGetAll();
            case 'getUsers':
                return handleGetUsers();
            case 'getSettings':
                return handleGetSettings();
            default:
                return jsonResponse({ status: 'error', message: 'Unknown action' }, 400);
        }
    } catch (error) {
        return jsonResponse({ status: 'error', message: error.toString() }, 500);
    }
}

function doPost(e) {
    try {
        let payload;
        try {
            payload = JSON.parse(e.postData.contents);
        } catch (err) {
            return jsonResponse({ status: 'error', message: 'Invalid JSON' }, 400);
        }

        const action = payload.action || 'saveData';

        switch (action) {
            case 'saveData':
                return handleSaveData(payload);
            case 'addUser':
                return handleAddUser(payload);
            case 'deleteUser':
                return handleDeleteUser(payload);
            case 'saveSettings':
                return handleSaveSettings(payload);
            default:
                return jsonResponse({ status: 'error', message: 'Unknown action' }, 400);
        }
    } catch (error) {
        return jsonResponse({ status: 'error', message: error.toString() }, 500);
    }
}

function doOptions() {
    return jsonResponse({ status: 'ok' });
}

// ============================================
// AUTHENTICATION
// ============================================
function handleLogin(username, password) {
    if (!username || !password) {
        return jsonResponse({ status: 'error', message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const sheet = getOrCreateSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();

    // ข้าม Header (แถวที่ 1)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[0] === username && row[1] === password) {
            if (row[5] !== 'active') {
                return jsonResponse({ status: 'error', message: 'บัญชีนี้ถูกปิดใช้งาน' });
            }
            return jsonResponse({
                status: 'success',
                token: Utilities.getUuid(),
                user: {
                    username: row[0],
                    fullName: row[2],
                    role: row[3],
                    email: row[4]
                }
            });
        }
    }

    return jsonResponse({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
}

// ============================================
// DATA OPERATIONS
// ============================================
function handleGetLatest(limit) {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.DATA);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        return jsonResponse({ status: 'success', count: 0, data: [] });
    }

    const dataLimit = parseInt(limit) || 50;
    const startRow = Math.max(2, lastRow - dataLimit + 1);
    const numRows = lastRow - startRow + 1;

    const range = sheet.getRange(startRow, 1, numRows, 8);
    const values = range.getValues();

    const data = values.map(row => ({
        timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0],
        device: row[1],
        voltage: row[2],
        current: row[3],
        power: row[4],
        energy: row[5],
        powerFactor: row[6],
        frequency: row[7]
    }));

    return jsonResponse({ status: 'success', count: data.length, data: data });
}

function handleGetAll() {
    return handleGetLatest(CONFIG.MAX_DATA_ROWS);
}

function handleSaveData(payload) {
    const validation = validateElectricalData(payload);
    if (!validation.valid) {
        return jsonResponse({ status: 'error', message: validation.message }, 400);
    }

    const sheet = getOrCreateSheet(CONFIG.SHEETS.DATA);
    const rowData = [
        new Date(),
        payload.device || 'Unknown',
        parseFloat(payload.voltage) || 0,
        parseFloat(payload.current) || 0,
        parseFloat(payload.power) || 0,
        parseFloat(payload.energy) || 0,
        parseFloat(payload.powerFactor) || 0,
        parseFloat(payload.frequency) || 0
    ];

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);

    // จัดรูปแบบ
    sheet.getRange(lastRow + 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange(lastRow + 1, 3, 1, 2).setNumberFormat('0.0');
    sheet.getRange(lastRow + 1, 5, 1, 1).setNumberFormat('0');
    sheet.getRange(lastRow + 1, 6, 1, 1).setNumberFormat('0.00');
    sheet.getRange(lastRow + 1, 7, 1, 1).setNumberFormat('0.00');
    sheet.getRange(lastRow + 1, 8, 1, 1).setNumberFormat('0.0');

    cleanupOldData(sheet);

    return jsonResponse({ status: 'success', message: 'Data saved', row: lastRow + 1 });
}

// ============================================
// USER MANAGEMENT (Admin Only)
// ============================================
function handleGetUsers() {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();

    const users = [];
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        users.push({
            username: row[0],
            fullName: row[2],
            role: row[3],
            email: row[4],
            status: row[5],
            createdAt: row[6] instanceof Date ? row[6].toISOString() : row[6]
        });
    }

    return jsonResponse({ status: 'success', users: users });
}

function handleAddUser(payload) {
    if (!payload.username || !payload.password || !payload.fullName) {
        return jsonResponse({ status: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, 400);
    }

    const sheet = getOrCreateSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();

    // ตรวจสอบว่ามี username ซ้ำหรือไม่
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.username) {
            return jsonResponse({ status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }, 400);
        }
    }

    const rowData = [
        payload.username,
        payload.password,
        payload.fullName,
        payload.role || 'user',
        payload.email || '',
        'active',
        new Date()
    ];

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, 1, rowData.length).setValues([rowData]);
    sheet.getRange(lastRow + 1, 7).setNumberFormat('yyyy-mm-dd hh:mm:ss');

    return jsonResponse({ status: 'success', message: 'User created' });
}

function handleDeleteUser(payload) {
    if (!payload.username) {
        return jsonResponse({ status: 'error', message: 'กรุณาระบุชื่อผู้ใช้' }, 400);
    }

    // ห้ามลบ admin เริ่มต้น
    if (payload.username === 'admin') {
        return jsonResponse({ status: 'error', message: 'ไม่สามารถลบผู้ดูแลระบบเริ่มต้นได้' }, 403);
    }

    const sheet = getOrCreateSheet(CONFIG.SHEETS.USERS);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === payload.username) {
            sheet.deleteRow(i + 1);
            return jsonResponse({ status: 'success', message: 'User deleted' });
        }
    }

    return jsonResponse({ status: 'error', message: 'ไม่พบผู้ใช้' }, 404);
}

// ============================================
// SETTINGS
// ============================================
function handleGetSettings() {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS);
    const data = sheet.getDataRange().getValues();
    const settings = {};

    for (let i = 1; i < data.length; i++) {
        const key = data[i][0];
        const value = data[i][1];
        settings[key] = value;
    }

    return jsonResponse({ status: 'success', settings: settings });
}

function handleSaveSettings(payload) {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS);
    const settings = {
        voltageMax: payload.voltageMax || 240,
        voltageMin: payload.voltageMin || 200,
        currentMax: payload.currentMax || 30,
        frequencyMax: payload.frequencyMax || 65,
        frequencyMin: payload.frequencyMin || 45,
        updateInterval: payload.updateInterval || 5000
    };

    // ล้างข้อมูลเก่าแล้วบันทึกใหม่
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
    }

    const rows = Object.entries(settings).map(([key, value]) => [key, value]);
    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, 2).setValues(rows);
    }

    return jsonResponse({ status: 'success', message: 'Settings saved' });
}

// ============================================
// SHEET HELPERS
// ============================================
function getOrCreateSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        sheet = ss.insertSheet(sheetName);

        if (sheetName === CONFIG.SHEETS.DATA) {
            sheet.getRange(1, 1, 1, 8).setValues([['Timestamp', 'Device', 'Voltage', 'Current', 'Power', 'Energy', 'PowerFactor', 'Frequency']]);
            formatHeader(sheet, 8);
            sheet.setColumnWidth(1, 180);
            sheet.setColumnWidth(2, 150);
            sheet.setColumnWidths(3, 6, 100);
            sheet.setFrozenRows(1);
        } else if (sheetName === CONFIG.SHEETS.USERS) {
            sheet.getRange(1, 1, 1, 7).setValues([['Username', 'Password', 'FullName', 'Role', 'Email', 'Status', 'CreatedAt']]);
            formatHeader(sheet, 7);
            sheet.setColumnWidths(1, 7, 140);
            sheet.setFrozenRows(1);
        } else if (sheetName === CONFIG.SHEETS.SETTINGS) {
            sheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
            formatHeader(sheet, 2);
            sheet.setColumnWidth(1, 200);
            sheet.setColumnWidth(2, 200);
        }
    }

    return sheet;
}

function formatHeader(sheet, numCols) {
    const headerRange = sheet.getRange(1, 1, 1, numCols);
    headerRange.setFontWeight('bold')
               .setBackground('#1a237e')
               .setFontColor('#ffffff');
}

function cleanupOldData(sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow > CONFIG.MAX_DATA_ROWS + 1) {
        sheet.deleteRows(2, lastRow - CONFIG.MAX_DATA_ROWS - 1);
    }
}

// ============================================
// VALIDATION
// ============================================
function validateElectricalData(data) {
    if (!data || typeof data !== 'object') {
        return { valid: false, message: 'No data provided' };
    }

    const required = ['device', 'voltage', 'current', 'power', 'energy', 'powerFactor', 'frequency'];
    for (const field of required) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            return { valid: false, message: `Missing field: ${field}` };
        }
    }

    const v = parseFloat(data.voltage);
    if (isNaN(v) || v < 0 || v > 300) return { valid: false, message: 'Voltage 0-300V' };

    const a = parseFloat(data.current);
    if (isNaN(a) || a < 0 || a > 100) return { valid: false, message: 'Current 0-100A' };

    const p = parseFloat(data.power);
    if (isNaN(p) || p < 0) return { valid: false, message: 'Power >= 0' };

    const e = parseFloat(data.energy);
    if (isNaN(e) || e < 0) return { valid: false, message: 'Energy >= 0' };

    const pf = parseFloat(data.powerFactor);
    if (isNaN(pf) || pf < 0 || pf > 1) return { valid: false, message: 'PF 0-1' };

    const f = parseFloat(data.frequency);
    if (isNaN(f) || f < 45 || f > 65) return { valid: false, message: 'Frequency 45-65Hz' };

    return { valid: true, message: 'Valid' };
}

// ============================================
// RESPONSE HELPER
// ============================================
function jsonResponse(data, statusCode) {
    const response = ContentService.createTextOutput(JSON.stringify(data));
    response.setMimeType(ContentService.MimeType.JSON);
    return response;
}

// ============================================
// INITIALIZATION (รันครั้งแรก)
// ============================================
function initSheets() {
    // สร้างทุก Sheet
    getOrCreateSheet(CONFIG.SHEETS.DATA);
    getOrCreateSheet(CONFIG.SHEETS.USERS);
    getOrCreateSheet(CONFIG.SHEETS.SETTINGS);

    // สร้าง Admin เริ่มต้น
    const userSheet = getOrCreateSheet(CONFIG.SHEETS.USERS);
    const userData = userSheet.getDataRange().getValues();

    let hasAdmin = false;
    for (let i = 1; i < userData.length; i++) {
        if (userData[i][0] === CONFIG.DEFAULT_ADMIN.username) {
            hasAdmin = true;
            break;
        }
    }

    if (!hasAdmin) {
        const adminRow = [
            CONFIG.DEFAULT_ADMIN.username,
            CONFIG.DEFAULT_ADMIN.password,
            CONFIG.DEFAULT_ADMIN.fullName,
            CONFIG.DEFAULT_ADMIN.role,
            CONFIG.DEFAULT_ADMIN.email,
            'active',
            new Date()
        ];
        const lastRow = userSheet.getLastRow();
        userSheet.getRange(lastRow + 1, 1, 1, adminRow.length).setValues([adminRow]);
        userSheet.getRange(lastRow + 1, 7).setNumberFormat('yyyy-mm-dd hh:mm:ss');
        Logger.log('Default admin created: username=admin, password=admin123');
    }

    // บันทึก Settings เริ่มต้น
    const settingsSheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS);
    const defaultSettings = [
        ['voltageMax', 240],
        ['voltageMin', 200],
        ['currentMax', 30],
        ['frequencyMax', 65],
        ['frequencyMin', 45],
        ['updateInterval', 5000]
    ];
    const sLastRow = settingsSheet.getLastRow();
    if (sLastRow <= 1) {
        settingsSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);
    }

    Logger.log('Initialization complete!');
}

// ============================================
// TEST FUNCTIONS
// ============================================
function testSaveData() {
    const testData = {
        device: 'Test-Meter-01',
        voltage: 220.5,
        current: 12.3,
        power: 2712.15,
        energy: 1500.25,
        powerFactor: 0.92,
        frequency: 50.0
    };
    const result = handleSaveData(testData);
    Logger.log(result.getContent());
}

function testLogin() {
    const result = handleLogin('admin', 'admin123');
    Logger.log(result.getContent());
}

function clearAllData() {
    const sheet = getOrCreateSheet(CONFIG.SHEETS.DATA);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
        Logger.log('Data cleared');
    }
}