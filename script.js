// ===== Configuration =====
const CONFIG = {
    spreadsheetId: '1U8tYCOuflB6N8wFrJ9TdoqfJlXatKaOtPeVYrM2GJlg',
    members: [
        { name: 'Mbr_Niloy', role: 'UI/UX Designer' },
        { name: 'Mbr_Tahsin', role: 'Motion Designer' },
        { name: 'Mbr_Rijve', role: 'Graphic Designer' },
        { name: 'Mbr_Mamun', role: 'Content Designer' },
        { name: 'Mbr_Hridoy', role: 'Creative Lead' },
        { name: 'Mbr_Adi', role: 'Brand Specialist' },
        { name: 'Mbr_Tousif', role: 'Video Editor' },
        { name: 'Mbr_Maidul', role: 'Junior Designer' }
    ]
};

// ===== State Variables =====
let currentDate = new Date();
let currentMemberIndex = 4; // Defaults to Mbr_Hridoy
let currentView = 'tasks'; // 'tasks' or 'dashboard'
let sheetCache = {}; // Cache sheet data to minimize network requests
let currentTasks = [];
let currentMessage = '';

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initDate();
    initMembersDropdown();
    switchView('tasks'); // Default view
});

// ===== Background Effects =====
function createParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;
    const colors = ['rgba(37,211,102,0.15)', 'rgba(59,130,246,0.1)', 'rgba(139,92,246,0.08)'];
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        const size = Math.random() * 4 + 2;
        p.style.cssText = `
            width: ${size}px; height: ${size}px;
            left: ${Math.random() * 100}%;
            background: ${colors[i % colors.length]};
            animation-duration: ${Math.random() * 15 + 15}s;
            animation-delay: ${Math.random() * 10}s;
        `;
        container.appendChild(p);
    }
}

// ===== Date Handling Functions =====
function initDate() {
    const picker = document.getElementById('datePicker');
    picker.value = formatDateToYYYYMMDD(currentDate);
    updateFormattedDateDisplay();
}

function formatDateToYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateFormattedDateDisplay() {
    const label = document.getElementById('formattedDate');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    label.textContent = currentDate.toLocaleDateString('en-US', options);
}

function onDateChange(val) {
    if (!val) return;
    const parts = val.split('-');
    currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
    updateFormattedDateDisplay();
    refreshViewData();
}

function shiftDate(offset) {
    currentDate.setDate(currentDate.getDate() + offset);
    document.getElementById('datePicker').value = formatDateToYYYYMMDD(currentDate);
    updateFormattedDateDisplay();
    refreshViewData();
}

// ===== Member Selection Functions =====
function initMembersDropdown() {
    const select = document.getElementById('memberSelect');
    select.innerHTML = CONFIG.members.map((m, idx) => `
        <option value="${idx}">${m.name.replace('Mbr_', '')}</option>
    `).join('');
    select.value = currentMemberIndex;
}

function onMemberChange(val) {
    currentMemberIndex = parseInt(val, 10);
    refreshViewData();
}

function shiftMember(offset) {
    let newIndex = currentMemberIndex + offset;
    if (newIndex < 0) newIndex = CONFIG.members.length - 1;
    if (newIndex >= CONFIG.members.length) newIndex = 0;
    
    currentMemberIndex = newIndex;
    document.getElementById('memberSelect').value = currentMemberIndex;
    refreshViewData();
}

// ===== View Switcher (Tabs) =====
function switchView(viewName) {
    currentView = viewName;
    
    // Toggle active tab buttons
    document.getElementById('tabTasks').classList.toggle('active', viewName === 'tasks');
    document.getElementById('tabDashboard').classList.toggle('active', viewName === 'dashboard');
    
    // Toggle active view panel visibility
    document.getElementById('tasksView').classList.toggle('hidden', viewName !== 'tasks');
    document.getElementById('dashboardView').classList.toggle('hidden', viewName !== 'dashboard');
    
    // Toggle member selector visibility (not needed in Dashboard)
    document.getElementById('memberControlsContainer').classList.toggle('hidden', viewName !== 'tasks');
    
    refreshViewData();
}

// ===== Refresh Data Controller =====
function onRefresh() {
    // Clear cache for current view elements to force reload
    if (currentView === 'tasks') {
        const activeMember = CONFIG.members[currentMemberIndex].name;
        delete sheetCache[activeMember];
    } else {
        // Clear all cached sheets for full dashboard reload
        sheetCache = {};
    }
    refreshViewData();
}

function refreshViewData() {
    if (currentView === 'tasks') {
        fetchIndividualTasks();
    } else {
        fetchDashboardData();
    }
}

// ===== Fetch Sheet Wrapper (with caching) =====
async function fetchSheetData(memberName) {
    if (sheetCache[memberName]) {
        return sheetCache[memberName];
    }
    
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${memberName}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load sheet for ${memberName}`);
    }
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    sheetCache[memberName] = rows;
    return rows;
}

// ===== CSV Parsing Engine =====
function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    const lines = [];

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            lines.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    if (current) lines.push(current);

    for (const line of lines) {
        const fields = [];
        let field = '';
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQ && line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQ = !inQ;
                }
            } else if (ch === ',' && !inQ) {
                fields.push(field.trim());
                field = '';
            } else {
                field += ch;
            }
        }
        fields.push(field.trim());
        rows.push(fields);
    }
    return rows;
}

// ===== Extract Tasks by Date =====
function extractTasksForDate(rows, targetDate) {
    const day = targetDate.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[targetDate.getMonth()];
    const targetStr = `${day} ${month}`;

    const tasks = [];
    let isTargetDate = false;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;

        const dateField = (row[0] || '').trim();

        if (dateField && /^\d+ \w+/.test(dateField)) {
            isTargetDate = dateField === targetStr;
            continue;
        }

        if (!isTargetDate) continue;

        const project = (row[2] || '').trim();
        const taskDetails = (row[3] || '').trim();
        const taskHeader = (row[4] || '').trim();
        const taskType = (row[5] || '').trim();

        if (!project && !taskDetails && !taskHeader && !taskType) continue;

        const status = (row[12] || '').trim();
        const time = (row[7] || '').trim();
        const qty = (row[6] || '').trim();

        tasks.push({
            project,
            details: taskDetails || taskHeader || 'Untitled Task',
            type: taskType,
            qty,
            time,
            status: status || 'Pending',
        });
    }

    return tasks;
}

// ===== View 1: Render Individual Tasks =====nasync function fetchIndividualTasks() {
    const activeMember = CONFIG.members[currentMemberIndex];
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tasksList = document.getElementById('tasksList');
    const messagePreview = document.getElementById('messagePreview');
    const sendSection = document.getElementById('sendSection');

    // Show loading UI
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tasksList.classList.add('hidden');
    messagePreview.classList.add('hidden');
    sendSection.classList.add('hidden');
    setStatus('loading', `Fetching tasks for ${activeMember.name.replace('Mbr_', '')}...`);

    try {
        const rows = await fetchSheetData(activeMember.name);
        const tasks = extractTasksForDate(rows, currentDate);
        currentTasks = tasks;
        loadingState.classList.add('hidden');

        if (tasks.length === 0) {
            emptyState.classList.remove('hidden');
            document.querySelector('#emptyState h3').textContent = 'No Tasks for Today';
            document.querySelector('#emptyState p').textContent = 'This member has no tasks assigned for the selected date.';
            setStatus('success', 'Sheet loaded — no tasks for today');
        } else {
            renderTasks(tasks);
            buildWhatsAppMessage(tasks, activeMember.name);
            tasksList.classList.remove('hidden');
            messagePreview.classList.remove('hidden');
            sendSection.classList.remove('hidden');
            
            // Populate WhatsApp recipient details
            document.getElementById('recipientAvatar').textContent = activeMember.name.replace('Mbr_', '')[0];
            document.getElementById('recipientName').textContent = activeMember.name.replace('Mbr_', '');
            
            setStatus('success', `Loaded ${tasks.length} tasks successfully`);
        }
    } catch (err) {
        console.error(err);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        document.querySelector('#emptyState h3').textContent = 'Failed to Load';
        document.querySelector('#emptyState p').textContent = `Could not fetch data for ${activeMember.name}.`;
        setStatus('error', 'Failed to fetch sheet data');
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('tasksList');
    container.innerHTML = tasks.map((t, i) => `
        <div class="task-card">
            <div class="task-header">
                <div class="task-number">${i + 1}</div>
                <div class="task-title">${escapeHtml(t.details)}</div>
                <span class="task-status ${getBadgeClass(t.status)}">
                    ${escapeHtml(t.status)}
                </span>
            </div>
            <div class="task-meta">
                ${t.project ? `<span class="meta-tag project">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/[...]`
                    ${escapeHtml(t.project)}
                </span>` : ''}
                ${t.type ? `<span class="meta-tag type">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
                    ${escapeHtml(t.type)}
                </span>` : ''}
                ${t.time ? `<span class="meta-tag time">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${escapeHtml(t.time)}
                </span>` : ''}
                ${t.qty && t.qty !== '1' ? `<span class="meta-tag qty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14[...]`
                    Qty: ${escapeHtml(t.qty)}
                </span>` : ''}
            </div>
        </div>
    `).join('');
}

function getBadgeClass(status) {
    const s = status.toLowerCase();
    if (s === 'done') return 'done';
    if (s === 'pending') return 'pending';
    return 'progress';
}

// ===== WhatsApp Message Template Builder =====
function buildWhatsAppMessage(tasks, memberName) {
    const formattedDateStr = currentDate.toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const displayName = memberName.replace('Mbr_', '');

    let msg = `📋 *Daily To-Do List | ${displayName}*\n`;
    msg += `📅 ${formattedDateStr}\n`;
    msg += `━━━━━━━━━━━━━━━━━\n\n`;

    tasks.forEach((t, i) => {
        const statusIcon = t.status.toLowerCase() === 'done' ? '✅' : '⏳';
        msg += `${i + 1}. ${statusIcon} *${t.details}*\n`;
        if (t.project) msg += `   📂 Project: ${t.project}\n`;
        if (t.type) msg += `   🏷️ Type: ${t.type}\n`;
        if (t.time) msg += `   ⏱️ Time: ${t.time}\n`;
        if (t.qty && t.qty !== '1') msg += `   📦 Qty: ${t.qty}\n`;
        msg += `\n`;
    });

    const doneCount = tasks.filter(t => t.status.toLowerCase() === 'done').length;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *Summary:* ${doneCount}/${tasks.length} completed\n`;
    msg += `🤖 _Sent via Daily Task Hub_`;

    currentMessage = msg;
    document.getElementById('messageContent').textContent = msg;
    document.getElementById('charCount').textContent = `${msg.length} chars`;
    document.getElementById('messageTime').textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

function sendToWhatsApp() {
    if (!currentMessage) return;
    const activeMember = CONFIG.members[currentMemberIndex];
    const encoded = encodeURIComponent(currentMessage);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
    showToast('📤', `Opening WhatsApp for ${activeMember.name.replace('Mbr_', '')}...`);
}

// ===== View 2: Team Dashboard Implementation =====nasync function fetchDashboardData() {
    const loadingPanel = document.getElementById('dashboardLoading');
    const progressList = document.getElementById('dashboardProgressList');
    const grid = document.getElementById('dashboardGrid');

    loadingPanel.classList.remove('hidden');
    grid.innerHTML = '';
    progressList.innerHTML = '';
    setStatus('loading', 'Loading team data...');

    // Pre-create loaders for visual feedback
    CONFIG.members.forEach(member => {
        const cleanName = member.name.replace('Mbr_', '');
        progressList.innerHTML += `
            <div class="fetch-progress-card" id="fetchCard_${member.name}">
                <span class="fetch-status-label">
                    <span class="fetch-spinner" id="spinner_${member.name}"></span>
                    ${cleanName}
                </span>
                <span class="fetch-progress-status" id="fetchVal_${member.name}" style="color: var(--text-muted)">Loading</span>
            </div>
        `;
    });

    try {
        // Fetch all sheets in parallel
        const promises = CONFIG.members.map(async (member) => {
            const valLabel = document.getElementById(`fetchVal_${member.name}`);
            const spinner = document.getElementById(`spinner_${member.name}`);
            try {
                const rows = await fetchSheetData(member.name);
                const tasks = extractTasksForDate(rows, currentDate);
                
                // Show completion status in load progress card
                if (valLabel) {
                    valLabel.textContent = 'Loaded';
                }