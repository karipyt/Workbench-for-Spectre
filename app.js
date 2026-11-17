/* =========================================================================
   SPECTRE Engineering Portal — app.js
   Vanilla JS single-page app. No build step, no backend.

   Data layer:
     • If a Firebase config is pasted below → Firestore (live sync for all
       members) + Firebase Storage (file uploads).
     • Otherwise → browser localStorage (works instantly for testing; data
       stays in that one browser only).

   Sections:
     1. Configuration           6. Overview view
     2. Static project data     7. Teams view (notes, gallery, repository)
     3. Utilities               8. Task board view
     4. Data store (Firebase / localStorage)   9. Calendar view
     5. App state, routing     10. Modals, events & bootstrap
   ========================================================================= */
'use strict';

/* =========================================================================
   1. CONFIGURATION
   ========================================================================= */

// PASTE YOUR FIREBASE CONFIG HERE
// Firebase console → Project settings → General → "Your apps" → Web app → SDK setup (Config).
// While apiKey still contains "PASTE", the app runs in local (browser-only) mode.
const firebaseConfig = {
  apiKey: 'PASTE_YOUR_API_KEY_HERE',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project-id.firebasestorage.app',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000'
};

// Sign every visitor in anonymously so security rules can require `request.auth != null`.
// Requires Firebase console → Authentication → Sign-in method → Anonymous → Enable.
const USE_ANONYMOUS_AUTH = true;

const MAX_LOCAL_FILE_MB = 3;    // localStorage holds ~5 MB total per site, so keep local files small
const MAX_CLOUD_FILE_MB = 100;  // keep in sync with storage.rules
const LS_PREFIX = 'spectre:v1:';

/* =========================================================================
   2. STATIC PROJECT DATA
   ========================================================================= */

const TEAMS = [
  {
    id: 'systems', code: 'WS1', name: 'Systems / Validation', short: 'Systems / V&V',
    lead: 'Richa Kamath', color: '#2f6bff',
    summary: 'Requirements, station convention, turbine-cycle model, ramjet performance, independent V&V & evidence matrix.',
    focus: ['Requirements', 'Station convention', 'Turbine-cycle model', 'Ramjet performance', 'Independent V&V', 'Evidence matrix'],
    placeholders: ['Station numbering diagram', 'Cycle performance map', 'Evidence matrix snapshot']
  },
  {
    id: 'cfd', code: 'WS2', name: 'High-Speed Aerothermodynamics (CFD)', short: 'Aerothermo / CFD',
    lead: 'Richa Kamath', color: '#0d9488',
    summary: 'Inlet, transition/flow split, ramjet duct/nozzle, analytical benchmarks, HPC & CFD validation.',
    focus: ['Inlet', 'Transition / flow split', 'Ramjet duct & nozzle', 'Analytical benchmarks', 'HPC', 'CFD validation'],
    placeholders: ['Inlet Mach contours', 'Mesh independence study', 'Nozzle flow field']
  },
  {
    id: 'structures', code: 'WS3', name: 'Turbomachinery, CAD & Structures', short: 'Turbo, CAD & Structures',
    lead: 'Jack Bohills', color: '#7c3aed',
    summary: 'Master CAD, turbine aero, thermal/FEA/topology, LS-DYNA transient-load response.',
    focus: ['Master CAD', 'Turbine aero', 'Thermal / FEA', 'Topology optimisation', 'LS-DYNA transient loads'],
    placeholders: ['Master CAD assembly render', 'FEA stress plot', 'LS-DYNA transient response']
  },
  {
    id: 'controls', code: 'WS4', name: 'Controls, Electronics & Demonstrator', short: 'Controls & Demonstrator',
    lead: 'Jack Bohills', color: '#ea580c',
    summary: 'Engine-control logic, reduced-order model, sensors/PCB, SIL/HIL evidence, cold moving demonstrator.',
    focus: ['Engine-control logic', 'Reduced-order model', 'Sensors & PCB', 'SIL / HIL evidence', 'Cold moving demonstrator'],
    placeholders: ['Control architecture', 'PCB layout', 'Cold demonstrator rig']
  }
];
const TEAM_BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]));
const LEADS = ['Jack Bohills', 'Richa Kamath'];

const OVERVIEW_PLACEHOLDERS = [
  'Hero CAD render — full engine assembly',
  'Inlet spike CFD contours',
  'Turbine stage render',
  'Ramjet duct & nozzle section',
  '3D printed demonstrator',
  'Controls / test rig photo'
];

const STATUSES = [
  { id: 'todo',       label: 'To Do',       color: '#94a3b8' },
  { id: 'inprogress', label: 'In Progress', color: '#2f6bff' },
  { id: 'review',     label: 'In Review',   color: '#f59e0b' },
  { id: 'done',       label: 'Done',        color: '#16a34a' }
];

const EVENT_TYPES = {
  milestone: { label: 'Milestone', color: '#e11d48' },
  review:    { label: 'Review',    color: '#7c3aed' },
  deadline:  { label: 'Deadline',  color: '#ea580c' },
  meeting:   { label: 'Meeting',   color: '#2f6bff' }
};

// File categories for the repository badges and filter chips
const FILE_CATS = [
  { id: 'docs',    label: 'Documents',  color: '#dc2626', ext: ['pdf', 'doc', 'docx', 'odt', 'txt', 'md', 'tex', 'ppt', 'pptx', 'rtf'] },
  { id: 'cad',     label: 'CAD',        color: '#7c3aed', ext: ['step', 'stp', 'iges', 'igs', 'sldprt', 'sldasm', 'slddrw', 'stl', 'x_t', 'x_b', 'f3d', 'f3z', 'ipt', 'iam', 'catpart', 'catproduct', '3mf', 'obj', 'dxf', 'dwg'] },
  { id: 'sim',     label: 'Simulation', color: '#0d9488', ext: ['cas', 'dat', 'h5', 'msh', 'mesh', 'cdb', 'k', 'key', 'd3plot', 'wbpj', 'wbpz', 'mechdat', 'agdb', 'scdoc', 'rst', 'res', 'out', 'jou', 'cgns'] },
  { id: 'data',    label: 'Data & Code', color: '#16a34a', ext: ['xlsx', 'xls', 'csv', 'json', 'mat', 'm', 'py', 'ipynb', 'c', 'cpp', 'h', 'ino', 'slx', 'mdl', 'kicad_pcb', 'sch', 'brd', 'gbr'] },
  { id: 'media',   label: 'Media',      color: '#db2777', ext: ['mp4', 'mov', 'avi', 'webm', 'mkv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff'] },
  { id: 'archive', label: 'Archives',   color: '#475569', ext: ['zip', '7z', 'rar', 'tar', 'gz', 'tgz'] }
];

// Seed data — written once on first load (per browser in local mode, once per project in Firebase).
// Dates are indicative: edit them in the Calendar once confirmed.
const SEED_EVENTS = [
  { title: 'Project kick-off & workstream allocation', date: '2026-11-25', time: '18:00', type: 'meeting', team: 'all', owner: 'Jack Bohills', description: 'All-hands: brief walkthrough, workstream sign-up, tooling access (Ansys, HPC, CAD vault).' },
  { title: 'SRR — System Requirements Review', date: '2026-12-09', time: '14:00', type: 'milestone', team: 'all', owner: 'Richa Kamath', description: 'Agree requirements, operating envelope and station convention. Indicative date — edit to confirm.' },
  { title: 'PDR — Preliminary Design Review', date: '2027-02-10', time: '14:00', type: 'milestone', team: 'all', owner: 'Jack Bohills', description: 'Baseline concept, first cycle model and analysis-ready geometry release. Indicative date — edit to confirm.' },
  { title: 'CDR — Critical Design Review', date: '2027-03-24', time: '14:00', type: 'milestone', team: 'all', owner: 'Richa Kamath', description: 'V&V evidence for CFD, thermal/structural and transient work packages; demonstrator design frozen. Indicative date — edit to confirm.' },
  { title: 'Final Proposal & Handover', date: '2027-05-05', time: '12:00', type: 'milestone', team: 'all', owner: 'Jack Bohills', description: 'Final proposal, evidence matrix and handover pack for the next cohort (early May 2027).' }
];
const SEED_TASKS = [
  { title: 'Draft top-level requirements & operating envelope', assignee: 'Richa Kamath', team: 'systems', priority: 'High', due: '2026-12-02', status: 'inprogress', description: 'Input to SRR.' },
  { title: 'Agree station numbering convention', assignee: 'Richa Kamath', team: 'systems', priority: 'Medium', due: '2026-12-04', status: 'todo', description: '' },
  { title: 'Set up inlet CFD case & mesh independence plan', assignee: 'Richa Kamath', team: 'cfd', priority: 'Medium', due: '2026-12-16', status: 'todo', description: '' },
  { title: 'Release master CAD skeleton v0.1', assignee: 'Jack Bohills', team: 'structures', priority: 'High', due: '2026-12-11', status: 'todo', description: 'Parametric top-down skeleton with interface planes.' },
  { title: 'Draft engine-control state machine', assignee: 'Jack Bohills', team: 'controls', priority: 'Low', due: '2027-01-15', status: 'todo', description: '' }
];

/* =========================================================================
   3. UTILITIES
   ========================================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape user content before inserting as HTML (prevents XSS). */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = n => String(n).padStart(2, '0');

const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => dateKey(new Date());
const daysUntil = k => Math.round((parseDate(k) - parseDate(todayKey())) / 86400000);
const fmtDate = (k, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (k ? parseDate(k).toLocaleDateString('en-GB', opts) : '');

function relDays(k) {
  const n = daysUntil(k);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtSize(b) {
  if (!b && b !== 0) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
}

const initials = name => (name || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';

/** Only allow http(s) links from user input. */
function safeUrl(u) {
  try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : null; }
  catch { return null; }
}

function youtubeId(u) {
  const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const fileExt = name => (String(name || '').split('.').pop() || '').toLowerCase();
const fileCat = name => FILE_CATS.find(c => c.ext.includes(fileExt(name)));

/** Read/write tiny per-browser preferences safely. */
const pref = {
  get(k, d = null) { try { return localStorage.getItem(LS_PREFIX + 'pref:' + k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(LS_PREFIX + 'pref:' + k, v); } catch { /* storage unavailable */ } }
};

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.classList.add('out'), type === 'error' ? 5500 : 3000);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

/* Minimal inline SVG icons */
const ICONS = {
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  download: '<path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

/* =========================================================================
   4. DATA STORE — Firebase (Firestore + Storage) with localStorage fallback
   Every view talks only to this API:
     Store.subscribe(col, cb) · add(col, data) · save(col, id, patch)
     remove(col, id) · upload(file, folder, onProgress) · removeFile(path)
   Collections: tasks, events, files, notes
   ========================================================================= */

const Store = (() => {
  const COLLECTIONS = ['tasks', 'events', 'files', 'notes'];
  let mode = 'local';
  let db = null;
  let storage = null;
  const subs = {};

  const firebaseReady = () =>
    typeof firebase !== 'undefined' && firebaseConfig.apiKey && !/PASTE/i.test(firebaseConfig.apiKey);

  /* ---- localStorage helpers ---- */
  const lsRead = col => {
    try { return JSON.parse(localStorage.getItem(LS_PREFIX + col)) || []; } catch { return []; }
  };
  const lsWrite = (col, arr) => {
    try { localStorage.setItem(LS_PREFIX + col, JSON.stringify(arr)); }
    catch { throw new Error('Browser storage is full — connect Firebase, or delete some locally stored files.'); }
    emit(col);
  };
  const emit = col => (subs[col] || new Set()).forEach(cb => cb(lsRead(col)));

  async function init() {
    if (firebaseReady()) {
      try {
        firebase.initializeApp(firebaseConfig);
        if (USE_ANONYMOUS_AUTH && firebase.auth) {
          try { await firebase.auth().signInAnonymously(); }
          catch (e) { console.warn('Anonymous sign-in failed — enable it in Firebase → Authentication → Sign-in method.', e); }
        }
        db = firebase.firestore();
        try { storage = firebase.storage ? firebase.storage() : null; } catch { storage = null; }
        mode = 'firebase';
        await seedFirebase().catch(e => console.warn('Seeding skipped:', e));
        return mode;
      } catch (e) {
        console.error('Firebase init failed — falling back to localStorage.', e);
        mode = 'local'; db = null; storage = null;
      }
    }
    seedLocal();
    // Keep multiple tabs of the same browser in sync
    window.addEventListener('storage', e => {
      if (e.key && e.key.startsWith(LS_PREFIX)) COLLECTIONS.forEach(emit);
    });
    return mode;
  }

  /* ---- seeding (runs once) ---- */
  function seedLocal() {
    try {
      if (localStorage.getItem(LS_PREFIX + 'seeded')) return;
      const now = Date.now();
      localStorage.setItem(LS_PREFIX + 'events', JSON.stringify(SEED_EVENTS.map(e => ({ id: uid(), ...e, createdAt: now }))));
      localStorage.setItem(LS_PREFIX + 'tasks', JSON.stringify(SEED_TASKS.map(t => ({ id: uid(), ...t, createdAt: now }))));
      localStorage.setItem(LS_PREFIX + 'seeded', '1');
    } catch { /* storage unavailable (private mode) — app still runs in-memory-less */ }
  }

  async function seedFirebase() {
    const flag = db.collection('meta').doc('seed');
    await db.runTransaction(async tx => {
      const snap = await tx.get(flag);
      if (snap.exists) return;
      const now = Date.now();
      tx.set(flag, { seededAt: now });
      SEED_EVENTS.forEach(e => tx.set(db.collection('events').doc(), { ...e, createdAt: now }));
      SEED_TASKS.forEach(t => tx.set(db.collection('tasks').doc(), { ...t, createdAt: now }));
    });
  }

  /* ---- CRUD ---- */
  function subscribe(col, cb, onError) {
    if (mode === 'firebase') {
      return db.collection(col).onSnapshot(
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        err => { console.error(`[${col}]`, err); onError && onError(err); }
      );
    }
    (subs[col] ||= new Set()).add(cb);
    cb(lsRead(col));
    return () => subs[col].delete(cb);
  }

  async function add(col, data) {
    const doc = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
    if (mode === 'firebase') return (await db.collection(col).add(doc)).id;
    const id = uid();
    lsWrite(col, [...lsRead(col), { id, ...doc }]);
    return id;
  }

  /** Create-or-merge a document with a known id. */
  async function save(col, id, patch) {
    const data = { ...patch, updatedAt: Date.now() };
    if (mode === 'firebase') return db.collection(col).doc(id).set(data, { merge: true });
    const arr = lsRead(col);
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr[i] = { ...arr[i], ...data };
    else arr.push({ id, createdAt: Date.now(), ...data });
    lsWrite(col, arr);
  }

  async function remove(col, id) {
    if (mode === 'firebase') return db.collection(col).doc(id).delete();
    lsWrite(col, lsRead(col).filter(x => x.id !== id));
  }

  /** Upload a file. Resolves { url, storagePath }. */
  function upload(file, folder, onProgress) {
    if (mode === 'firebase') {
      if (!storage) return Promise.reject(new Error('Firebase Storage is not enabled — use "Add link" instead.'));
      if (file.size > MAX_CLOUD_FILE_MB * 1048576) return Promise.reject(new Error(`File is larger than ${MAX_CLOUD_FILE_MB} MB. Share it as a link instead.`));
      const path = `${folder}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const ref = storage.ref().child(path);
      return new Promise((resolve, reject) => {
        const task = ref.put(file, { contentType: file.type || 'application/octet-stream' });
        task.on('state_changed',
          s => onProgress && onProgress(s.bytesTransferred / s.totalBytes),
          err => reject(new Error(err.code === 'storage/unauthorized'
            ? 'Upload blocked by Storage rules (check storage.rules / sign-in).'
            : `Upload failed: ${err.message}`)),
          () => task.snapshot.ref.getDownloadURL().then(url => resolve({ url, storagePath: path }), reject));
      });
    }
    if (file.size > MAX_LOCAL_FILE_MB * 1048576) {
      return Promise.reject(new Error(`Local demo mode keeps files in this browser (max ${MAX_LOCAL_FILE_MB} MB). Connect Firebase for larger files, or add a link.`));
    }
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
      r.onload = () => resolve({ url: r.result, storagePath: null });
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  async function removeFile(path) {
    if (mode === 'firebase' && storage && path) {
      try { await storage.ref().child(path).delete(); } catch (e) { console.warn('Storage delete failed', e); }
    }
  }

  return { init, subscribe, add, save, remove, upload, removeFile, get mode() { return mode; } };
})();

/* =========================================================================
   5. APP STATE & ROUTING
   ========================================================================= */

const state = {
  ready: { tasks: false, events: false, files: false, notes: false },
  tasks: [], events: [], files: [], notes: [],
  view: 'overview',
  team: TEAMS[0].id,
  editingNotes: null,
  repoCat: 'all',
  repoQuery: '',
  filters: { q: '', team: '', member: '', priority: '' },
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  me: pref.get('me', '')
};

const VIEWS = ['overview', 'teams', 'tasks', 'calendar'];

/** Hash routes: #overview · #teams/<teamId> · #tasks · #calendar */
function route() {
  const [view, sub] = (location.hash.slice(1) || 'overview').split('/');
  state.view = VIEWS.includes(view) ? view : 'overview';
  if (state.view === 'teams' && sub && TEAM_BY_ID[sub] && sub !== state.team) {
    state.team = sub;
    state.editingNotes = null;
    state.repoCat = 'all';
  }
  $$('.view').forEach(v => { v.hidden = v.dataset.view !== state.view; });
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === state.view));
  closeMobileNav();
  renderView();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderView() {
  switch (state.view) {
    case 'overview': renderOverview(); break;
    case 'teams': renderTeams(); break;
    case 'tasks': renderBoard(); break;
    case 'calendar': renderCalendar(); break;
  }
}

/** Shared data has changed → refresh whatever is on screen + dependent widgets. */
function onData() {
  renderMemberLists();
  renderView();
}

/* =========================================================================
   6. OVERVIEW VIEW
   ========================================================================= */

function renderOverview() {
  renderMilestones();
  renderGallery('overview', $('#overview-gallery'), OVERVIEW_PLACEHOLDERS, 6);
  renderWorkstreamCards();
}

function renderMilestones() {
  const list = state.events
    .filter(e => e.type === 'milestone')
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const today = todayKey();
  const nextId = (list.find(e => e.date >= today) || {}).id;
  $('#milestone-timeline').innerHTML = list.length
    ? list.map(e => `
      <li class="${e.date < today ? 'past' : e.id === nextId ? 'next' : ''}">
        <span class="dot"></span>
        <div class="tl-body">
          <div class="tl-title">${esc(e.title)}</div>
          <div class="tl-date">${fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
        <span class="tl-count">${e.date < today ? 'Complete' : relDays(e.date)}</span>
      </li>`).join('')
    : `<li class="muted small">No milestones yet — add one in the Calendar with type "Milestone".</li>`;
}

function renderWorkstreamCards() {
  $('#ws-grid').innerHTML = TEAMS.map(t => {
    const open = state.tasks.filter(x => x.team === t.id && x.status !== 'done').length;
    const files = state.files.filter(f => f.team === t.id && f.kind !== 'image').length;
    return `
      <a class="card ws-card" href="#teams/${t.id}" style="--c:${t.color}">
        <span class="ws-code">${t.code}</span>
        <h3>${esc(t.name)}</h3>
        <p>${esc(t.summary)}</p>
        <span class="ws-lead"><span class="avatar" style="background:${t.color}">${initials(t.lead)}</span>Lead: ${esc(t.lead)}</span>
        <div class="ws-stats"><span><b>${open}</b>open tasks</span><span><b>${files}</b>files & links</span></div>
      </a>`;
  }).join('');
}

/* =========================================================================
   7. TEAMS VIEW — header, notes, stats, gallery, repository
   ========================================================================= */

function renderTeamNav() {
  // Sub-tabs on the Teams page
  $('#team-tabs').innerHTML = TEAMS.map(t => `
    <button class="subtab ${t.id === state.team ? 'active' : ''}" role="tab" aria-selected="${t.id === state.team}"
            data-action="team-tab" data-team="${t.id}" style="--c:${t.color}">
      <span class="sw"></span>${t.code} · ${esc(t.short)}
    </button>`).join('');
}

function renderTeams() {
  const t = TEAM_BY_ID[state.team];
  renderTeamNav();

  const header = $('#team-header');
  header.style.setProperty('--c', t.color);
  header.innerHTML = `
    <div class="th-main">
      <p class="eyebrow" style="color:${t.color}">${t.code} · Workstream</p>
      <h2>${esc(t.name)}</h2>
      <p class="muted" style="margin:0">${esc(t.summary)}</p>
      <div class="focus-tags">${t.focus.map(f => `<span class="focus-tag">${esc(f)}</span>`).join('')}</div>
    </div>
    <div class="th-lead">
      <span class="avatar">${initials(t.lead)}</span>
      <div><small>Workstream lead</small><strong>${esc(t.lead)}</strong></div>
    </div>`;

  renderTeamNotes();
  renderTeamStats();
  renderGallery(t.id, $('#team-gallery'), t.placeholders, 3);
  renderRepository();
}

function defaultNotes(t) {
  return [
    '# Scope',
    t.summary,
    '# Key focus areas',
    ...t.focus.map(f => `- ${f}`),
    '# Interfaces & dependencies',
    '- Inputs needed from other workstreams…',
    '- Outputs / releases provided to others…',
    '# Open questions & risks',
    '- …'
  ].join('\n');
}

/** Lightweight formatting: "# heading", "- bullet", **bold**. Input is escaped first. */
function formatNotes(text) {
  const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  let html = '';
  let inList = false;
  for (const raw of esc(text).split('\n')) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (/^#{1,3}\s+/.test(line)) html += `<h4>${inline(line.replace(/^#+\s+/, ''))}</h4>`;
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

function renderTeamNotes() {
  const t = TEAM_BY_ID[state.team];
  const el = $('#team-notes');
  if (state.editingNotes === t.id) return; // never clobber an open editor with live updates
  const note = state.notes.find(n => n.id === t.id);
  const text = note && typeof note.text === 'string' ? note.text : defaultNotes(t);
  el.innerHTML = `
    <div class="card-head">
      <h2 class="card-title">Scope &amp; Notes</h2>
      <button class="btn btn-outline btn-sm" data-action="notes-edit">${icon('edit')} Edit</button>
    </div>
    <div class="notes-body">${formatNotes(text)}</div>
    <p class="muted small" style="margin-top:12px">${note
      ? `Last edited${note.editedBy ? ` by ${esc(note.editedBy)}` : ''} · ${timeAgo(note.updatedAt)}`
      : 'Default scope — click Edit to customise. Use "# " for headings, "- " for bullets, **bold**.'}</p>`;
}

function openNotesEditor() {
  const t = TEAM_BY_ID[state.team];
  const note = state.notes.find(n => n.id === t.id);
  state.editingNotes = t.id;
  $('#team-notes').innerHTML = `
    <div class="card-head"><h2 class="card-title">Editing Scope &amp; Notes</h2></div>
    <div class="notes-editor">
      <textarea class="input" id="notes-text" maxlength="20000"></textarea>
      <div class="notes-actions">
        <span class="muted small spacer">Supports "# heading", "- bullet", **bold**</span>
        <button class="btn btn-ghost btn-sm" data-action="notes-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" data-action="notes-save">Save notes</button>
      </div>
    </div>`;
  const ta = $('#notes-text');
  ta.value = note && typeof note.text === 'string' ? note.text : defaultNotes(t);
  ta.focus();
}

async function saveNotes() {
  const teamId = state.editingNotes;
  const text = $('#notes-text').value;
  try {
    await Store.save('notes', teamId, { text, editedBy: state.me || '' });
    state.editingNotes = null;
    renderTeamNotes();
    toast('Notes saved', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function renderTeamStats() {
  const t = TEAM_BY_ID[state.team];
  const tasks = state.tasks.filter(x => x.team === t.id);
  const total = tasks.length || 1;
  const counts = STATUSES.map(s => ({ ...s, n: tasks.filter(x => x.status === s.id).length }));
  const overdue = tasks.filter(x => x.due && x.status !== 'done' && x.due < todayKey()).length;
  const files = state.files.filter(f => f.team === t.id && f.kind !== 'image').length;
  const next = state.events
    .filter(e => (e.team === t.id || e.team === 'all') && e.date >= todayKey())
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))[0];

  $('#team-stats').innerHTML = `
    <div class="card-head">
      <h2 class="card-title">At a glance</h2>
      <button class="linklike link-sm" data-action="team-tasks" data-team="${t.id}">View tasks →</button>
    </div>
    <div class="bar" title="Task status breakdown">
      ${counts.map(c => `<span style="width:${(c.n / total) * 100}%;background:${c.color}"></span>`).join('')}
    </div>
    <ul class="stat-list">
      ${counts.map(c => `<li><span><span class="sw" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color};margin-right:8px"></span>${c.label}</span><b>${c.n}</b></li>`).join('')}
      <li><span>Overdue</span><b style="color:${overdue ? 'var(--danger)' : 'inherit'}">${overdue}</b></li>
      <li><span>Files &amp; links</span><b>${files}</b></li>
    </ul>
    ${next ? `<div class="next-event"><small>Next on the calendar</small><strong>${esc(next.title)}</strong><br>
      <span class="muted">${fmtDate(next.date, { weekday: 'short', day: 'numeric', month: 'short' })}${next.time ? ' · ' + esc(next.time) : ''} · ${relDays(next.date)}</span></div>` : ''}`;
}

/* ---------- Gallery (used by Overview and each team) ---------- */
function renderGallery(teamId, container, placeholders, minSlots) {
  const imgs = state.files
    .filter(f => f.team === teamId && f.kind === 'image')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const empty = Math.max(0, minSlots - imgs.length);
  const usedTitles = new Set(imgs.map(i => i.title));
  const ph = placeholders.filter(p => !usedTitles.has(p)).slice(0, empty);
  while (ph.length < empty) ph.push('Add an image');

  container.innerHTML =
    imgs.map(f => `
      <figure class="g-item" data-action="lightbox" data-id="${esc(f.id)}" tabindex="0">
        <img src="${esc(f.url)}" alt="${esc(f.title)}" loading="lazy" />
        <figcaption>${esc(f.title)}</figcaption>
        <button class="icon-btn g-del" data-action="file-delete" data-id="${esc(f.id)}" title="Remove image">${icon('trash')}</button>
      </figure>`).join('') +
    ph.map(p => `
      <button class="g-item g-placeholder" data-action="add-image" data-team="${teamId}" data-title="${esc(p === 'Add an image' ? '' : p)}">
        ${icon('image')}
        <strong>${esc(p)}</strong>
        <small>Click to upload</small>
      </button>`).join('');
}

/* ---------- File & link repository ---------- */
function repoItemCat(f) {
  if (f.kind === 'link') return 'links';
  const c = fileCat(f.fileName || f.title);
  return c ? c.id : 'other';
}

function renderRepository() {
  const teamFiles = state.files.filter(f => f.team === state.team && f.kind !== 'image');
  const cats = [{ id: 'all', label: 'All' }, ...FILE_CATS, { id: 'links', label: 'Links & Videos' }, { id: 'other', label: 'Other' }];
  $('#repo-filters').innerHTML = cats.map(c => {
    const n = c.id === 'all' ? teamFiles.length : teamFiles.filter(f => repoItemCat(f) === c.id).length;
    if (!n && c.id !== 'all' && c.id !== state.repoCat) return '';
    return `<button class="chip ${state.repoCat === c.id ? 'active' : ''}" data-action="repo-cat" data-cat="${c.id}">${c.label}<span class="count">${n}</span></button>`;
  }).join('');

  const q = state.repoQuery.toLowerCase();
  const items = teamFiles
    .filter(f => state.repoCat === 'all' || repoItemCat(f) === state.repoCat)
    .filter(f => !q || [f.title, f.description, f.fileName, f.addedBy].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  $('#repo-list').innerHTML = items.length ? items.map(repoItem).join('') : `
    <li class="empty">${teamFiles.length ? 'No files match this filter.' : 'No files yet — upload reports, CAD (STEP), case files (CAS), spreadsheets, videos or zips, or paste a link.'}</li>`;
}

function repoItem(f) {
  const isLink = f.kind === 'link';
  const yt = isLink ? youtubeId(f.url) : null;
  const ext = isLink ? 'LINK' : (fileExt(f.fileName || f.title) || 'FILE').slice(0, 5).toUpperCase();
  const cat = isLink ? null : fileCat(f.fileName || f.title);
  const color = isLink ? '#2f6bff' : cat ? cat.color : '#64708a';
  const playable = yt || (!isLink && /^video\//.test(f.mime || '')) || (!isLink && /^image\//.test(f.mime || ''));
  const host = isLink ? (() => { try { return new URL(f.url).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '';

  const lead = yt
    ? `<button class="yt-thumb" data-action="lightbox" data-id="${esc(f.id)}" aria-label="Play video"><img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="" loading="lazy" /></button>`
    : `<div class="file-badge" style="--c:${color}">${esc(ext)}</div>`;

  const openAttrs = isLink
    ? `href="${esc(f.url)}" target="_blank" rel="noopener noreferrer"`
    : `href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" download="${esc(f.fileName || f.title)}"`;

  return `
    <li class="repo-item">
      ${lead}
      <div class="repo-info">
        <a class="repo-title" ${openAttrs} title="${esc(f.title)}">${esc(f.title)}</a>
        ${f.description ? `<p class="repo-desc">${esc(f.description)}</p>` : ''}
        <div class="repo-meta">
          ${isLink ? `<span>${esc(host)}</span>` : `<span>${esc(f.fileName || '')}</span><span>${fmtSize(f.size)}</span>`}
          ${f.addedBy ? `<span>Added by ${esc(f.addedBy)}</span>` : ''}
          <span>${timeAgo(f.createdAt)}</span>
        </div>
      </div>
      <div class="repo-actions">
        ${playable ? `<button class="icon-btn" data-action="lightbox" data-id="${esc(f.id)}" title="Preview">${icon('play')}</button>` : ''}
        <a class="icon-btn" ${openAttrs} title="${isLink ? 'Open link' : 'Download'}">${icon(isLink ? 'external' : 'download')}</a>
        <button class="icon-btn danger" data-action="file-delete" data-id="${esc(f.id)}" title="Delete">${icon('trash')}</button>
      </div>
    </li>`;
}

async function deleteFile(id) {
  const f = state.files.find(x => x.id === id);
  if (!f) return;
  if (!confirm(`Delete "${f.title}"? This removes it for everyone.`)) return;
  try {
    await Store.remove('files', id);
    await Store.removeFile(f.storagePath);
    toast('Deleted', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* =========================================================================
   8. TASK BOARD VIEW
   ========================================================================= */

function filteredTasks() {
  const { q, team, member, priority } = state.filters;
  const ql = q.toLowerCase();
  return state.tasks.filter(t =>
    (!team || t.team === team) &&
    (!member || t.assignee === member) &&
    (!priority || t.priority === priority) &&
    (!ql || [t.title, t.description, t.assignee].some(v => String(v || '').toLowerCase().includes(ql))));
}

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

function renderBoard() {
  const tasks = filteredTasks();
  $('#board').innerHTML = STATUSES.map(s => {
    const col = tasks
      .filter(t => (t.status || 'todo') === s.id)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1) || String(a.due || '9999').localeCompare(String(b.due || '9999')));
    return `
      <section class="column" data-status="${s.id}">
        <div class="column-head"><span class="sw" style="background:${s.color}"></span><h3>${s.label}</h3><span class="count">${col.length}</span></div>
        ${col.length ? col.map(taskCard).join('') : '<div class="col-empty">Drop tasks here</div>'}
      </section>`;
  }).join('');
}

function taskCard(t) {
  const team = TEAM_BY_ID[t.team];
  const prio = PRIORITY_ORDER[t.priority] !== undefined ? t.priority : 'Medium';
  const d = t.due ? daysUntil(t.due) : null;
  const dueCls = t.status !== 'done' && d !== null ? (d < 0 ? 'overdue' : d <= 3 ? 'soon' : '') : '';
  return `
    <article class="task-card prio-${prio.toLowerCase()} ${t.status === 'done' ? 'is-done' : ''}" draggable="true" data-id="${esc(t.id)}">
      <div class="task-top">
        <span class="pill pill-${prio.toLowerCase()}">${prio}</span>
        ${team ? `<span class="team-chip" style="--c:${team.color}" title="${esc(team.name)}">${team.code} · ${esc(team.short)}</span>` : ''}
      </div>
      <h3 class="task-title">${esc(t.title)}</h3>
      ${t.description ? `<p class="task-desc">${esc(t.description)}</p>` : ''}
      <div class="task-meta">
        <span class="avatar">${esc(initials(t.assignee))}</span><span>${esc(t.assignee || 'Unassigned')}</span>
        ${t.due ? `<span class="due ${dueCls}" title="${d < 0 && t.status !== 'done' ? 'Overdue' : 'Due'}">${fmtDate(t.due, { day: 'numeric', month: 'short' })}</span>` : ''}
      </div>
      <div class="task-actions">
        <select class="input status-select" data-action="task-status" data-id="${esc(t.id)}" aria-label="Status">
          ${STATUSES.map(s => `<option value="${s.id}" ${s.id === (t.status || 'todo') ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
        <button class="icon-btn" data-action="task-edit" data-id="${esc(t.id)}" title="Edit">${icon('edit')}</button>
        <button class="icon-btn danger" data-action="task-delete" data-id="${esc(t.id)}" title="Delete">${icon('trash')}</button>
      </div>
    </article>`;
}

function openTaskModal(task = null, preset = {}) {
  $('#task-modal-title').textContent = task ? 'Edit Task' : 'Assign Task';
  $('#t-id').value = task ? task.id : '';
  $('#t-title').value = task ? task.title : '';
  $('#t-assignee').value = task ? task.assignee : '';
  $('#t-team').value = task ? task.team : (preset.team || state.filters.team || TEAMS[0].id);
  $('#t-priority').value = task ? task.priority : 'Medium';
  $('#t-due').value = task ? (task.due || '') : '';
  $('#t-status').value = task ? (task.status || 'todo') : 'todo';
  $('#t-desc').value = task ? (task.description || '') : '';
  $('#t-delete').hidden = !task;
  $('#task-modal').showModal();
  $('#t-title').focus();
}

async function submitTask(e) {
  e.preventDefault();
  const id = $('#t-id').value;
  const data = {
    title: $('#t-title').value.trim(),
    assignee: $('#t-assignee').value.trim(),
    team: $('#t-team').value,
    priority: $('#t-priority').value,
    due: $('#t-due').value,
    status: $('#t-status').value,
    description: $('#t-desc').value.trim()
  };
  if (!data.title || !data.assignee) return;
  try {
    if (id) await Store.save('tasks', id, data);
    else await Store.add('tasks', { ...data, createdBy: state.me || '' });
    $('#task-modal').close();
    toast(id ? 'Task updated' : `Task assigned to ${data.assignee}`, 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || !confirm(`Delete task "${t.title}"?`)) return false;
  try { await Store.remove('tasks', id); toast('Task deleted', 'success'); return true; }
  catch (e) { toast(e.message, 'error'); return false; }
}

async function setTaskStatus(id, status) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || t.status === status) return;
  try { await Store.save('tasks', id, { status }); }
  catch (e) { toast(e.message, 'error'); renderBoard(); }
}

/* =========================================================================
   9. CALENDAR VIEW
   ========================================================================= */

const sortEvents = list => list.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
const eventColor = e => (EVENT_TYPES[e.type] || EVENT_TYPES.meeting).color;

function renderCalendar() {
  const m = state.calMonth;
  $('#cal-title').textContent = m.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  $('#cal-legend').innerHTML = Object.values(EVENT_TYPES).map(t => `<span style="--c:${t.color}"><i></i>${t.label}</span>`).join('');

  // Group events by date
  const byDate = {};
  sortEvents([...state.events]).forEach(e => { (byDate[e.date] ||= []).push(e); });

  // Monday-first 6-week grid
  const offset = (m.getDay() + 6) % 7;
  const today = todayKey();
  let html = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(m.getFullYear(), m.getMonth(), 1 - offset + i);
    const key = dateKey(d);
    const evs = byDate[key] || [];
    const cls = [
      'cal-cell',
      d.getMonth() !== m.getMonth() ? 'other' : '',
      key === today ? 'today' : '',
      d.getDay() === 0 || d.getDay() === 6 ? 'weekend' : ''
    ].join(' ');
    html += `
      <div class="${cls}" data-action="cal-day" data-date="${key}" title="Add event on ${fmtDate(key)}">
        <span class="cal-day">${d.getDate()}</span>
        ${evs.slice(0, 3).map(e => `
          <button class="cal-ev ${e.type === 'milestone' ? 'milestone' : ''}" style="--c:${eventColor(e)}"
                  data-action="event-edit" data-id="${esc(e.id)}" title="${esc(e.title)}">
            ${e.time ? esc(e.time) + ' ' : ''}${esc(e.title)}
          </button>`).join('')}
        ${evs.length > 3 ? `<span class="cal-more">+${evs.length - 3} more</span>` : ''}
      </div>`;
  }
  $('#cal-grid').innerHTML = html;
  renderAgenda();
}

function renderAgenda() {
  const upcoming = sortEvents(state.events.filter(e => e.date >= todayKey())).slice(0, 20);
  let lastMonth = '';
  $('#agenda-list').innerHTML = upcoming.length ? upcoming.map(e => {
    const d = parseDate(e.date);
    const month = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const head = month !== lastMonth ? `<li class="agenda-month">${month}</li>` : '';
    lastMonth = month;
    const team = TEAM_BY_ID[e.team];
    return `${head}
      <li class="agenda-item" data-action="event-edit" data-id="${esc(e.id)}" style="--c:${eventColor(e)}">
        <div class="agenda-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString('en-GB', { weekday: 'short' })}</small></div>
        <div class="agenda-body">
          <strong>${esc(e.title)}</strong>
          <span>${e.time ? esc(e.time) + ' · ' : ''}${team ? esc(team.short) : 'All teams'}${e.owner ? ' · ' + esc(e.owner) : ''}</span>
          <div class="agenda-count">${relDays(e.date)}</div>
        </div>
      </li>`;
  }).join('') : '<li class="empty">No upcoming events.</li>';
}

function openEventModal(ev = null, preset = {}) {
  $('#event-modal-title').textContent = ev ? 'Edit Event' : 'Add Event / Deadline';
  $('#e-id').value = ev ? ev.id : '';
  $('#e-title').value = ev ? ev.title : '';
  $('#e-date').value = ev ? ev.date : (preset.date || todayKey());
  $('#e-time').value = ev ? (ev.time || '') : '';
  $('#e-type').value = ev ? (ev.type || 'meeting') : 'meeting';
  $('#e-team').value = ev ? (ev.team || 'all') : 'all';
  $('#e-owner').value = ev ? (ev.owner || '') : (state.me || '');
  $('#e-desc').value = ev ? (ev.description || '') : '';
  $('#e-delete').hidden = !ev;
  $('#event-modal').showModal();
  $('#e-title').focus();
}

async function submitEvent(e) {
  e.preventDefault();
  const id = $('#e-id').value;
  const data = {
    title: $('#e-title').value.trim(),
    date: $('#e-date').value,
    time: $('#e-time').value,
    type: $('#e-type').value,
    team: $('#e-team').value,
    owner: $('#e-owner').value.trim(),
    description: $('#e-desc').value.trim()
  };
  if (!data.title || !data.date) return;
  try {
    if (id) await Store.save('events', id, data);
    else await Store.add('events', data);
    $('#event-modal').close();
    // Jump the calendar to the event's month so the user sees it
    const d = parseDate(data.date);
    state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    if (state.view === 'calendar') renderCalendar();
    toast(id ? 'Event updated' : 'Event added', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

/* =========================================================================
   10. MODALS, GLOBAL EVENTS & BOOTSTRAP
   ========================================================================= */

/* ---------- File / link / image modal ---------- */
let fileCtx = { team: 'overview', mode: 'file', gallery: false, file: null };

function openFileModal({ team, mode = 'file', gallery = false, file = null, title = '' }) {
  fileCtx = { team, mode, gallery, file };
  $('#file-form').reset();
  $('#file-modal-title').textContent = gallery ? 'Add Image to Gallery' : 'Add to Repository';
  $('#file-seg').hidden = gallery;
  $('#f-file').accept = gallery ? 'image/*' : '';
  $('#f-title').value = title;
  $('#f-by').value = state.me || '';
  $('#f-limit').textContent = Store.mode === 'firebase'
    ? `Any file type · up to ${MAX_CLOUD_FILE_MB} MB · stored in Firebase Storage and shared with the team.`
    : `Local demo mode: files are stored in this browser only (max ${MAX_LOCAL_FILE_MB} MB). Connect Firebase to share with the team.`;
  $('#f-progress').hidden = true;
  setFileMode(mode);
  setModalFile(file);
  $('#file-modal').showModal();
}

function setFileMode(mode) {
  fileCtx.mode = mode;
  $$('#file-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('#file-pane').hidden = mode !== 'file';
  $('#link-pane').hidden = mode !== 'link';
  $('#f-url').required = mode === 'link';
}

function setModalFile(file) {
  fileCtx.file = file || null;
  const drop = $('#modal-drop');
  drop.classList.toggle('has-file', !!file);
  $('#f-file-label').textContent = file ? `${file.name} · ${fmtSize(file.size)}` : 'Click to choose a file, or drop it here';
  if (file && !$('#f-title').value) $('#f-title').value = file.name.replace(/\.[^.]+$/, '');
}

async function submitFile(e) {
  e.preventDefault();
  const { team, mode, gallery, file } = fileCtx;
  const title = $('#f-title').value.trim();
  const description = $('#f-desc').value.trim();
  const addedBy = $('#f-by').value.trim();
  if (addedBy && addedBy !== state.me) setMe(addedBy);

  const btn = $('#f-submit');
  btn.disabled = true;
  try {
    if (mode === 'link') {
      const url = safeUrl($('#f-url').value.trim());
      if (!url) throw new Error('Please enter a valid http(s) link.');
      await Store.add('files', { team, kind: 'link', title: title || url, description, url, addedBy });
    } else {
      if (!file) throw new Error('Please choose a file first.');
      if (gallery && !/^image\//.test(file.type)) throw new Error('Please choose an image file (PNG, JPG, WebP…).');
      $('#f-progress').hidden = false;
      $('#f-progress-bar').style.width = '0%';
      const { url, storagePath } = await Store.upload(file, `${team}/${gallery ? 'gallery' : 'files'}`,
        p => { $('#f-progress-bar').style.width = `${Math.round(p * 100)}%`; });
      await Store.add('files', {
        team, kind: gallery ? 'image' : 'file', title: title || file.name, description,
        url, storagePath, fileName: file.name, size: file.size, mime: file.type || '', addedBy
      });
    }
    $('#file-modal').close();
    toast(gallery ? 'Image added' : mode === 'link' ? 'Link added' : 'File uploaded', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    $('#f-progress').hidden = true;
  }
}

/* ---------- Lightbox ---------- */
function openLightbox(id) {
  const f = state.files.find(x => x.id === id);
  if (!f) return;
  const yt = f.kind === 'link' ? youtubeId(f.url) : null;
  let content = '';
  if (yt) content = `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${esc(f.title)}"></iframe>`;
  else if (/^video\//.test(f.mime || '')) content = `<video src="${esc(f.url)}" controls autoplay></video>`;
  else if (f.kind === 'image' || /^image\//.test(f.mime || '')) content = `<img src="${esc(f.url)}" alt="${esc(f.title)}" />`;
  else { window.open(f.url, '_blank', 'noopener'); return; }
  $('#lightbox-content').innerHTML = content;
  $('#lightbox-caption').textContent = f.description ? `${f.title} — ${f.description}` : f.title;
  $('#lightbox').showModal();
}

/* ---------- "Me" (name used for attribution) ---------- */
function setMe(name) {
  state.me = name;
  pref.set('me', name);
  $('#me-avatar').textContent = name ? initials(name) : '?';
  $('#me-name').textContent = name || 'Set name';
}

/* ---------- Dropdowns, datalists, nav ---------- */
function renderStaticControls() {
  $('#teams-menu').innerHTML = TEAMS.map(t => `
    <a class="dropdown-item" href="#teams/${t.id}">
      <span class="avatar" style="background:${t.color};width:30px;height:30px">${t.code}</span>
      <span><strong>${esc(t.name)}</strong><small>Lead: ${esc(t.lead)}</small></span>
    </a>`).join('');

  const teamOpts = TEAMS.map(t => `<option value="${t.id}">${t.code} · ${esc(t.name)}</option>`).join('');
  $('#t-team').innerHTML = teamOpts;
  $('#f-team').innerHTML = `<option value="">All workstreams</option>${teamOpts}`;
  $('#e-team').innerHTML = `<option value="all">All teams</option>${teamOpts}`;
  $('#t-status').innerHTML = STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  $('#e-type').innerHTML = Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
}

function renderMemberLists() {
  const names = [...new Set([...LEADS, ...state.tasks.map(t => t.assignee), ...state.files.map(f => f.addedBy), state.me]
    .filter(Boolean).map(s => s.trim()))].sort((a, b) => a.localeCompare(b));
  $('#member-list').innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
  const sel = $('#f-member');
  const current = state.filters.member;
  const assignees = [...new Set(state.tasks.map(t => t.assignee).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">All members</option>` + assignees.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value = assignees.includes(current) ? current : '';
  if (sel.value !== current) state.filters.member = sel.value;
}

function closeMobileNav() {
  $('#nav').classList.remove('open');
  $('#nav-toggle').setAttribute('aria-expanded', 'false');
}

function setModeBadge(mode) {
  const b = $('#mode-badge');
  if (mode === 'firebase') {
    b.className = 'mode-badge live';
    b.textContent = 'Live · synced';
    b.title = 'Connected to Firebase — changes sync to all team members in real time.';
    $('#footer-mode').textContent = 'Data: Firebase (shared)';
  } else {
    b.className = 'mode-badge local';
    b.textContent = 'Local demo mode';
    b.title = 'Data is saved in this browser only. Paste a Firebase config into app.js to share with the team.';
    $('#footer-mode').textContent = 'Data: this browser only (localStorage)';
  }
}

/* ---------- Global event delegation ---------- */
function bindEvents() {
  window.addEventListener('hashchange', route);

  $('#nav-toggle').addEventListener('click', () => {
    const open = $('#nav').classList.toggle('open');
    $('#nav-toggle').setAttribute('aria-expanded', String(open));
  });

  // All clickable actions use data-action
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT') return;
    const { action, id } = el.dataset;

    switch (action) {
      // Teams
      case 'team-tab': location.hash = `teams/${el.dataset.team}`; break;
      case 'team-tasks':
        state.filters = { q: '', team: el.dataset.team, member: '', priority: '' };
        syncFilterInputs();
        location.hash = 'tasks';
        break;
      case 'notes-edit': openNotesEditor(); break;
      case 'notes-cancel': state.editingNotes = null; renderTeamNotes(); break;
      case 'notes-save': saveNotes(); break;
      case 'repo-cat': state.repoCat = el.dataset.cat; renderRepository(); break;
      case 'upload-file': openFileModal({ team: state.team, mode: 'file' }); break;
      case 'add-link': openFileModal({ team: state.team, mode: 'link' }); break;
      case 'add-image': {
        const team = el.dataset.team === 'current' ? state.team : el.dataset.team;
        openFileModal({ team, gallery: true, title: el.dataset.title || '' });
        break;
      }
      case 'file-delete': e.stopPropagation(); deleteFile(id); break;
      case 'lightbox': openLightbox(id); break;

      // Tasks
      case 'task-new': openTaskModal(null); break;
      case 'task-edit': openTaskModal(state.tasks.find(t => t.id === id)); break;
      case 'task-delete': deleteTask(id); break;
      case 'filters-clear':
        state.filters = { q: '', team: '', member: '', priority: '' };
        syncFilterInputs(); renderBoard();
        break;

      // Calendar
      case 'event-new': openEventModal(null); break;
      case 'event-edit': e.stopPropagation(); openEventModal(state.events.find(x => x.id === id)); break;
      case 'cal-day': openEventModal(null, { date: el.dataset.date }); break;
      case 'cal-prev': state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1); renderCalendar(); break;
      case 'cal-next': state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1); renderCalendar(); break;
      case 'cal-today': { const d = new Date(); state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(); break; }

      // Me
      case 'me-edit': $('#me-input').value = state.me; $('#me-modal').showModal(); $('#me-input').focus(); break;
    }
  });

  // Keyboard: Enter on gallery images opens the lightbox
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('figure.g-item')) openLightbox(e.target.dataset.id);
  });

  // Status dropdown on task cards
  document.addEventListener('change', e => {
    if (e.target.matches('[data-action="task-status"]')) setTaskStatus(e.target.dataset.id, e.target.value);
  });

  // Task filters
  $('#f-q').addEventListener('input', e => { state.filters.q = e.target.value; renderBoard(); });
  ['team', 'member', 'priority'].forEach(k =>
    $(`#f-${k}`).addEventListener('change', e => { state.filters[k] = e.target.value; renderBoard(); }));

  // Repository search
  $('#repo-search').addEventListener('input', e => { state.repoQuery = e.target.value; renderRepository(); });

  // Kanban drag & drop
  const board = $('#board');
  board.addEventListener('dragstart', e => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    e.dataTransfer.setData('text/plain', card.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  board.addEventListener('dragend', e => e.target.closest('.task-card')?.classList.remove('dragging'));
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.column');
    if (!col) return;
    e.preventDefault();
    $$('.column', board).forEach(c => c.classList.toggle('drag-over', c === col));
  });
  board.addEventListener('dragleave', e => {
    if (!board.contains(e.relatedTarget)) $$('.column', board).forEach(c => c.classList.remove('drag-over'));
  });
  board.addEventListener('drop', e => {
    const col = e.target.closest('.column');
    $$('.column', board).forEach(c => c.classList.remove('drag-over'));
    if (!col) return;
    e.preventDefault();
    setTaskStatus(e.dataTransfer.getData('text/plain'), col.dataset.status);
  });

  // Repository drag & drop → opens upload modal with the file pre-selected
  const repoDrop = $('#repo-drop');
  ['dragenter', 'dragover'].forEach(t => repoDrop.addEventListener(t, e => { e.preventDefault(); repoDrop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => repoDrop.addEventListener(t, () => repoDrop.classList.remove('drag')));
  repoDrop.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) openFileModal({ team: state.team, mode: 'file', file });
  });

  // Modal file picker + drop
  $('#f-file').addEventListener('change', e => setModalFile(e.target.files[0]));
  const modalDrop = $('#modal-drop');
  ['dragenter', 'dragover'].forEach(t => modalDrop.addEventListener(t, e => { e.preventDefault(); modalDrop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(t => modalDrop.addEventListener(t, () => modalDrop.classList.remove('drag')));
  modalDrop.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) setModalFile(e.dataTransfer.files[0]); });
  $$('#file-seg .seg-btn').forEach(b => b.addEventListener('click', () => setFileMode(b.dataset.mode)));

  // Forms
  $('#task-form').addEventListener('submit', submitTask);
  $('#event-form').addEventListener('submit', submitEvent);
  $('#file-form').addEventListener('submit', submitFile);
  $('#me-form').addEventListener('submit', e => {
    e.preventDefault();
    setMe($('#me-input').value.trim());
    renderMemberLists();
    $('#me-modal').close();
  });

  $('#t-delete').addEventListener('click', async () => {
    if (await deleteTask($('#t-id').value)) $('#task-modal').close();
  });
  $('#e-delete').addEventListener('click', async () => {
    const id = $('#e-id').value;
    const ev = state.events.find(x => x.id === id);
    if (!ev || !confirm(`Delete "${ev.title}"?`)) return;
    try { await Store.remove('events', id); $('#event-modal').close(); toast('Event deleted', 'success'); }
    catch (err) { toast(err.message, 'error'); }
  });

  // Close buttons + click on backdrop closes any dialog
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  });
  $('#lightbox').addEventListener('close', () => { $('#lightbox-content').innerHTML = ''; });
}

function syncFilterInputs() {
  $('#f-q').value = state.filters.q;
  $('#f-team').value = state.filters.team;
  $('#f-member').value = state.filters.member;
  $('#f-priority').value = state.filters.priority;
}

/* ---------- Bootstrap ---------- */
async function main() {
  renderStaticControls();
  setMe(state.me);
  bindEvents();
  route(); // initial paint with empty data

  const mode = await Store.init();
  setModeBadge(mode);

  let errorShown = false;
  const onError = err => {
    if (errorShown) return;
    errorShown = true;
    toast(err.code === 'permission-denied'
      ? 'Firebase denied access — check Firestore rules and that Anonymous sign-in is enabled.'
      : `Sync error: ${err.message}`, 'error');
  };

  ['tasks', 'events', 'files', 'notes'].forEach(col => {
    Store.subscribe(col, docs => {
      state[col] = docs;
      state.ready[col] = true;
      onData();
    }, onError);
  });

  if (mode === 'local') {
    console.info('%cSPECTRE portal running in LOCAL mode. Paste your Firebase config in app.js to enable team-wide sync.', 'color:#d97706');
  }
}

document.addEventListener('DOMContentLoaded', main);
