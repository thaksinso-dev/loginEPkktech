/**
 * ============================================
 * ELECTRICAL MONITORING SYSTEM v2.0
 * Front-end Controller with Authentication
 * ============================================
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    GAS_URL: 'https://script.google.com/macros/s/1DSt80km5bFjDB8C75gEyUefSfMk2Dy-mmfoG6MEtcms/exec',
    UPDATE_INTERVAL: 5000,
    MAX_HISTORY_POINTS: 20,
    HISTORY_PAGE_SIZE: 20,
    MAX_VALUES: {
        voltage: 300, current: 100, power: 5000,
        energy: 1000, pf: 1, frequency: 65
    },
    MIN_VALUES: {
        voltage: 0, current: 0, power: 0,
        energy: 0, pf: 0, frequency: 45
    },
    ALARM_THRESHOLDS: {
        voltage: { min: 200, max: 240 },
        current: { max: 30 },
        frequency: { min: 45, max: 65 }
    }
};

// ============================================
// GLOBAL STATE
// ============================================
const state = {
    currentUser: null,
    currentPage: 'dashboard',
    gauges: {},
    lineCharts: {},
    historyData: [],
    historyPage: 1,
    isOnline: true,
    lastFetchTime: null,
    alarmActive: false,
    updateTimer: null,
    sidebarOpen: false
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    bindGlobalEvents();
    updateClock();
    setInterval(updateClock, 1000);
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 600);
});

function checkAuthState() {
    const user = getStoredUser();
    if (user && user.token) {
        state.currentUser = user;
        showMainApp();
        initDashboard();
    } else {
        showLoginPage();
    }
}

function bindGlobalEvents() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('togglePassword').addEventListener('click', togglePasswordVisibility);
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    document.getElementById('dismissAlarm').addEventListener('click', hideAlarm);
    document.getElementById('manualForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('manualForm').addEventListener('reset', clearFormErrors);
    document.getElementById('prevPage').addEventListener('click', () => changeHistoryPage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changeHistoryPage(1));
    document.getElementById('btnFilter').addEventListener('click', applyHistoryFilter);
    document.getElementById('btnShowAddUser').addEventListener('click', showAddUserPanel);
    document.getElementById('btnCancelAddUser').addEventListener('click', hideAddUserPanel);
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);
}

// ============================================
// AUTHENTICATION
// ============================================
async function handleLogin(e) {
    e.preventDefault();
    clearLoginErrors();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username) { showLoginError('loginUsername', 'กรุณากรอกชื่อผู้ใช้'); return; }
    if (!password) { showLoginError('loginPassword', 'กรุณากรอกรหัสผ่าน'); return; }

    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> กำลังเข้าสู่ระบบ...';

    try {
        const url = `${CONFIG.GAS_URL}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
        const result = await response.json();

        if (result.status === 'success' && result.user) {
            const user = {
                username: result.user.username,
                fullName: result.user.fullName,
                role: result.user.role,
                token: result.token || btoa(username + ':' + Date.now()),
                loginTime: Date.now()
            };
            storeUser(user);
            state.currentUser = user;
            showLoginResult('เข้าสู่ระบบสำเร็จ', 'success');
            setTimeout(() => { showMainApp(); initDashboard(); }, 800);
        } else {
            showLoginResult(result.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
        }
    } catch (error) {
        console.error('Login Error:', error);
        showLoginResult('ไม่สามารถเชื่อมต่อกับระบบได้', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> เข้าสู่ระบบ';
    }
}

function handleLogout() {
    if (!confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) return;
    clearStoredUser();
    state.currentUser = null;
    if (state.updateTimer) { clearInterval(state.updateTimer); state.updateTimer = null; }
    Object.values(state.gauges).forEach(g => g.destroy());
    Object.values(state.lineCharts).forEach(c => c.destroy());
    state.gauges = {};
    state.lineCharts = {};
    showLoginPage();
    document.getElementById('loginForm').reset();
    clearLoginErrors();
}

// ============================================
// PAGE NAVIGATION
// ============================================
function navigateTo(page) {
    state.currentPage = page;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById('page' + page.charAt(0).toUpperCase() + page.slice(1));
    if (target) { target.classList.remove('hidden'); target.classList.add('active'); }

    const titles = {
        dashboard: '<i class="bi bi-speedometer2"></i> แดชบอร์ด',
        input: '<i class="bi bi-pencil-square"></i> บันทึกข้อมูล',
        history: '<i class="bi bi-clock-history"></i> ประวัติข้อมูล',
        users: '<i class="bi bi-people"></i> จัดการผู้ใช้',
        settings: '<i class="bi bi-gear"></i> ตั้งค่าระบบ'
    };
    document.getElementById('pageTitle').innerHTML = titles[page] || '';

    if (page === 'history') loadHistoryPage();
    if (page === 'users' && isAdmin()) loadUsersList();
    if (page === 'settings' && isAdmin()) loadSettings();

    if (window.innerWidth <= 1024) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function showLoginPage() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('sidebarUserName').textContent = state.currentUser.fullName || state.currentUser.username;
    document.getElementById('sidebarUserRole').textContent = state.currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
    document.getElementById('footerUser').textContent = `${state.currentUser.fullName} (${state.currentUser.role})`;
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('hidden', !isAdmin());
    });
}

function isAdmin() {
    return state.currentUser && state.currentUser.role === 'admin';
}

// ============================================
// LOCAL STORAGE
// ============================================
function storeUser(user) {
    try { localStorage.setItem('ems_user', JSON.stringify(user)); } catch (e) {}
}
function getStoredUser() {
    try { return JSON.parse(localStorage.getItem('ems_user')); } catch (e) { return null; }
}
function clearStoredUser() {
    try { localStorage.removeItem('ems_user'); } catch (e) {}
}

// ============================================
// DASHBOARD
// ============================================
function initDashboard() {
    createAllGauges();
    createAllLineCharts();
    fetchData();
    state.updateTimer = setInterval(fetchData, CONFIG.UPDATE_INTERVAL);
}

function createAllGauges() {
    createGauge('gaugeVoltage', 'voltage', 300, 0, '#00d4ff');
    createGauge('gaugeCurrent', 'current', 100, 0, '#00ff88');
    createGauge('gaugePower', 'power', 5000, 0, '#ffaa00');
    createGauge('gaugeEnergy', 'energy', 1000, 0, '#ff6b6b');
    createGauge('gaugePF', 'pf', 1, 0, '#a855f7');
    createGauge('gaugeFrequency', 'frequency', 65, 45, '#22d3ee');
}

function createGauge(canvasId, type, maxValue, minValue, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    state.gauges[type] = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Value', 'Remaining'],
            datasets: [{
                data: [0, maxValue - minValue],
                backgroundColor: [color, 'rgba(100, 150, 255, 0.08)'],
                borderColor: ['transparent', 'transparent'],
                borderWidth: 0,
                circumference: 270,
                rotation: 225,
                borderRadius: 4,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });
}

function updateGauge(type, value) {
    const gauge = state.gauges[type];
    if (!gauge) return;
    const maxVal = CONFIG.MAX_VALUES[type];
    const minVal = CONFIG.MIN_VALUES[type];
    const normalized = Math.max(minVal, Math.min(value, maxVal));
    gauge.data.datasets[0].data = [normalized - minVal, maxVal - normalized];
    gauge.update('none');
}

function createAllLineCharts() {
    createLineChart('chartVoltage', 'แรงดันไฟฟ้า (V)', '#00d4ff');
    createLineChart('chartCurrent', 'กระแสไฟฟ้า (A)', '#00ff88');
    createLineChart('chartPower', 'กำลังไฟฟ้า (W)', '#ffaa00');
}

function createLineChart(canvasId, label, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '00');
    state.lineCharts[canvasId] = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 1,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.9)',
                    titleColor: '#a0b0d0',
                    bodyColor: '#fff',
                    borderColor: 'rgba(100, 150, 255, 0.2)',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(100, 150, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#6b7a9c', font: { size: 10 }, maxTicksLimit: 6 }
                },
                y: {
                    grid: { color: 'rgba(100, 150, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#6b7a9c', font: { size: 10 } }
                }
            },
            animation: { duration: 600, easing: 'easeOutQuart' }
        }
    });
}

function updateLineCharts(data) {
    if (!data || data.length === 0) return;
    const recent = data.slice(-CONFIG.MAX_HISTORY_POINTS);
    const labels = recent.map(item => {
        const d = new Date(item.timestamp);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    });
    updateSingleChart('chartVoltage', labels, recent.map(i => parseFloat(i.voltage)||0));
    updateSingleChart('chartCurrent', labels, recent.map(i => parseFloat(i.current)||0));
    updateSingleChart('chartPower', labels, recent.map(i => parseFloat(i.power)||0));
}

function updateSingleChart(id, labels, data) {
    const chart = state.lineCharts[id];
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('none');
}

// ============================================
// DATA FETCHING
// ============================================
async function fetchData() {
    try {
        const response = await fetch(`${CONFIG.GAS_URL}?action=getLatest&limit=${CONFIG.MAX_HISTORY_POINTS}`, {
            method: 'GET', mode: 'cors', cache: 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            handleFetchSuccess(result.data);
            setConnectionStatus(true);
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        setConnectionStatus(false);
        if (!state.lastFetchTime) loadDemoData();
    }
}

function handleFetchSuccess(data) {
    state.lastFetchTime = new Date();
    state.historyData = data;
    document.getElementById('lastUpdate').textContent = state.lastFetchTime.toLocaleTimeString('th-TH');
    if (data.length > 0) {
        const latest = data[data.length - 1];
        updateDashboardValues(latest);
        updateLineCharts(data);
        checkAlarms(latest);
    }
    if (state.currentPage === 'history') renderHistoryTable(data);
}

function updateDashboardValues(data) {
    const v = parseFloat(data.voltage) || 0;
    const a = parseFloat(data.current) || 0;
    const p = parseFloat(data.power) || 0;
    const e = parseFloat(data.energy) || 0;
    const pf = parseFloat(data.powerFactor) || 0;
    const f = parseFloat(data.frequency) || 0;

    document.getElementById('valVoltage').textContent = v.toFixed(1);
    document.getElementById('valCurrent').textContent = a.toFixed(1);
    document.getElementById('valPower').textContent = Math.round(p).toLocaleString();
    document.getElementById('valEnergy').textContent = e.toFixed(2);
    document.getElementById('valPF').textContent = pf.toFixed(2);
    document.getElementById('valFrequency').textContent = f.toFixed(1);

    updateGauge('voltage', v);
    updateGauge('current', a);
    updateGauge('power', p);
    updateGauge('energy', e);
    updateGauge('pf', pf);
    updateGauge('frequency', f);

    const gv = state.gauges.voltage;
    const gc = state.gauges.current;
    if (gv) gv.data.datasets[0].backgroundColor[0] = (v > 240 || v < 200) ? '#ff4757' : '#00d4ff';
    if (gc) gc.data.datasets[0].backgroundColor[0] = (a > 30) ? '#ff4757' : '#00ff88';
    Object.values(state.gauges).forEach(g => g.update('none'));
}

// ============================================
// ALARM
// ============================================
function checkAlarms(data) {
    const v = parseFloat(data.voltage) || 0;
    const a = parseFloat(data.current) || 0;
    const messages = [];
    if (v > 240) messages.push(`แรงดันสูง: ${v.toFixed(1)}V`);
    else if (v < 200) messages.push(`แรงดันต่ำ: ${v.toFixed(1)}V`);
    if (a > 30) messages.push(`กระแสสูง: ${a.toFixed(1)}A (High Current)`);
    document.getElementById('cardVoltage').classList.toggle('alarm', v > 240 || v < 200);
    document.getElementById('cardCurrent').classList.toggle('alarm', a > 30);
    if (messages.length > 0) showAlarm(messages.join(' | '));
    else hideAlarm();
}

function showAlarm(msg) {
    document.getElementById('alarmText').textContent = msg;
    document.getElementById('alarmBanner').classList.remove('hidden');
}
function hideAlarm() {
    document.getElementById('alarmBanner').classList.add('hidden');
}

// ============================================
// FORM SUBMISSION
// ============================================
async function handleFormSubmit(e) {
    e.preventDefault();
    clearFormErrors();
    const data = {
        device: document.getElementById('inputDevice').value.trim(),
        voltage: parseFloat(document.getElementById('inputVoltage').value),
        current: parseFloat(document.getElementById('inputCurrent').value),
        power: parseFloat(document.getElementById('inputPower').value),
        energy: parseFloat(document.getElementById('inputEnergy').value),
        powerFactor: parseFloat(document.getElementById('inputPF').value),
        frequency: parseFloat(document.getElementById('inputFrequency').value)
    };
    const errors = validateFormData(data);
    if (errors.length > 0) {
        showFormErrors(errors);
        showFormResult('กรุณาตรวจสอบข้อมูล', 'error');
        return;
    }
    const btn = document.getElementById('btnSave');
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> กำลังบันทึก...';
    try {
        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showFormResult('บันทึกสำเร็จ', 'success');
            document.getElementById('manualForm').reset();
            setTimeout(fetchData, 500);
        } else {
            showFormResult(result.message || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch (error) {
        showFormResult('เชื่อมต่อไม่ได้ กรุณาลองใหม่', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-save"></i> บันทึกข้อมูล';
    }
}

// ============================================
// HISTORY PAGE
// ============================================
function loadHistoryPage() {
    if (state.historyData.length > 0) renderHistoryTable(state.historyData);
    else fetchData();
}

function renderHistoryTable(data) {
    const tbody = document.getElementById('historyBody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9">ไม่พบข้อมูล</td></tr>';
        return;
    }
    let filtered = [...data].reverse();
    const dateFilter = document.getElementById('filterDate').value;
    const deviceFilter = document.getElementById('filterDevice').value;
    if (dateFilter) {
        filtered = filtered.filter(item => new Date(item.timestamp).toISOString().split('T')[0] === dateFilter);
    }
    if (deviceFilter) {
        filtered = filtered.filter(item => item.device === deviceFilter);
    }
    const totalPages = Math.ceil(filtered.length / CONFIG.HISTORY_PAGE_SIZE) || 1;
    state.historyPage = Math.min(state.historyPage, totalPages);
    const start = (state.historyPage - 1) * CONFIG.HISTORY_PAGE_SIZE;
    const pageData = filtered.slice(start, start + CONFIG.HISTORY_PAGE_SIZE);

    tbody.innerHTML = pageData.map(item => {
        const status = getStatusBadge(item);
        const d = new Date(item.timestamp);
        const timeStr = d.toLocaleString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
        return `<tr>
            <td>${timeStr}</td>
            <td>${escapeHtml(item.device||'-')}</td>
            <td>${parseFloat(item.voltage||0).toFixed(1)}</td>
            <td>${parseFloat(item.current||0).toFixed(1)}</td>
            <td>${Math.round(parseFloat(item.power||0)).toLocaleString()}</td>
            <td>${parseFloat(item.energy||0).toFixed(2)}</td>
            <td>${parseFloat(item.powerFactor||0).toFixed(2)}</td>
            <td>${parseFloat(item.frequency||0).toFixed(1)}</td>
            <td>${status}</td>
        </tr>`;
    }).join('');

    document.getElementById('pageInfo').textContent = `หน้า ${state.historyPage} / ${totalPages}`;
    document.getElementById('prevPage').disabled = state.historyPage <= 1;
    document.getElementById('nextPage').disabled = state.historyPage >= totalPages;
    updateDeviceFilter(data);
}

function changeHistoryPage(delta) {
    state.historyPage += delta;
    if (state.historyPage < 1) state.historyPage = 1;
    renderHistoryTable(state.historyData);
}
function applyHistoryFilter() {
    state.historyPage = 1;
    renderHistoryTable(state.historyData);
}
function updateDeviceFilter(data) {
    const select = document.getElementById('filterDevice');
    const devices = [...new Set(data.map(d => d.device).filter(Boolean))];
    const currentVal = select.value;
    select.innerHTML = '<option value="">ทุกอุปกรณ์</option>' + 
        devices.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    select.value = currentVal;
}

// ============================================
// ADMIN: USER MANAGEMENT
// ============================================
function showAddUserPanel() {
    document.getElementById('addUserPanel').classList.remove('hidden');
}
function hideAddUserPanel() {
    document.getElementById('addUserPanel').classList.add('hidden');
    document.getElementById('addUserForm').reset();
    document.querySelectorAll('#addUserForm .error-msg').forEach(e => e.textContent = '');
    document.querySelectorAll('#addUserForm input').forEach(i => i.classList.remove('error'));
}

async function handleAddUser(e) {
    e.preventDefault();
    const data = {
        action: 'addUser',
        username: document.getElementById('newUsername').value.trim(),
        password: document.getElementById('newPassword').value,
        fullName: document.getElementById('newFullName').value.trim(),
        email: document.getElementById('newEmail').value.trim(),
        role: document.getElementById('newRole').value
    };
    if (!data.username || !data.password || !data.fullName) {
        showAddUserResult('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
        return;
    }
    try {
        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.status === 'success') {
            showAddUserResult('เพิ่มผู้ใช้สำเร็จ', 'success');
            document.getElementById('addUserForm').reset();
            loadUsersList();
            setTimeout(hideAddUserPanel, 1500);
        } else {
            showAddUserResult(result.message || 'ไม่สามารถเพิ่มผู้ใช้ได้', 'error');
        }
    } catch (error) {
        showAddUserResult('เชื่อมต่อไม่ได้', 'error');
    }
}

async function loadUsersList() {
    try {
        const response = await fetch(`${CONFIG.GAS_URL}?action=getUsers`, { method: 'GET', mode: 'cors' });
        const result = await response.json();
        const tbody = document.getElementById('usersBody');
        if (result.status === 'success' && result.users) {
            tbody.innerHTML = result.users.map(u => `
                <tr>
                    <td>${escapeHtml(u.username)}</td>
                    <td>${escapeHtml(u.fullName)}</td>
                    <td>${escapeHtml(u.email||'-')}</td>
                    <td><span class="role-badge role-${u.role}">${u.role === 'admin' ? 'Admin' : 'User'}</span></td>
                    <td>${u.status === 'active' ? '<span class="status-badge status-normal">ใช้งาน</span>' : '<span class="status-badge status-danger">ปิดใช้งาน</span>'}</td>
                    <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : '-'}</td>
                    <td>
                        <button class="btn-icon danger" onclick="deleteUser('${escapeHtml(u.username)}')" title="ลบ">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">ไม่พบข้อมูลผู้ใช้</td></tr>';
        }
    } catch (error) {
        document.getElementById('usersBody').innerHTML = '<tr class="empty-row"><td colspan="7">โหลดไม่สำเร็จ</td></tr>';
    }
}

async function deleteUser(username) {
    if (!confirm(`ต้องการลบผู้ใช้ "${username}" ใช่หรือไม่?`)) return;
    try {
        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteUser', username })
        });
        const result = await response.json();
        if (result.status === 'success') loadUsersList();
        else alert(result.message || 'ลบไม่สำเร็จ');
    } catch (error) {
        alert('เชื่อมต่อไม่ได้');
    }
}

function showAddUserResult(msg, type) {
    const el = document.getElementById('addUserResult');
    el.className = `form-result ${type}`;
    el.innerHTML = `<div class="result-content"><i class="bi bi-${type==='success'?'check':'x'}-circle-fill"></i><span>${msg}</span></div>`;
    el.classList.remove('hidden');
}

// ============================================
// ADMIN: SETTINGS
// ============================================
function loadSettings() {
    document.getElementById('setVoltMax').value = CONFIG.ALARM_THRESHOLDS.voltage.max;
    document.getElementById('setVoltMin').value = CONFIG.ALARM_THRESHOLDS.voltage.min;
    document.getElementById('setCurrMax').value = CONFIG.ALARM_THRESHOLDS.current.max;
    document.getElementById('setFreqMax').value = CONFIG.ALARM_THRESHOLDS.frequency.max;
    document.getElementById('setFreqMin').value = CONFIG.ALARM_THRESHOLDS.frequency.min;
    document.getElementById('setInterval').value = CONFIG.UPDATE_INTERVAL / 1000;
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const settings = {
        action: 'saveSettings',
        voltageMax: parseFloat(document.getElementById('setVoltMax').value),
        voltageMin: parseFloat(document.getElementById('setVoltMin').value),
        currentMax: parseFloat(document.getElementById('setCurrMax').value),
        frequencyMax: parseFloat(document.getElementById('setFreqMax').value),
        frequencyMin: parseFloat(document.getElementById('setFreqMin').value),
        updateInterval: parseInt(document.getElementById('setInterval').value) * 1000
    };
    CONFIG.ALARM_THRESHOLDS.voltage.max = settings.voltageMax;
    CONFIG.ALARM_THRESHOLDS.voltage.min = settings.voltageMin;
    CONFIG.ALARM_THRESHOLDS.current.max = settings.currentMax;
    CONFIG.ALARM_THRESHOLDS.frequency.max = settings.frequencyMax;
    CONFIG.ALARM_THRESHOLDS.frequency.min = settings.frequencyMin;
    CONFIG.UPDATE_INTERVAL = settings.updateInterval;
    if (state.updateTimer) {
        clearInterval(state.updateTimer);
        state.updateTimer = setInterval(fetchData, CONFIG.UPDATE_INTERVAL);
    }
    try {
        await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        showSettingsResult('บันทึกการตั้งค่าสำเร็จ', 'success');
    } catch (error) {
        showSettingsResult('บันทึกในเครื่องสำเร็จ', 'success');
    }
}

function showSettingsResult(msg, type) {
    const el = document.getElementById('settingsResult');
    el.className = `form-result ${type}`;
    el.innerHTML = `<div class="result-content"><i class="bi bi-check-circle-fill"></i><span>${msg}</span></div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
}

// ============================================
// VALIDATION
// ============================================
function validateFormData(data) {
    const errors = [];
    if (!data.device) errors.push({ field: 'Device', message: 'กรุณาระบุชื่ออุปกรณ์' });
    if (isNaN(data.voltage) || data.voltage < 0 || data.voltage > 300) errors.push({ field: 'Voltage', message: 'แรงดัน 0-300V' });
    if (isNaN(data.current) || data.current < 0 || data.current > 100) errors.push({ field: 'Current', message: 'กระแส 0-100A' });
    if (isNaN(data.power) || data.power < 0) errors.push({ field: 'Power', message: 'กำลัง >= 0' });
    if (isNaN(data.energy) || data.energy < 0) errors.push({ field: 'Energy', message: 'พลังงาน >= 0' });
    if (isNaN(data.powerFactor) || data.powerFactor < 0 || data.powerFactor > 1) errors.push({ field: 'PF', message: 'PF 0-1' });
    if (isNaN(data.frequency) || data.frequency < 45 || data.frequency > 65) errors.push({ field: 'Frequency', message: 'ความถี่ 45-65Hz' });
    return errors;
}

function showFormErrors(errors) {
    errors.forEach(err => {
        const input = document.getElementById('input' + err.field);
        const errorEl = document.getElementById('error' + err.field);
        if (input) input.classList.add('error');
        if (errorEl) errorEl.textContent = err.message;
    });
}

function clearFormErrors() {
    document.querySelectorAll('#manualForm input').forEach(i => i.classList.remove('error'));
    document.querySelectorAll('#manualForm .error-msg').forEach(e => e.textContent = '');
    hideFormResult();
}

function showFormResult(msg, type) {
    const el = document.getElementById('formResult');
    el.className = `form-result ${type}`;
    el.innerHTML = `<div class="result-content"><i class="bi bi-${type==='success'?'check':'x'}-circle-fill"></i><span>${msg}</span></div>`;
    el.classList.remove('hidden');
    setTimeout(hideFormResult, 5000);
}
function hideFormResult() {
    document.getElementById('formResult').classList.add('hidden');
}

function showLoginError(field, msg) {
    const input = document.getElementById(field);
    const errId = 'error' + field.charAt(0).toUpperCase() + field.slice(1);
    const err = document.getElementById(errId);
    if (input) input.classList.add('error');
    if (err) err.textContent = msg;
}
function clearLoginErrors() {
    document.querySelectorAll('#loginForm input').forEach(i => i.classList.remove('error'));
    document.querySelectorAll('#loginForm .error-msg').forEach(e => e.textContent = '');
    document.getElementById('loginResult').classList.add('hidden');
}
function showLoginResult(msg, type) {
    const el = document.getElementById('loginResult');
    el.className = `form-result ${type}`;
    el.innerHTML = `<div class="result-content"><i class="bi bi-${type==='success'?'check':'x'}-circle-fill"></i><span>${msg}</span></div>`;
    el.classList.remove('hidden');
}

// ============================================
// UI UTILITIES
// ============================================
function togglePasswordVisibility() {
    const input = document.getElementById('loginPassword');
    const icon = document.getElementById('togglePassword').querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    if (window.innerWidth <= 1024) sidebar.classList.toggle('open');
}
function updateClock() {
    document.getElementById('currentTime').textContent = 
        new Date().toLocaleTimeString('th-TH', { hour12: false });
}
function setConnectionStatus(online) {
    state.isOnline = online;
    const dot = document.getElementById('connDot');
    const text = document.getElementById('connectionStatus');
    if (online) {
        dot.className = 'status-dot online';
        text.textContent = 'ออนไลน์';
        text.style.color = 'var(--color-accent)';
    } else {
        dot.className = 'status-dot offline';
        text.textContent = 'ออฟไลน์';
        text.style.color = 'var(--color-danger)';
    }
}
function getStatusBadge(item) {
    const v = parseFloat(item.voltage) || 0;
    const a = parseFloat(item.current) || 0;
    if (v > 240 || v < 200 || a > 30) {
        return '<span class="status-badge status-danger"><i class="bi bi-exclamation-triangle"></i> ผิดปกติ</span>';
    } else if (v > 235 || v < 205 || a > 25) {
        return '<span class="status-badge status-warning"><i class="bi bi-exclamation-circle"></i> เฝ้าระวัง</span>';
    }
    return '<span class="status-badge status-normal"><i class="bi bi-check-circle"></i> ปกติ</span>';
}
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// DEMO DATA
// ============================================
function loadDemoData() {
    const demoData = [];
    const now = new Date();
    for (let i = 19; i >= 0; i--) {
        const t = new Date(now.getTime() - i * 300000);
        demoData.push({
            timestamp: t.toISOString(),
            device: 'Demo-Meter-01',
            voltage: 220 + Math.random() * 10 - 5,
            current: 15 + Math.random() * 5 - 2.5,
            power: 3300 + Math.random() * 500 - 250,
            energy: 1250.5 + i * 0.1,
            powerFactor: 0.85 + Math.random() * 0.1,
            frequency: 50 + Math.random() * 0.5 - 0.25
        });
    }
    handleFetchSuccess(demoData);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, validateFormData, escapeHtml };
}
