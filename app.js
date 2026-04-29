const API_BASE = '';
const PAGE_SIZE = 10;

const icons = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 12.5 12 4l9 8.5"></path><path d="M5.5 10.5V20h13V10.5"></path><path d="M10 20v-5h4v5"></path></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4v15.5"></path><path d="M20 4v15.5"></path><path d="M6.5 7H20"></path><path d="M6.5 12H20"></path></svg>',
  bar: '<svg viewBox="0 0 24 24"><path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20v-3"></path></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 9h3"></path></svg>',
  radar: '<svg viewBox="0 0 24 24"><path d="M12 3 4 7l8 4 8-4-8-4Z"></path><path d="m4 7 8 4 8-4"></path><path d="m4 12 8 4 8-4"></path><path d="m4 17 8 4 8-4"></path></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.67L21 9.58l-4.5 4.39L17.56 21 12 18.1 6.44 21l1.06-7.03L3 9.58l6.2-.91z"></path></svg>',
  database: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"></path><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"></path></svg>',
  log: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"></path><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9"></path></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>',
};

const pageMeta = {
  'student-home': { title: '学生门户', desc: '' },
  dashboard: { title: '信息总览', desc: '' },
  students: { title: '学籍档案', desc: '' },
  courses: { title: '课程资源', desc: '' },
  grades: { title: '成绩登记', desc: '' },
  transcript: { title: '学业档案', desc: '' },
  analysis: { title: '课程质量', desc: '' },
  gpa: { title: 'GPA 排名', desc: '' },
  database: { title: '数据字典', desc: '' },
  logs: { title: '操作审计', desc: '' },
};

const rolePages = {
  admin: ['dashboard', 'students', 'courses', 'grades', 'transcript', 'analysis', 'gpa', 'database', 'logs'],
  student: ['student-home'],
};

const state = {
  currentPage: 'dashboard',
  session: null,
  sessionOptions: { roles: [], students: [] },
  currentStudent: null,
  students: [],
  courses: [],
  grades: [],
  gpa: [],
  courseStats: [],
  studentPage: 1,
  gradePage: 1,
  gpaPage: 1,
  highlightedStudentId: null,
  transcriptStudentId: null,
  analysisCourseId: null,
  searchTimer: null,
  toastTimer: null,
  lastFocusedElement: null,
  charts: {},
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function injectIcons() {
  document.querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = icons[node.dataset.icon] || '';
  });
}

function getAuthHeaders() {
  if (!state.session) {
    return {};
  }

  const headers = { 'x-user-role': state.session.role };
  if (state.session.role === 'student' && state.session.studentId) {
    headers['x-student-id'] = String(state.session.studentId);
  }
  return headers;
}

async function fetchJson(url, options = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('后端接口未连接，请先启动 server，并从 http://localhost:3000 打开系统');
  }
  if (!contentType.includes('application/json')) {
    throw new Error('服务返回了非 JSON 响应');
  }

  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

function showToast(message, type = 'success', title = type === 'success' ? '操作成功' : '操作失败') {
  const toast = $('toast');
  toast.className = `toast ${type} show`;
  $('toast-title').textContent = title;
  $('toast-message').textContent = message;
  $('toast-icon').innerHTML = type === 'success'
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"></path></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>';

  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

function statusBadge(text, kind) {
  return `<span class="status ${kind}">${escapeHtml(text)}</span>`;
}

function paginate(items, page) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(page, 1), pages);
  return {
    items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    total,
    pages,
    current,
  };
}

function renderPager(containerId, infoId, result, handlerName) {
  $(infoId).textContent = `共 ${result.total} 条，当前第 ${result.current} / ${result.pages} 页`;
  const buttons = [];
  buttons.push(`<button class="page-btn" type="button" ${result.current === 1 ? 'disabled' : ''} onclick="${handlerName}(${result.current - 1})">‹</button>`);
  for (let index = 1; index <= result.pages; index += 1) {
    if (result.pages > 7 && index > 3 && index < result.pages - 2 && Math.abs(index - result.current) > 1) {
      if (!buttons.includes('ellipsis')) {
        buttons.push('ellipsis');
      }
      continue;
    }
    buttons.push(`<button class="page-btn ${index === result.current ? 'active' : ''}" type="button" onclick="${handlerName}(${index})">${index}</button>`);
  }
  buttons.push(`<button class="page-btn" type="button" ${result.current === result.pages ? 'disabled' : ''} onclick="${handlerName}(${result.current + 1})">›</button>`);
  $(containerId).innerHTML = buttons.map((item) => item === 'ellipsis' ? '<span class="pill">…</span>' : item).join('');
}

function animateValue(id, value, decimals = 0) {
  const element = $(id);
  if (!element) return;
  const target = Number(value) || 0;
  const start = performance.now();
  const duration = 640;

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = (target * eased).toFixed(decimals);
    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function renderChart(key, domId, option) {
  if (state.charts[key]) {
    state.charts[key].dispose();
  }
  const chart = echarts.init($(domId));
  chart.setOption(option);
  state.charts[key] = chart;
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('grade-theme', theme);
  $('theme-label').textContent = theme === 'dark' ? '浅色模式' : '深色模式';
  $('theme-icon').dataset.icon = theme === 'dark' ? 'sun' : 'moon';
  $('theme-icon').innerHTML = icons[theme === 'dark' ? 'sun' : 'moon'];
  Object.values(state.charts).forEach((chart) => chart.resize());
}

function setSidebarOpen(isOpen) {
  document.body.classList.toggle('sidebar-open', isOpen);
  $('sidebar-toggle')?.setAttribute('aria-expanded', String(isOpen));
}

function getFocusableNodes(container) {
  if (!container) {
    return [];
  }
  return [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.disabled && node.offsetParent !== null);
}

function openModal(title, bodyHtml, footerHtml) {
  state.lastFocusedElement = document.activeElement;
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHtml;
  $('modal-foot').innerHTML = footerHtml;
  $('modal-mask').classList.add('open');
  requestAnimationFrame(() => {
    const focusable = getFocusableNodes(document.querySelector('.modal'));
    if (focusable.length) {
      focusable[0].focus();
    }
  });
}

function closeModal() {
  $('modal-mask').classList.remove('open');
  if (state.lastFocusedElement instanceof HTMLElement) {
    state.lastFocusedElement.focus();
  }
  state.lastFocusedElement = null;
}

function downloadFile(url) {
  const link = document.createElement('a');
  link.href = `${API_BASE}${url}`;
  link.target = '_blank';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getStoredSession() {
  try {
    const stored = JSON.parse(localStorage.getItem('grade-session') || 'null');
    if (stored?.role === 'admin') {
      return { role: 'admin', studentId: null };
    }
    if (stored?.role === 'student' && Number(stored.studentId)) {
      return { role: 'student', studentId: Number(stored.studentId) };
    }
  } catch (error) {
    localStorage.removeItem('grade-session');
  }
  return null;
}

function getDefaultPageForRole(role) {
  return role === 'student' ? 'student-home' : 'dashboard';
}

function getAllowedPages() {
  return rolePages[state.session?.role] || [];
}

function isPageAllowed(page) {
  return getAllowedPages().includes(page);
}

function setAuthScreenVisible(isVisible) {
  $('auth-screen')?.classList.toggle('is-hidden', !isVisible);
  document.body.classList.toggle('auth-active', isVisible);
}

function getSelectedStudentOption() {
  if (!state.session?.studentId) {
    return null;
  }
  return state.sessionOptions.students.find((student) => Number(student.id) === Number(state.session.studentId)) || null;
}

function updateSessionChrome() {
  const chip = $('session-chip');
  const summary = $('session-summary');
  if (!chip || !summary) {
    return;
  }

  if (!state.session) {
    chip.textContent = '未登录';
    summary.textContent = '未登录';
    return;
  }

  if (state.session.role === 'admin') {
    chip.textContent = '教务管理端';
    summary.textContent = '教务管理端';
    return;
  }

  const student = getSelectedStudentOption();
  const label = student ? `${student.name} / ${student.student_no}` : '学生服务端';
  chip.textContent = label;
  summary.textContent = label;
}

function applyRoleAccess() {
  const allowedPages = getAllowedPages();

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.hidden = !allowedPages.includes(button.dataset.page);
  });

  document.querySelectorAll('.nav-group-title').forEach((titleNode) => {
    const listNode = titleNode.nextElementSibling;
    if (!listNode?.classList.contains('nav-list')) {
      return;
    }
    titleNode.hidden = !listNode.querySelector('.nav-item:not([hidden])');
  });

  updateSessionChrome();
}

async function loadSessionOptions() {
  const response = await fetchJson('/api/session-options');
  state.sessionOptions = response.data || { roles: [], students: [] };
  const select = $('auth-student-select');
  if (!select) {
    return;
  }

  select.innerHTML = state.sessionOptions.students.length
    ? state.sessionOptions.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} (${escapeHtml(student.student_no)})</option>`).join('')
    : '<option value="">暂无学生账号</option>';
}

async function startSession(role, studentId = null) {
  if (role === 'student' && !studentId) {
    showToast('请先选择学生账号', 'error');
    return;
  }

  state.session = {
    role,
    studentId: role === 'student' ? Number(studentId) : null,
  };
  localStorage.setItem('grade-session', JSON.stringify(state.session));
  setAuthScreenVisible(false);
  applyRoleAccess();
  await navigate(getDefaultPageForRole(role));
}

function resetSession() {
  state.session = null;
  state.currentStudent = null;
  localStorage.removeItem('grade-session');
  applyRoleAccess();
  setAuthScreenVisible(true);
}

function formatStudentStatus(status) {
  const map = { 1: ['在读', 'success'], 2: ['休学', 'warning'], 3: ['毕业', 'info'] };
  return map[status] || ['未知', 'warning'];
}

function formatGradeStatus(score) {
  return Number(score) >= 60 ? ['及格', 'success'] : ['不及格', 'danger'];
}

function getGradeLevel(score) {
  const s = Number(score);
  if (s >= 90) return '优秀';
  if (s >= 80) return '良好';
  if (s >= 70) return '中等';
  if (s >= 60) return '及格';
  return '不及格';
}

async function ensureStudents() {
  if (!state.students.length) {
    const response = await fetchJson('/api/students');
    state.students = response.data || [];
  }
  syncStudentSelects();
}

async function ensureCourses() {
  if (!state.courses.length) {
    const response = await fetchJson('/api/courses');
    state.courses = response.data || [];
  }
  syncCourseSelects();
}

function syncStudentSelects() {
  const majors = [...new Set(state.students.map((student) => student.major).filter(Boolean))];
  const majorSelect = $('student-filter-major');
  const currentMajor = majorSelect.value;
  majorSelect.innerHTML = `<option value="">全部专业</option>${majors.map((major) => `<option value="${escapeHtml(major)}">${escapeHtml(major)}</option>`).join('')}`;
  if (majors.includes(currentMajor)) {
    majorSelect.value = currentMajor;
  }

  const transcriptSelect = $('transcript-student');
  const currentValue = String(state.transcriptStudentId || transcriptSelect.value || '');
  transcriptSelect.innerHTML = state.students.length
    ? state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} (${escapeHtml(student.student_no)})</option>`).join('')
    : '<option value="">暂无学生</option>';
  if (currentValue) {
    transcriptSelect.value = currentValue;
  }
}

function syncCourseSelects() {
  const select = $('analysis-course');
  const currentValue = String(state.analysisCourseId || select.value || '');
  select.innerHTML = state.courses.length
    ? state.courses.map((course) => `<option value="${course.id}">${escapeHtml(course.course_name)} (${escapeHtml(course.course_code)})</option>`).join('')
    : '<option value="">暂无课程</option>';
  if (currentValue) {
    select.value = currentValue;
  }
}

function countRecentGradeActivity(days = 7) {
  const now = Date.now();
  const threshold = now - (days * 24 * 60 * 60 * 1000);
  return state.grades.filter((grade) => {
    const timestamp = Date.parse(grade.updated_at || grade.created_at || '');
    return Number.isFinite(timestamp) && timestamp >= threshold;
  }).length;
}

function renderDashboardAlerts(stats) {
  const lowestCourse = [...state.courseStats]
    .filter((course) => Number.isFinite(Number(course.avg_score)))
    .sort((left, right) => Number(left.avg_score) - Number(right.avg_score))[0];
  const topCourse = [...state.courseStats]
    .filter((course) => Number.isFinite(Number(course.avg_score)))
    .sort((left, right) => Number(right.avg_score) - Number(left.avg_score))[0];
  const latestGrade = state.grades[0];
  const items = [];

  if (Number(stats.fail_count || 0) > 0) {
    items.push({
      level: 'danger',
      label: '学业',
      title: `${Number(stats.fail_count)} 条不及格记录`,
      detail: '进入成绩登记或课程质量核对。',
    });
  }

  if (lowestCourse) {
    items.push({
      level: 'warning',
      label: '课程',
      title: `${lowestCourse.course_name} 均分偏低`,
      detail: `平均分 ${Number(lowestCourse.avg_score || 0).toFixed(1)}。`,
    });
  }

  if (latestGrade) {
    items.push({
      level: 'info',
      label: '变更',
      title: `${latestGrade.student_name} · ${latestGrade.course_name}`,
      detail: `分数 ${Number(latestGrade.score || 0).toFixed(1)}，${formatDateTime(latestGrade.updated_at || latestGrade.created_at)}。`,
    });
  }

  if (topCourse) {
    items.push({
      level: 'info',
      label: '统计',
      title: `${topCourse.course_name} 表现稳定`,
      detail: `平均分 ${Number(topCourse.avg_score || 0).toFixed(1)}。`,
    });
  }

  $('dashboard-alerts').innerHTML = items.length
    ? items.map((item) => `
        <div class="alert-item">
          <span class="alert-badge ${item.level}">${escapeHtml(item.label)}</span>
          <div class="alert-content">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </div>
        </div>
      `).join('')
    : `
        <div class="alert-item">
          <span class="alert-badge info">正常</span>
          <div class="alert-content">
            <strong>暂无异常事项</strong>
            <span>教务数据运行正常。</span>
          </div>
        </div>
      `;
}

async function loadDashboard() {
  const [statsRes, gradesRes, distributionRes, courseStatsRes] = await Promise.all([
    fetchJson('/api/stats'),
    fetchJson('/api/grades'),
    fetchJson('/api/charts/score-distribution'),
    fetchJson('/api/charts/course-stats'),
  ]);

  state.grades = gradesRes.data || [];
  state.courseStats = courseStatsRes.data || [];
  const recentActivityCount = countRecentGradeActivity(7);

  animateValue('metric-students', statsRes.data.student_count);
  animateValue('metric-courses', statsRes.data.course_count);
  animateValue('metric-grades', statsRes.data.grade_count);
  animateValue('metric-failures', statsRes.data.fail_count);
  animateValue('metric-activity', recentActivityCount);
  animateValue('hero-average', statsRes.data.avg_score || 0, 1);
  $('dashboard-update-time').textContent = formatDateTime(state.grades[0]?.updated_at || state.grades[0]?.created_at || new Date().toISOString());
  $('dashboard-data-status').textContent = Number(statsRes.data.fail_count || 0) > 0 ? '存在待关注数据' : '数据状态正常';
  renderDashboardAlerts(statsRes.data || {});

  const chartText = getComputedStyle(document.body).getPropertyValue('--text').trim();
  const chartTextSoft = getComputedStyle(document.body).getPropertyValue('--text-soft').trim();
  const distributionData = [
    { value: Number(distributionRes.data.excellent || 0), name: '优秀' },
    { value: Number(distributionRes.data.good || 0), name: '良好' },
    { value: Number(distributionRes.data.medium || 0), name: '中等' },
    { value: Number(distributionRes.data.pass || 0), name: '及格' },
    { value: Number(distributionRes.data.fail || 0), name: '不及格' },
  ];
  const totalDistribution = distributionData.reduce((sum, item) => sum + item.value, 0);

  renderChart('distribution', 'chart-distribution', {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      borderColor: '#dbe4f0',
      borderWidth: 1,
      padding: 12,
      borderRadius: 10,
      textStyle: { color: '#334155' },
      formatter: (params) => `${params.name}<br/>${params.value} 人 (${params.percent}%)`,
    },
    color: ['#18a36f', '#2f73e0', '#e28b11', '#6a5af9', '#de425b'],
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      icon: 'circle',
      textStyle: { color: chartTextSoft, fontSize: 12 },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '39%',
        style: {
          text: '成绩总数',
          fill: chartTextSoft,
          fontSize: 12,
          fontWeight: 500,
          textAlign: 'center',
        },
      },
      {
        type: 'text',
        left: 'center',
        top: '46%',
        style: {
          text: `${totalDistribution}`,
          fill: chartText,
          fontSize: 28,
          fontWeight: 700,
          textAlign: 'center',
          fontFamily: 'JetBrains Mono, monospace',
        },
      },
    ],
    series: [{
      type: 'pie',
      center: ['50%', '42%'],
      radius: ['50%', '74%'],
      avoidLabelOverlap: true,
      minAngle: 6,
      itemStyle: { borderRadius: 14, borderWidth: 4, borderColor: '#ffffff' },
      labelLine: {
        length: 16,
        length2: 12,
        lineStyle: { width: 1.4 },
      },
      label: {
        formatter: ({ name, value, percent }) => `${name}\n${value} 人  ${percent}%`,
        color: chartText,
        fontSize: 12,
        lineHeight: 18,
      },
      emphasis: {
        scale: true,
        scaleSize: 6,
      },
      data: distributionData,
    }],
  });

  renderChart('course-overview', 'chart-course-overview', {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 12, borderRadius: 8, textStyle: { color: '#333' } },
    grid: { left: 42, right: 20, top: 28, bottom: 50 },
    legend: { bottom: 6, textStyle: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    xAxis: {
      type: 'category',
      data: state.courseStats.map((item) => item.course_name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { interval: 0, rotate: 20, color: getComputedStyle(document.body).getPropertyValue('--text-soft') },
    },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    series: [
      { name: '平均分', type: 'bar', data: state.courseStats.map((item) => item.avg_score), itemStyle: { color: '#1d74f5', borderRadius: [6, 6, 0, 0] } },
      { name: '最高分', type: 'line', smooth: true, areaStyle: { color: 'rgba(17, 163, 106, 0.1)' }, data: state.courseStats.map((item) => item.max_score), itemStyle: { color: '#11a36a' } },
      { name: '最低分', type: 'line', smooth: true, areaStyle: { color: 'rgba(219, 68, 85, 0.05)' }, data: state.courseStats.map((item) => item.min_score), itemStyle: { color: '#db4455' } },
    ],
  });

  const recentRows = state.grades.slice(0, 8);
  $('dashboard-recent').innerHTML = recentRows.length
    ? recentRows.map((row, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td class="mono">${escapeHtml(row.student_no)}</td>
          <td>${escapeHtml(row.student_name)}</td>
          <td>${escapeHtml(row.course_name)}</td>
          <td class="cell-center">${statusBadge(Number(row.score).toFixed(1), Number(row.score) >= 60 ? 'success' : 'danger')}</td>
          <td class="cell-center">${Number(row.grade_point || 0).toFixed(2)}</td>
          <td class="cell-muted">${formatDateTime(row.updated_at || row.created_at)}</td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="7">暂无成绩记录</td></tr>';
}

async function loadStudents() {
  const response = await fetchJson('/api/students');
  state.students = response.data || [];
  syncStudentSelects();
  renderStudents();
}

function renderStudents() {
  const studentNo = $('student-filter-no').value.trim().toLowerCase();
  const studentName = $('student-filter-name').value.trim().toLowerCase();
  const studentMajor = $('student-filter-major').value;
  const studentStatus = $('student-filter-status').value;
  let filtered = [...state.students];

  if (studentNo) {
    filtered = filtered.filter((student) => String(student.student_no).toLowerCase().includes(studentNo));
  }
  if (studentName) {
    filtered = filtered.filter((student) => String(student.name).toLowerCase().includes(studentName));
  }
  if (studentMajor) {
    filtered = filtered.filter((student) => student.major === studentMajor);
  }
  if (studentStatus) {
    filtered = filtered.filter((student) => String(student.status) === studentStatus);
  }

  const paged = paginate(filtered, state.studentPage);
  state.studentPage = paged.current;
  $('students-count').textContent = String(filtered.length);
  $('students-body').innerHTML = paged.items.length
    ? paged.items.map((student, index) => {
      const [label, kind] = formatStudentStatus(student.status);
      return `
        <tr class="${state.highlightedStudentId === student.id ? 'highlight' : ''}" data-student-id="${student.id}">
          <td class="cell-center"><input class="checkbox student-check" type="checkbox" value="${student.id}"></td>
          <td class="cell-center">${(paged.current - 1) * PAGE_SIZE + index + 1}</td>
          <td class="mono">${escapeHtml(student.student_no)}</td>
          <td>${escapeHtml(student.name)}</td>
          <td>${escapeHtml(student.college || '—')}</td>
          <td>${escapeHtml(student.major || '—')}</td>
          <td class="cell-center">${statusBadge(label, kind)}</td>
          <td><div class="table-actions"><button class="link-btn" type="button" onclick="openStudentModal(${student.id})">编辑</button><button class="link-btn" type="button" onclick="openTranscriptFromStudent(${student.id})">成绩单</button><button class="link-btn danger" type="button" onclick="confirmStudentDelete(${student.id}, '${escapeHtml(student.name)}')">删除</button></div></td>
        </tr>
      `;
    }).join('')
    : '<tr><td class="empty" colspan="7">当前筛选条件下没有学生记录</td></tr>';

  renderPager('students-pager', 'students-pager-info', paged, 'gotoStudentPage');
  $('student-check-all').checked = false;

  if (state.highlightedStudentId) {
    const row = document.querySelector(`[data-student-id="${state.highlightedStudentId}"]`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

async function loadCourses() {
  const response = await fetchJson('/api/courses');
  state.courses = response.data || [];
  syncCourseSelects();
  renderCourses();
}

function renderCourses() {
  const courseCode = $('course-filter-code').value.trim().toLowerCase();
  const courseName = $('course-filter-name').value.trim().toLowerCase();
  let filtered = [...state.courses];

  if (courseCode) {
    filtered = filtered.filter((course) => String(course.course_code).toLowerCase().includes(courseCode));
  }
  if (courseName) {
    filtered = filtered.filter((course) => String(course.course_name).toLowerCase().includes(courseName));
  }

  $('courses-body').innerHTML = filtered.length
    ? filtered.map((course, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td class="mono">${escapeHtml(course.course_code)}</td>
          <td>${escapeHtml(course.course_name)}</td>
          <td>${escapeHtml(course.teacher || '—')}</td>
          <td class="cell-center">${Number(course.credits).toFixed(1)}</td>
          <td><div class="table-actions"><button class="link-btn" type="button" onclick="openCourseModal(${course.id})">编辑</button><button class="link-btn" type="button" onclick="openAnalysisFromCourse(${course.id})">分析</button><button class="link-btn danger" type="button" onclick="confirmCourseDelete(${course.id}, '${escapeHtml(course.course_name)}')">删除</button></div></td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="5">没有匹配的课程</td></tr>';
}

async function loadGrades() {
  const [gradesRes, studentsRes, coursesRes] = await Promise.all([
    fetchJson('/api/grades'),
    fetchJson('/api/students'),
    fetchJson('/api/courses'),
  ]);

  state.grades = gradesRes.data || [];
  state.students = studentsRes.data || [];
  state.courses = coursesRes.data || [];
  syncStudentSelects();
  syncCourseSelects();
  renderGrades();
}

function renderGrades() {
  const studentName = $('grade-filter-name').value.trim().toLowerCase();
  const courseName = $('grade-filter-course').value.trim().toLowerCase();
  const gradeStatus = $('grade-filter-status').value;
  let filtered = [...state.grades];

  if (studentName) {
    filtered = filtered.filter((grade) => String(grade.student_name).toLowerCase().includes(studentName));
  }
  if (courseName) {
    filtered = filtered.filter((grade) => String(grade.course_name).toLowerCase().includes(courseName));
  }
  if (gradeStatus === 'pass') {
    filtered = filtered.filter((grade) => Number(grade.score) >= 60);
  }
  if (gradeStatus === 'fail') {
    filtered = filtered.filter((grade) => Number(grade.score) < 60);
  }

  const paged = paginate(filtered, state.gradePage);
  state.gradePage = paged.current;
  $('grades-count').textContent = String(filtered.length);
  $('grades-body').innerHTML = paged.items.length
    ? paged.items.map((grade, index) => {
      const [label, kind] = formatGradeStatus(grade.score);
      return `
        <tr>
          <td class="cell-center">${(paged.current - 1) * PAGE_SIZE + index + 1}</td>
          <td class="mono">${escapeHtml(grade.student_no)}</td>
          <td>${escapeHtml(grade.student_name)}</td>
          <td>${escapeHtml(grade.course_name)}</td>
          <td class="cell-center">${Number(grade.credits).toFixed(1)}</td>
          <td class="cell-center">${statusBadge(Number(grade.score).toFixed(1), kind)}</td>
          <td class="cell-center">${Number(grade.grade_point || 0).toFixed(2)}</td>
          <td class="cell-center">${statusBadge(label, kind)}</td>
          <td><div class="table-actions"><button class="link-btn" type="button" onclick="openGradeModal(${grade.id})">改分</button><button class="link-btn danger" type="button" onclick="confirmGradeDelete(${grade.id})">删除</button></div></td>
        </tr>
      `;
    }).join('')
    : '<tr><td class="empty" colspan="9">没有匹配的成绩记录</td></tr>';

  renderPager('grades-pager', 'grades-pager-info', paged, 'gotoGradePage');
}

async function loadTranscript() {
  await ensureStudents();
  if (!state.students.length) {
    renderTranscript([]);
    return;
  }

  const studentId = Number($('transcript-student').value || state.transcriptStudentId || state.students[0].id);
  state.transcriptStudentId = studentId;
  $('transcript-student').value = String(studentId);

  const response = await fetchJson(`/api/transcript/${studentId}`);
  renderTranscript(response.data || []);
}

function renderTranscript(rows) {
  const student = rows[0] || state.students.find((item) => item.id === state.transcriptStudentId) || null;
  const totalCredits = rows.reduce((sum, item) => sum + Number(item.credits || 0), 0);
  const totalPoints = rows.reduce((sum, item) => sum + Number(item.grade_point || 0) * Number(item.credits || 0), 0);
  const gpa = totalCredits ? totalPoints / totalCredits : 0;

  $('transcript-course-count').textContent = String(rows.length);
  $('transcript-credits').textContent = totalCredits.toFixed(1);
  $('transcript-gpa').textContent = gpa.toFixed(2);
  $('transcript-student-meta').textContent = student ? `${student.name || student.student_name || '未命名学生'} / ${student.student_no || '—'}` : '请选择学生';
  $('transcript-major-meta').textContent = student && student.major ? `专业：${student.major}` : '专业信息待加载';

  $('transcript-body').innerHTML = rows.length
    ? rows.map((item, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td class="mono">${escapeHtml(item.course_code)}</td>
          <td>${escapeHtml(item.course_name)}</td>
          <td class="cell-center">${Number(item.credits).toFixed(1)}</td>
          <td class="cell-center">${statusBadge(Number(item.score).toFixed(1), Number(item.score) >= 60 ? 'success' : 'danger')}</td>
          <td class="cell-center">${Number(item.grade_point || 0).toFixed(2)}</td>
          <td class="cell-center">${statusBadge(getGradeLevel(item.score), Number(item.score) >= 60 ? 'info' : 'danger')}</td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="7">该学生暂无成绩数据</td></tr>';

  renderChart('transcript', 'chart-transcript', {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 12, borderRadius: 8, textStyle: { color: '#333' } },
    legend: { bottom: 6, textStyle: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    grid: { left: 40, right: 40, top: 26, bottom: 60 },
    xAxis: { type: 'category', data: rows.map((item) => item.course_code), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    yAxis: [
      { type: 'value', min: 0, max: 100, splitLine: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
      { type: 'value', min: 0, max: 5, splitLine: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    ],
    series: [
      { name: '分数', type: 'bar', data: rows.map((item) => item.score), itemStyle: { color: '#1d74f5', borderRadius: [6, 6, 0, 0] } },
      { name: '绩点', type: 'line', yAxisIndex: 1, smooth: true, areaStyle: { color: 'rgba(20, 184, 166, 0.1)' }, data: rows.map((item) => item.grade_point), itemStyle: { color: '#14b8a6' } },
    ],
  });
}

async function loadStudentHome() {
  if (!state.session || state.session.role !== 'student') {
    return;
  }

  const studentId = Number(state.session.studentId);
  const [profileResponse, transcriptResponse, courseStatsResponse] = await Promise.all([
    fetchJson('/api/me'),
    fetchJson(`/api/transcript/${studentId}`),
    fetchJson('/api/charts/course-stats'),
  ]);

  state.currentStudent = profileResponse.data?.student || getSelectedStudentOption();
  renderStudentHome(
    state.currentStudent,
    transcriptResponse.data || [],
    courseStatsResponse.data || []
  );
}

function renderStudentHome(student, rows, courseStats) {
  const totalCredits = rows.reduce((sum, item) => sum + Number(item.credits || 0), 0);
  const totalPoints = rows.reduce((sum, item) => sum + Number(item.grade_point || 0) * Number(item.credits || 0), 0);
  const gpa = totalCredits ? totalPoints / totalCredits : 0;
  const failCount = rows.filter((item) => Number(item.score) < 60).length;

  $('student-home-title').textContent = student ? `${student.name} 的学生门户` : '学生门户';
  $('student-home-subtitle').textContent = student ? `${student.major || '未填写专业'} / ${student.student_no}` : '';
  $('student-home-meta').textContent = failCount > 0 ? `关注 ${failCount} 门课程` : '学业正常';
  $('student-course-count').textContent = String(rows.length);
  $('student-credits').textContent = totalCredits.toFixed(1);
  $('student-gpa').textContent = gpa.toFixed(2);

  const profileRows = [
    ['姓名', student?.name || '未加载'],
    ['学号', student?.student_no || '未加载'],
    ['学院', student?.college || '未填写'],
    ['专业', student?.major || '未填写'],
    ['已修课程', `${rows.length} 门`],
    ['待关注', `${failCount} 门`],
  ];

  $('student-profile-list').innerHTML = profileRows.map(([label, value]) => `
    <div class="info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join('');

  $('student-transcript-body').innerHTML = rows.length
    ? rows.map((item, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td class="mono">${escapeHtml(item.course_code)}</td>
          <td>${escapeHtml(item.course_name)}</td>
          <td class="cell-center">${Number(item.credits).toFixed(1)}</td>
          <td class="cell-center">${statusBadge(Number(item.score).toFixed(1), Number(item.score) >= 60 ? 'success' : 'danger')}</td>
          <td class="cell-center">${Number(item.grade_point || 0).toFixed(2)}</td>
          <td class="cell-center">${statusBadge(getGradeLevel(item.score), Number(item.score) >= 60 ? 'info' : 'danger')}</td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="7">暂无成绩数据</td></tr>';

  $('student-course-overview-body').innerHTML = courseStats.length
    ? courseStats.map((course, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td class="mono">${escapeHtml(course.course_code || '-')}</td>
          <td>${escapeHtml(course.course_name)}</td>
          <td class="cell-center">${Number(course.avg_score || 0).toFixed(1)}</td>
          <td class="cell-center">${Number(course.max_score || 0).toFixed(1)}</td>
          <td class="cell-center">${Number(course.min_score || 0).toFixed(1)}</td>
          <td class="cell-center">${Number(course.student_count || 0)}</td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="7">暂无课程统计数据</td></tr>';

  renderChart('student-score', 'chart-student-score', {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 12, borderRadius: 8, textStyle: { color: '#333' } },
    legend: { bottom: 6, textStyle: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    grid: { left: 40, right: 40, top: 26, bottom: 60 },
    xAxis: { type: 'category', data: rows.map((item) => item.course_code), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    yAxis: [
      { type: 'value', min: 0, max: 100, splitLine: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
      { type: 'value', min: 0, max: 5, splitLine: { show: false }, axisLabel: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') } },
    ],
    series: [
      { name: '分数', type: 'bar', data: rows.map((item) => item.score), itemStyle: { color: '#4f46e5', borderRadius: [6, 6, 0, 0] } },
      { name: '绩点', type: 'line', yAxisIndex: 1, smooth: true, data: rows.map((item) => item.grade_point), itemStyle: { color: '#14b8a6' } },
    ],
  });
}

async function loadAnalysis() {
  await ensureCourses();
  const overviewResponse = await fetchJson('/api/charts/course-stats');
  state.courseStats = overviewResponse.data || [];
  $('analysis-overview-body').innerHTML = state.courseStats.length
    ? state.courseStats.map((course, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td class="mono">${escapeHtml(course.course_code || '—')}</td>
          <td>${escapeHtml(course.course_name)}</td>
          <td class="cell-center">${Number(course.avg_score || 0).toFixed(1)}</td>
          <td class="cell-center">${Number(course.max_score || 0).toFixed(1)}</td>
          <td class="cell-center">${Number(course.min_score || 0).toFixed(1)}</td>
          <td class="cell-center">${Number(course.student_count || 0)}</td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="7">暂无课程统计</td></tr>';

  if (!state.courses.length) {
    renderAnalysisSummary(null);
    return;
  }

  const courseId = Number($('analysis-course').value || state.analysisCourseId || state.courses[0].id);
  state.analysisCourseId = courseId;
  $('analysis-course').value = String(courseId);

  const response = await fetchJson(`/api/course-analysis/${courseId}`);
  renderAnalysisSummary((response.data || [])[0] || null);
}

function renderAnalysisSummary(summary) {
  const safe = summary || {
    total_students: 0,
    avg_score: 0,
    pass_rate: 0,
    max_score: 0,
    min_score: 0,
    excellent_count: 0,
    good_count: 0,
    medium_count: 0,
    pass_count: 0,
    fail_count: 0,
  };

  $('analysis-total').textContent = String(safe.total_students || 0);
  $('analysis-average').textContent = Number(safe.avg_score || 0).toFixed(1);
  $('analysis-pass-rate').textContent = `${Number(safe.pass_rate || 0).toFixed(1)}%`;

  renderChart('analysis-buckets', 'chart-analysis-buckets', {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 12, borderRadius: 8, textStyle: { color: '#333' } },
    color: ['#11a36a', '#1d74f5', '#d88417', '#6a5af9', '#db4455'],
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      itemStyle: { borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
      label: { formatter: '{b}\n{c} 人', color: getComputedStyle(document.body).getPropertyValue('--text') },
      data: [
        { value: Number(safe.excellent_count || 0), name: '优秀' },
        { value: Number(safe.good_count || 0), name: '良好' },
        { value: Number(safe.medium_count || 0), name: '中等' },
        { value: Number(safe.pass_count || 0), name: '及格' },
        { value: Number(safe.fail_count || 0), name: '不及格' },
      ],
    }],
  });

  renderChart('analysis-radar', 'chart-analysis-radar', {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 12, borderRadius: 8, textStyle: { color: '#333' } },
    radar: {
      indicator: [
        { name: '平均分', max: 100 },
        { name: '最高分', max: 100 },
        { name: '最低分', max: 100 },
        { name: '通过率', max: 100 },
      ],
      axisName: { color: getComputedStyle(document.body).getPropertyValue('--text-soft') },
      splitNumber: 4,
      splitArea: { areaStyle: { color: ['transparent'] } },
      axisLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.05)' } },
    },
    series: [{
      type: 'radar',
      symbol: 'none',
      areaStyle: { color: 'rgba(29, 116, 245, 0.25)' },
      lineStyle: { color: '#1d74f5' },
      data: [{
        value: [
          Number(safe.avg_score || 0),
          Number(safe.max_score || 0),
          Number(safe.min_score || 0),
          Number(safe.pass_rate || 0),
        ],
        name: safe.course_name || '课程分析',
      }],
    }],
  });
}

async function loadGpa() {
  const response = await fetchJson('/api/gpa');
  state.gpa = response.data || [];
  renderGpa();
}

function renderGpa() {
  const paged = paginate(state.gpa, state.gpaPage);
  state.gpaPage = paged.current;
  $('gpa-body').innerHTML = paged.items.length
    ? paged.items.map((item, index) => `
        <tr>
          <td class="cell-center">${(paged.current - 1) * PAGE_SIZE + index + 1}</td>
          <td class="mono">${escapeHtml(item.student_no)}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.major || '—')}</td>
          <td class="cell-center">${Number(item.course_count || 0)}</td>
          <td class="cell-center">${Number(item.total_credits || 0).toFixed(1)}</td>
          <td class="cell-center">
            ${statusBadge(Number(item.final_gpa || 0).toFixed(2), Number(item.final_gpa || 0) >= 3.5 ? 'success' : Number(item.final_gpa || 0) >= 2 ? 'warning' : 'danger')}
          </td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="7">暂无 GPA 数据</td></tr>';

  renderPager('gpa-pager', 'gpa-pager-info', paged, 'gotoGpaPage');
}

async function loadDatabaseObjects() {
  const response = await fetchJson('/api/db-objects');
  const data = response.data;
  $('db-tables-body').innerHTML = data.tables.length
    ? data.tables.map((item) => `<tr><td class="mono">${escapeHtml(item.TABLE_NAME)}</td><td>${escapeHtml(item.TABLE_COMMENT || '—')}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="2">暂无数据表</td></tr>';
  $('db-triggers-body').innerHTML = data.triggers.length
    ? data.triggers.map((item) => `<tr><td class="mono">${escapeHtml(item.TRIGGER_NAME)}</td><td>${escapeHtml(item.ACTION_TIMING)}</td><td>${escapeHtml(item.EVENT_MANIPULATION)}</td><td class="mono">${escapeHtml(item.EVENT_OBJECT_TABLE)}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="4">未查询到触发器</td></tr>';
  $('db-views-body').innerHTML = data.views.length
    ? data.views.map((item) => `<tr><td class="mono">${escapeHtml(item.TABLE_NAME)}</td></tr>`).join('')
    : '<tr><td class="empty">未查询到视图</td></tr>';
  $('db-procedures-body').innerHTML = data.procedures.length
    ? data.procedures.map((item) => `<tr><td class="mono">${escapeHtml(item.ROUTINE_NAME)}</td><td>${escapeHtml(item.ROUTINE_TYPE)}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="2">未查询到存储过程</td></tr>';
  $('db-indexes-body').innerHTML = data.indexes.length
    ? data.indexes.map((item) => `<tr><td class="mono">${escapeHtml(item.TABLE_NAME)}</td><td class="mono">${escapeHtml(item.INDEX_NAME)}</td><td>${escapeHtml(item.COLUMN_NAME)}</td><td class="cell-center">${statusBadge(item.NON_UNIQUE === 0 ? '是' : '否', item.NON_UNIQUE === 0 ? 'success' : 'warning')}</td></tr>`).join('')
    : '<tr><td class="empty" colspan="4">未查询到索引</td></tr>';
}

async function loadLogs() {
  const response = await fetchJson('/api/audit-log');
  const rows = response.data || [];
  $('logs-body').innerHTML = rows.length
    ? rows.map((item, index) => {
      const kind = item.operation === 'INSERT' ? 'success' : item.operation === 'UPDATE' ? 'warning' : 'danger';
      return `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td>${escapeHtml(item.student_name || item.student_id)}</td>
          <td>${escapeHtml(item.course_name || item.course_id)}</td>
          <td class="cell-center">${statusBadge(item.operation, kind)}</td>
          <td class="cell-center">${item.old_score == null ? '—' : Number(item.old_score).toFixed(1)}</td>
          <td class="cell-center">${item.new_score == null ? '—' : Number(item.new_score).toFixed(1)}</td>
          <td class="cell-muted">${formatDateTime(item.operated_at)}</td>
        </tr>
      `;
    }).join('')
    : '<tr><td class="empty" colspan="7">暂无日志数据</td></tr>';
}

async function navigate(page) {
  if (!state.session) {
    setAuthScreenVisible(true);
    return;
  }

  if (!isPageAllowed(page)) {
    page = getDefaultPageForRole(state.session.role);
  }

  state.currentPage = page;
  document.querySelectorAll('.nav-item').forEach((button) => {
    const isActive = button.dataset.page === page;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
  document.querySelectorAll('.page').forEach((node) => {
    node.classList.toggle('active', node.id === `page-${page}`);
  });
  const titleEl = $('page-title');
  const descEl = $('page-desc');
  if (titleEl) titleEl.textContent = pageMeta[page].title;
  if (descEl) descEl.textContent = pageMeta[page].desc;

  const pagesWithSearch = state.session.role === 'admin' ? rolePages.admin : [];
  const searchRow = document.querySelector('#topbar-search-row');
  if (searchRow) searchRow.style.display = pagesWithSearch.includes(page) ? '' : 'none';

  setSidebarOpen(false);

  if (page === 'dashboard') await loadDashboard();
  if (page === 'student-home') await loadStudentHome();
  if (page === 'students') await loadStudents();
  if (page === 'courses') await loadCourses();
  if (page === 'grades') await loadGrades();
  if (page === 'transcript') await loadTranscript();
  if (page === 'analysis') await loadAnalysis();
  if (page === 'gpa') await loadGpa();
  if (page === 'database') await loadDatabaseObjects();
  if (page === 'logs') await loadLogs();
}

async function handleGlobalSearch(query) {
  const keyword = query.trim();
  if (!keyword) {
    $('search-results').classList.remove('show');
    $('search-results').innerHTML = '';
    return;
  }

  try {
    const response = await fetchJson(`/api/search/students?q=${encodeURIComponent(keyword)}`);
    const rows = response.data || [];
    $('search-results').innerHTML = rows.length
      ? rows.map((student) => `
          <div class="search-result" role="option">
            <div class="search-result-main">
              <strong>${escapeHtml(student.name)} <span class="mono">${escapeHtml(student.student_no)}</span></strong>
              <span>${escapeHtml([student.college, student.major].filter(Boolean).join(' · ') || '档案信息待补充')}</span>
            </div>
            <div class="search-result-actions">
              <button type="button" onclick="locateStudent(${student.id}, true)">档案</button>
              <button type="button" onclick="openTranscriptFromSearch(${student.id})">学业</button>
            </div>
          </div>
        `).join('')
      : '<div class="empty">没有找到匹配学生</div>';
    $('search-results').classList.add('show');
  } catch (error) {
    console.error(error);
    $('search-results').innerHTML = '<div class="empty">搜索失败</div>';
    $('search-results').classList.add('show');
  }
}

function triggerGlobalSearch() {
  clearTimeout(state.searchTimer);
  handleGlobalSearch($('global-search').value).catch((error) => {
    console.error(error);
    showToast(error.message, 'error');
  });
}

async function locateStudent(studentId, fromSearch = false) {
  await ensureStudents();
  const student = state.students.find((item) => item.id === Number(studentId));
  if (!student) {
    showToast('未找到对应学生', 'error');
    return;
  }

  state.highlightedStudentId = student.id;
  $('student-filter-no').value = student.student_no;
  $('student-filter-name').value = '';
  $('student-filter-major').value = '';
  $('student-filter-status').value = '';
  if (fromSearch) {
    $('global-search').value = '';
    $('search-results').classList.remove('show');
  }
  await navigate('students');
  showToast(`已定位到学生 ${student.name}`);
  setTimeout(() => {
    state.highlightedStudentId = null;
  }, 2400);
}

async function openTranscriptFromStudent(studentId) {
  state.transcriptStudentId = Number(studentId);
  await navigate('transcript');
}

async function openTranscriptFromSearch(studentId) {
  $('global-search').value = '';
  $('search-results').classList.remove('show');
  state.transcriptStudentId = Number(studentId);
  await navigate('transcript');
}

async function openAnalysisFromCourse(courseId) {
  state.analysisCourseId = Number(courseId);
  await navigate('analysis');
}

function openStudentModal(studentId = null) {
  const student = studentId ? state.students.find((item) => item.id === Number(studentId)) : null;
  const isEdit = Boolean(student);
  openModal(
    isEdit ? '编辑学生' : '新增学生',
    `
      <div class="field"><label for="modal-student-no">学号</label><input id="modal-student-no" type="text" value="${escapeHtml(student?.student_no || '')}" ${isEdit ? 'disabled' : ''}></div>
      <div class="field"><label for="modal-student-name">姓名</label><input id="modal-student-name" type="text" value="${escapeHtml(student?.name || '')}"></div>
      <div class="field"><label for="modal-student-college">学院</label><input id="modal-student-college" type="text" value="${escapeHtml(student?.college || '')}"></div>
      <div class="field"><label for="modal-student-major">专业</label><input id="modal-student-major" type="text" value="${escapeHtml(student?.major || '')}"></div>
      ${isEdit ? `<div class="field"><label for="modal-student-status">状态</label><select id="modal-student-status"><option value="1" ${Number(student.status) === 1 ? 'selected' : ''}>在读</option><option value="2" ${Number(student.status) === 2 ? 'selected' : ''}>休学</option><option value="3" ${Number(student.status) === 3 ? 'selected' : ''}>毕业</option></select></div>` : ''}
    `,
    `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-primary" type="button" onclick="saveStudent(${student?.id || 'null'})">${isEdit ? '保存修改' : '创建学生'}</button>`
  );
}

async function saveStudent(studentId) {
  const payload = {
    student_no: $('modal-student-no').value.trim(),
    name: $('modal-student-name').value.trim(),
    college: $('modal-student-college').value.trim(),
    major: $('modal-student-major').value.trim(),
  };
  if (!payload.student_no || !payload.name) {
    showToast('学号和姓名为必填项', 'error');
    return;
  }

  try {
    if (studentId) {
      payload.status = Number($('modal-student-status').value);
      await fetchJson(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('学生信息已更新');
    } else {
      await fetchJson('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('学生已创建');
    }
    closeModal();
    await loadStudents();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function confirmStudentDelete(studentId, studentName) {
  openModal('删除学生', `<p>确定删除学生 <strong>${studentName}</strong> 吗？相关成绩也会被级联删除。</p>`, `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-danger" type="button" onclick="deleteStudent(${studentId})">确认删除</button>`);
}

async function deleteStudent(studentId) {
  try {
    await fetchJson(`/api/students/${studentId}`, { method: 'DELETE' });
    closeModal();
    showToast('学生已删除');
    await loadStudents();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function batchDeleteStudents() {
  const ids = [...document.querySelectorAll('.student-check:checked')].map((input) => Number(input.value));
  if (!ids.length) {
    showToast('请先勾选需要删除的学生', 'error');
    return;
  }
  openModal('批量删除学生', `<p>确定删除选中的 ${ids.length} 名学生吗？操作不可撤销。</p>`, `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-danger" type="button" onclick="confirmBatchDeleteStudents([${ids.join(',')}])">确认批量删除</button>`);
}

async function confirmBatchDeleteStudents(ids) {
  try {
    for (const id of ids) {
      await fetchJson(`/api/students/${id}`, { method: 'DELETE' });
    }
    closeModal();
    showToast(`已删除 ${ids.length} 名学生`);
    await loadStudents();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function openCourseModal(courseId = null) {
  const course = courseId ? state.courses.find((item) => item.id === Number(courseId)) : null;
  const isEdit = Boolean(course);
  openModal(
    isEdit ? '编辑课程' : '新增课程',
    `
      <div class="field"><label for="modal-course-code">课程代码</label><input id="modal-course-code" type="text" value="${escapeHtml(course?.course_code || '')}" ${isEdit ? 'disabled' : ''}></div>
      <div class="field"><label for="modal-course-name">课程名称</label><input id="modal-course-name" type="text" value="${escapeHtml(course?.course_name || '')}"></div>
      <div class="field"><label for="modal-course-teacher">任课教师</label><input id="modal-course-teacher" type="text" value="${escapeHtml(course?.teacher || '')}"></div>
      <div class="field"><label for="modal-course-credits">学分</label><input id="modal-course-credits" type="number" step="0.5" min="0" value="${escapeHtml(course?.credits ?? '3.0')}"></div>
    `,
    `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-primary" type="button" onclick="saveCourse(${course?.id || 'null'})">${isEdit ? '保存修改' : '创建课程'}</button>`
  );
}

async function saveCourse(courseId) {
  const payload = {
    course_code: $('modal-course-code').value.trim(),
    course_name: $('modal-course-name').value.trim(),
    teacher: $('modal-course-teacher').value.trim(),
    credits: Number($('modal-course-credits').value),
  };
  if (!payload.course_code || !payload.course_name || Number.isNaN(payload.credits)) {
    showToast('课程代码、名称和学分不能为空', 'error');
    return;
  }

  try {
    if (courseId) {
      await fetchJson(`/api/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('课程已更新');
    } else {
      await fetchJson('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast('课程已创建');
    }
    closeModal();
    await loadCourses();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function confirmCourseDelete(courseId, courseName) {
  openModal('删除课程', `<p>确定删除课程 <strong>${courseName}</strong> 吗？关联成绩也会被一并删除。</p>`, `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-danger" type="button" onclick="deleteCourse(${courseId})">确认删除</button>`);
}

async function deleteCourse(courseId) {
  try {
    await fetchJson(`/api/courses/${courseId}`, { method: 'DELETE' });
    closeModal();
    showToast('课程已删除');
    await loadCourses();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function openGradeModal(gradeId = null) {
  const grade = gradeId ? state.grades.find((item) => item.id === Number(gradeId)) : null;
  const isEdit = Boolean(grade);
  const studentOptions = state.students.map((student) => `<option value="${student.id}" ${grade && Number(grade.student_id) === Number(student.id) ? 'selected' : ''}>${escapeHtml(student.name)} (${escapeHtml(student.student_no)})</option>`).join('');
  const courseOptions = state.courses.map((course) => `<option value="${course.id}" ${grade && Number(grade.course_id) === Number(course.id) ? 'selected' : ''}>${escapeHtml(course.course_name)} (${escapeHtml(course.course_code)})</option>`).join('');

  openModal(
    isEdit ? '修改成绩' : '录入成绩',
    `
      <div class="field"><label for="modal-grade-student">学生</label><select id="modal-grade-student" ${isEdit ? 'disabled' : ''}>${studentOptions}</select></div>
      <div class="field"><label for="modal-grade-course">课程</label><select id="modal-grade-course" ${isEdit ? 'disabled' : ''}>${courseOptions}</select></div>
      <div class="field"><label for="modal-grade-score">分数</label><input id="modal-grade-score" type="number" min="0" max="100" step="0.1" value="${escapeHtml(grade?.score ?? '')}"></div>
      <p class="muted-note">提交后由数据库触发器自动计算绩点，前端只回显数据库结果。</p>
    `,
    `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-primary" type="button" onclick="saveGrade(${grade?.id || 'null'})">${isEdit ? '保存修改' : '录入成绩'}</button>`
  );
}

async function saveGrade(gradeId) {
  const score = Number($('modal-grade-score').value);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    showToast('分数必须在 0 到 100 之间', 'error');
    return;
  }

  try {
    if (gradeId) {
      const response = await fetchJson(`/api/grades/${gradeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      showToast(`成绩已更新，最新绩点 ${Number(response.data.grade_point || 0).toFixed(2)}`);
    } else {
      const response = await fetchJson('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: Number($('modal-grade-student').value),
          course_id: Number($('modal-grade-course').value),
          score,
        }),
      });
      showToast(`成绩已录入，绩点 ${Number(response.data.grade_point || 0).toFixed(2)}`);
    }
    closeModal();
    await loadGrades();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function confirmGradeDelete(gradeId) {
  openModal('删除成绩', '<p>确定删除这条成绩记录吗？操作会写入审计日志。</p>', `<button class="btn" type="button" onclick="closeModal()">取消</button><button class="btn btn-danger" type="button" onclick="deleteGrade(${gradeId})">确认删除</button>`);
}

async function deleteGrade(gradeId) {
  try {
    await fetchJson(`/api/grades/${gradeId}`, { method: 'DELETE' });
    closeModal();
    showToast('成绩记录已删除');
    await loadGrades();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function gotoStudentPage(page) {
  state.studentPage = page;
  renderStudents();
}

function gotoGradePage(page) {
  state.gradePage = page;
  renderGrades();
}

function gotoGpaPage(page) {
  state.gpaPage = page;
  renderGpa();
}

function bindEvents() {
  window.openStudentModal = openStudentModal;
  window.saveStudent = saveStudent;
  window.confirmStudentDelete = confirmStudentDelete;
  window.deleteStudent = deleteStudent;
  window.confirmBatchDeleteStudents = confirmBatchDeleteStudents;
  window.openTranscriptFromStudent = openTranscriptFromStudent;
  window.openTranscriptFromSearch = openTranscriptFromSearch;
  window.openCourseModal = openCourseModal;
  window.saveCourse = saveCourse;
  window.confirmCourseDelete = confirmCourseDelete;
  window.deleteCourse = deleteCourse;
  window.openAnalysisFromCourse = openAnalysisFromCourse;
  window.openGradeModal = openGradeModal;
  window.saveGrade = saveGrade;
  window.confirmGradeDelete = confirmGradeDelete;
  window.deleteGrade = deleteGrade;
  window.gotoStudentPage = gotoStudentPage;
  window.gotoGradePage = gotoGradePage;
  window.gotoGpaPage = gotoGpaPage;
  window.locateStudent = locateStudent;
  window.closeModal = closeModal;

  $('auth-admin-button')?.addEventListener('click', () => {
    startSession('admin').catch((error) => showToast(error.message, 'error'));
  });
  $('auth-student-button')?.addEventListener('click', () => {
    const studentId = Number($('auth-student-select')?.value);
    startSession('student', studentId).catch((error) => showToast(error.message, 'error'));
  });
  $('role-switch')?.addEventListener('click', resetSession);
  [
    ['dashboard-open-grades', 'grades'],
    ['dashboard-open-transcript', 'transcript'],
    ['entry-students', 'students'],
    ['entry-grades', 'grades'],
    ['entry-transcript', 'transcript'],
    ['entry-analysis', 'analysis'],
    ['entry-database', 'database'],
    ['entry-logs', 'logs'],
  ].forEach(([id, page]) => {
    $(id)?.addEventListener('click', () => {
      navigate(page).catch((error) => {
        console.error(error);
        showToast(error.message, 'error');
      });
    });
  });

  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      navigate(button.dataset.page).catch((error) => {
        console.error(error);
        showToast(error.message, 'error');
      });
    });
  });

  $('theme-toggle').addEventListener('click', () => {
    setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  $('sidebar-toggle').addEventListener('click', () => {
    setSidebarOpen(!document.body.classList.contains('sidebar-open'));
  });
  $('sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));
  $('modal-close').addEventListener('click', closeModal);
  $('modal-mask').addEventListener('click', (event) => {
    if (event.target === $('modal-mask')) {
      closeModal();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if ($('modal-mask').classList.contains('open')) {
        closeModal();
      } else if (document.body.classList.contains('sidebar-open')) {
        setSidebarOpen(false);
      }
    }

    if ($('modal-mask').classList.contains('open') && event.key === 'Tab') {
      const focusable = getFocusableNodes(document.querySelector('.modal'));
      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  $('global-search').addEventListener('input', (event) => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => handleGlobalSearch(event.target.value), 220);
  });
  $('global-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const firstButton = $('search-results').querySelector('button');
      if (firstButton) {
        event.preventDefault();
        firstButton.click();
      } else {
        event.preventDefault();
        triggerGlobalSearch();
      }
    }
  });
  document.querySelector('.search-submit')?.addEventListener('click', triggerGlobalSearch);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-wrap')) {
      $('search-results').classList.remove('show');
    }
  });

  $('student-filter-no').addEventListener('input', () => { state.studentPage = 1; renderStudents(); });
  $('student-filter-name').addEventListener('input', () => { state.studentPage = 1; renderStudents(); });
  $('student-filter-major').addEventListener('change', () => { state.studentPage = 1; renderStudents(); });
  $('student-filter-status').addEventListener('change', () => { state.studentPage = 1; renderStudents(); });
  $('student-reset').addEventListener('click', () => {
    $('student-filter-no').value = '';
    $('student-filter-name').value = '';
    $('student-filter-major').value = '';
    $('student-filter-status').value = '';
    state.studentPage = 1;
    renderStudents();
  });
  $('student-create').addEventListener('click', () => openStudentModal());
  $('student-batch-delete').addEventListener('click', batchDeleteStudents);
  $('student-export').addEventListener('click', () => downloadFile('/api/export/students.csv'));
  $('student-check-all').addEventListener('change', (event) => {
    document.querySelectorAll('.student-check').forEach((checkbox) => {
      checkbox.checked = event.target.checked;
    });
  });

  $('course-filter-code').addEventListener('input', renderCourses);
  $('course-filter-name').addEventListener('input', renderCourses);
  $('course-reset').addEventListener('click', () => {
    $('course-filter-code').value = '';
    $('course-filter-name').value = '';
    renderCourses();
  });
  $('course-create').addEventListener('click', () => openCourseModal());

  $('grade-filter-name').addEventListener('input', () => { state.gradePage = 1; renderGrades(); });
  $('grade-filter-course').addEventListener('input', () => { state.gradePage = 1; renderGrades(); });
  $('grade-filter-status').addEventListener('change', () => { state.gradePage = 1; renderGrades(); });
  $('grade-reset').addEventListener('click', () => {
    $('grade-filter-name').value = '';
    $('grade-filter-course').value = '';
    $('grade-filter-status').value = '';
    state.gradePage = 1;
    renderGrades();
  });
  $('grade-create').addEventListener('click', () => openGradeModal());
  $('grade-export').addEventListener('click', () => downloadFile('/api/export/grades.csv'));

  $('transcript-load').addEventListener('click', () => loadTranscript().catch((error) => showToast(error.message, 'error')));
  $('analysis-load').addEventListener('click', () => loadAnalysis().catch((error) => showToast(error.message, 'error')));

  window.addEventListener('resize', () => {
    if (window.innerWidth > 960) {
      setSidebarOpen(false);
    }
    Object.values(state.charts).forEach((chart) => chart.resize());
  });
}

async function init() {
  injectIcons();
  setSidebarOpen(false);
  const storedTheme = localStorage.getItem('grade-theme');
  setTheme(storedTheme === 'dark' ? 'dark' : 'light');
  bindEvents();
  try {
    await loadSessionOptions();
  } catch (error) {
    const select = $('auth-student-select');
    if (select) {
      select.innerHTML = '<option value="">学生列表加载失败</option>';
    }
    showToast('学生列表加载失败', 'error');
  }
  state.session = getStoredSession();
  applyRoleAccess();

  if (state.session) {
    setAuthScreenVisible(false);
    await navigate(getDefaultPageForRole(state.session.role));
  } else {
    setAuthScreenVisible(true);
  }
}

init().catch((error) => {
  console.error(error);
  showToast(error.message || '初始化失败', 'error');
});
