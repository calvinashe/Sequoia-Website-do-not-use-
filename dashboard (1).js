const API_BASE = localStorage.getItem('SEQUOIA_API_BASE');

// Helper: days until due
function daysUntil(dateStr) {
    if (!dateStr) return 999;
    const now = new Date();
    const due = new Date(dateStr);
    return Math.max(0, Math.ceil((due - now) / (1000 * 60 * 60 * 24)));
}

// Helper: urgency label
function getUrgency(days) {
    if (days <= 2) return { label: days + ' day' + (days !== 1 ? 's' : ''), cls: 'urg-high' };
    if (days <= 5) return { label: days + ' days', cls: 'urg-med' };
    return { label: days + ' days', cls: 'urg-low' };
}

// Helper: weight class for ring color
function getWeightClass(pct) {
    if (pct >= 20) return 'weight-high';
    if (pct >= 10) return 'weight-med';
    return 'weight-low';
}

// Helper: bar color
function getBarColor(pct) {
    if (pct >= 20) return '#C75B3A';
    if (pct >= 10) return '#D4882B';
    return '#4A7C2E';
}

// Helper: format date
function formatDate(dateStr) {
    if (!dateStr) return 'No date';
    const d = new Date(dateStr);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
}

// SVG weight ring
function weightRing(pct) {
    const circumference = 2 * Math.PI * 19; // r=19
    const offset = circumference - (pct / 100) * circumference;
    const cls = getWeightClass(pct);
    return `
        <div class="weight-ring ${cls}">
            <svg viewBox="0 0 48 48">
                <circle class="ring-bg" cx="24" cy="24" r="19"/>
                <circle class="ring-fill" cx="24" cy="24" r="19"
                    stroke-dasharray="${circumference.toFixed(1)}"
                    stroke-dashoffset="${offset.toFixed(1)}"/>
            </svg>
            <span class="ring-pct">${pct}%</span>
        </div>
    `;
}

async function init() {
    if (!API_BASE) {
        window.location.href = './index.html';
        return;
    }

    try {
        // 1. Load Profile
        const profile = await fetch(`${API_BASE}/profile`).then(r => r.json());
        document.getElementById('user-greeting').innerText = `War Eagle, ${profile.name}!`;

        // 2. Load Courses
        const courses = await fetch(`${API_BASE}/my-courses`).then(r => r.json());
        const courseGrid = document.getElementById('course-grid');
        courseGrid.innerHTML = courses.map(c => `
            <div class="course-card">
                <h3>${c.course_name}</h3>
                <p class="course-id">ID: ${c.id}</p>
                <div class="accent-bar"></div>
            </div>
        `).join('');

        // 3. Load Assignments with weight sorting
        const fullData = await fetch(`${API_BASE}/full-data`).then(r => r.json());
        const assignList = document.getElementById('assignment-list');

        let allAssignments = [];
        fullData.forEach(course => {
            // Calculate total points for course to determine weight percentages
            const totalPoints = course.assignments.reduce((sum, a) => sum + (a.points_possible || 0), 0);

            course.assignments.forEach(a => {
                const points = a.points_possible || 0;
                const weightPct = totalPoints > 0 ? Math.round((points / totalPoints) * 100) : 0;
                const days = daysUntil(a.due_at);
                // Priority score: higher weight + sooner due = higher priority
                const urgencyMultiplier = days <= 0 ? 10 : (1 / days);
                const priorityScore = weightPct * urgencyMultiplier;

                allAssignments.push({
                    ...a,
                    course: course.course_name,
                    weightPct: weightPct,
                    days: days,
                    priorityScore: priorityScore
                });
            });
        });

        // Sort by priority: highest impact first
        allAssignments.sort((a, b) => b.priorityScore - a.priorityScore);

        // Filter to only future/current assignments
        const upcoming = allAssignments.filter(a => a.days >= 0 || !a.due_at);

        if (upcoming.length === 0) {
            assignList.innerHTML = '<p class="loading">No upcoming assignments.</p>';
            return;
        }

        assignList.innerHTML = upcoming.slice(0, 15).map((a, i) => {
            const urg = getUrgency(a.days);
            const barWidth = Math.min(a.weightPct * 3.3, 100);
            const barColor = getBarColor(a.weightPct);

            return `
                <div class="assignment-card" style="animation: slideIn 0.5s ease ${(i * 0.08).toFixed(2)}s both">
                    ${weightRing(a.weightPct)}
                    <div class="assign-info">
                        <div class="assign-name">${a.title}</div>
                        <div class="assign-course">${a.course}</div>
                        <div class="weight-bar">
                            <div class="weight-bar-fill" style="width:${barWidth}%;background:${barColor}"></div>
                        </div>
                    </div>
                    <div class="assign-due">
                        <strong>${formatDate(a.due_at)}</strong>
                        <div class="pts">${a.points_possible || 0} pts</div>
                        ${a.due_at ? `<span class="urgency ${urg.cls}">${urg.label}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error('Dashboard error:', e);
        document.getElementById('assignment-list').innerHTML =
            '<p class="loading">Error loading data. Check your connection.</p>';
    }
}

init();
