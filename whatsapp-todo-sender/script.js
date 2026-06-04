// ===== Configuration =====
const CONFIG = {
    spreadsheetId: '1U8tYCOuflB6N8wFrJ9TdoqfJlXatKaOtPeVYrM2GJlg',
    gid: '277241861',
    whatsappNumber: '8801823575014',
    sendHour: 17, // 5 PM
    sendMinute: 0,
};

// ===== State =====
let currentTasks = [];
let currentMessage = '';

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    startClock();
    startCountdown();
    fetchTasks();
});

// ===== Background Particles =====
function createParticles() {
    const container = document.getElementById('bgParticles');
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

// ===== Live Clock =====
function startClock() {
    const update = () => {
        const now = new Date();
        document.getElementById('clockTime').textContent = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        document.getElementById('clockDate').textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    };
    update();
    setInterval(update, 1000);
}

// ===== Countdown to 5 PM =====
function startCountdown() {
    const update = () => {
        const now = new Date();
        let target = new Date(now);
        target.setHours(CONFIG.sendHour, CONFIG.sendMinute, 0, 0);
        if (now >= target) {
            target.setDate(target.getDate() + 1);
        }
        const diff = target - now;
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        document.getElementById('countdownText').textContent =
            `Next send in ${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    };
    update();
    setInterval(update, 1000);
}

// ===== Fetch Tasks from Google Sheet =====
async function fetchTasks() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const tasksList = document.getElementById('tasksList');
    const messagePreview = document.getElementById('messagePreview');
    const sendSection = document.getElementById('sendSection');

    // Show loading
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tasksList.classList.add('hidden');
    messagePreview.classList.add('hidden');
    sendSection.classList.add('hidden');
    setStatus('loading', 'Fetching from Mbr_Hridoy sheet...');

    try {
        // Use Google Visualization API (supports CORS for published/shared sheets)
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?tqx=out:csv&gid=${CONFIG.gid}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const csvText = await response.text();
        const rows = parseCSV(csvText);
        const todayTasks = extractTodayTasks(rows);

        currentTasks = todayTasks;
        loadingState.classList.add('hidden');

        if (todayTasks.length === 0) {
            emptyState.classList.remove('hidden');
            setStatus('success', 'Sheet loaded — no tasks for today');
            showToast('📋', 'No tasks found for today');
        } else {
            renderTasks(todayTasks);
            buildMessage(todayTasks);
            tasksList.classList.remove('hidden');
            messagePreview.classList.remove('hidden');
            sendSection.classList.remove('hidden');
            setStatus('success', `Loaded ${todayTasks.length} task(s) for today`);
            showToast('✅', `Found ${todayTasks.length} task(s) for today`);
        }
    } catch (err) {
        console.error('Fetch error:', err);
        loadingState.classList.add('hidden');
        emptyState.classList.remove('hidden');
        document.querySelector('#emptyState h3').textContent = 'Failed to Load';
        document.querySelector('#emptyState p').textContent = `Error: ${err.message}. Make sure the sheet is shared publicly.`;
        setStatus('error', 'Failed to fetch sheet data');
        showToast('❌', 'Error loading sheet');
    }
}

// ===== CSV Parser =====
function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    const lines = [];

    // Split into lines respecting quoted newlines
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

    // Parse each line into fields
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

// ===== Extract Today's Tasks =====
function extractTodayTasks(rows) {
    const now = new Date();
    const day = now.getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = monthNames[now.getMonth()];
    const todayStr = `${day} ${month}`;

    const tasks = [];
    let isToday = false;

    // CSV columns (0-indexed from header):
    // 0: f (date marker), 1: Provided Date, 2: Project, 3: Task Details,
    // 4: Task Header, 5: Task Type, 6: Qty, 7: Time (Actual),
    // 8: Task Qty, 9: Standard Time, 10: Point, 11: Revision Count,
    // 12: Progress Status, 13: Submission Date, 14: Mark, 15: Actual Date

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;

        const dateField = (row[0] || '').trim();

        // Check if this row starts a new date section
        if (dateField && /^\d+ \w+/.test(dateField)) {
            isToday = dateField === todayStr;
            continue;
        }

        // If we're past today's section, stop
        if (!isToday) continue;

        // Check if row has actual task data
        const project = (row[2] || '').trim();
        const taskDetails = (row[3] || '').trim();
        const taskType = (row[5] || '').trim();

        if (!project && !taskDetails) continue;

        const status = (row[12] || '').trim();
        const time = (row[7] || '').trim();
        const qty = (row[6] || '').trim();

        tasks.push({
            project,
            details: taskDetails,
            header: (row[4] || '').trim(),
            type: taskType,
            qty,
            time,
            status: status || 'Pending',
            points: (row[10] || '').trim(),
        });
    }

    return tasks;
}

// ===== Render Task Cards =====
function renderTasks(tasks) {
    const container = document.getElementById('tasksList');
    container.innerHTML = tasks.map((t, i) => `
        <div class="task-card">
            <div class="task-header">
                <div class="task-number">${i + 1}</div>
                <div class="task-title">${escapeHtml(t.details || t.header || 'Untitled Task')}</div>
                <span class="task-status ${t.status.toLowerCase() === 'done' ? 'done' : t.status.toLowerCase() === 'pending' ? 'pending' : 'progress'}">
                    ${escapeHtml(t.status)}
                </span>
            </div>
            <div class="task-meta">
                ${t.project ? `<span class="meta-tag project">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
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
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Qty: ${escapeHtml(t.qty)}
                </span>` : ''}
            </div>
        </div>
    `).join('');
}

// ===== Build WhatsApp Message =====
function buildMessage(tasks) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    let msg = `📋 *Daily To-Do List*\n`;
    msg += `📅 ${dateStr}\n`;
    msg += `━━━━━━━━━━━━━━━━━\n\n`;

    tasks.forEach((t, i) => {
        const statusIcon = t.status.toLowerCase() === 'done' ? '✅' : '⏳';
        msg += `${i + 1}. ${statusIcon} *${t.details || t.header || 'Task'}*\n`;
        if (t.project) msg += `   📂 ${t.project}\n`;
        if (t.type) msg += `   🏷️ ${t.type}\n`;
        if (t.time) msg += `   ⏱️ ${t.time}\n`;
        if (t.qty && t.qty !== '1') msg += `   📦 Qty: ${t.qty}\n`;
        msg += `   📊 Status: ${t.status}\n`;
        msg += `\n`;
    });

    const done = tasks.filter(t => t.status.toLowerCase() === 'done').length;
    const total = tasks.length;
    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *Summary:* ${done}/${total} completed\n`;
    msg += `🤖 _Sent via Daily Task Sender_`;

    currentMessage = msg;

    document.getElementById('messageContent').textContent = msg;
    document.getElementById('charCount').textContent = `${msg.length} chars`;
    document.getElementById('messageTime').textContent = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });
}

// ===== Send to WhatsApp =====
function sendToWhatsApp() {
    if (!currentMessage) {
        showToast('⚠️', 'No message to send');
        return;
    }
    const encoded = encodeURIComponent(currentMessage);
    const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encoded}`;
    window.open(url, '_blank');
    showToast('📤', 'Opening WhatsApp...');
}

// ===== Status Indicator =====
function setStatus(type, text) {
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusText');
    dot.className = 'status-dot ' + type;
    label.textContent = text;
}

// ===== Toast =====
function showToast(icon, text) {
    const toast = document.getElementById('toast');
    document.getElementById('toastIcon').textContent = icon;
    document.getElementById('toastText').textContent = text;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 400);
    }, 3000);
}

// ===== Escape HTML =====
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== Auto-check for 5 PM trigger =====
setInterval(() => {
    const now = new Date();
    if (now.getHours() === CONFIG.sendHour && now.getMinutes() === CONFIG.sendMinute && now.getSeconds() === 0) {
        fetchTasks().then(() => {
            setTimeout(() => {
                if (currentTasks.length > 0) {
                    showToast('🔔', "It's 5 PM! Time to send your tasks!");
                    // Auto-highlight the send button
                    const btn = document.getElementById('sendBtn');
                    btn.style.animation = 'logoPulse 0.5s ease-in-out 5';
                }
            }, 2000);
        });
    }
}, 1000);
