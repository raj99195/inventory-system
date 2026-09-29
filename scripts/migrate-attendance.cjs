#!/usr/bin/env node
'use strict';
/**
 * STEMmantra Attendance → Inventory Firebase Migration (v2, modular API)
 *
 * Copies data from attendance-stemmantra → inventory-e9220 with transformations.
 * Uses firebase-admin v12+ modular API.
 *
 * SETUP:
 *   Root mein rakh:
 *     - serviceAccount.json                 (inventory-e9220 target)
 *     - attendance-service-account.json     (attendance-stemmantra source)
 *
 * USAGE:
 *   node scripts/migrate-attendance.cjs --dryRun
 *   node scripts/migrate-attendance.cjs
 *   node scripts/migrate-attendance.cjs --includeAuth
 *   node scripts/migrate-attendance.cjs --only=schools,settings
 *   node scripts/migrate-attendance.cjs --overwriteUsers
 */

const fs   = require('fs');
const path = require('path');

// ─── Load modular firebase-admin ─────────────────────
function req(pkg) {
  try { return require(pkg); }
  catch { console.error(`❌  "${pkg}" not found. Run: npm install firebase-admin`); process.exit(1); }
}

const { initializeApp, cert, deleteApp } = req('firebase-admin/app');
const { getFirestore, FieldValue }       = req('firebase-admin/firestore');
const { getAuth }                        = req('firebase-admin/auth');

// ─── CLI flags ───────────────────────────────────────
const args    = process.argv.slice(2);
const flag    = n => { const e = args.find(a => a.startsWith(`--${n}=`)); return e ? e.split('=').slice(1).join('=') : null; };
const hasFlag = n => args.includes(`--${n}`);

const DRY_RUN         = hasFlag('dryRun');
const INCLUDE_AUTH    = hasFlag('includeAuth');
const OVERWRITE_USERS = hasFlag('overwriteUsers');
const TEMP_PW         = flag('tempPassword') || null;
const ONLY_LIST       = (flag('only') || 'schools,settings,users,leaveBalances,leaves,attendance').split(',').map(s => s.trim());
const shouldRun       = (name) => ONLY_LIST.includes(name);

// ─── Paths ───────────────────────────────────────────
const TARGET_KEY = path.resolve('serviceAccount.json');
const SOURCE_KEY = path.resolve('attendance-service-account.json');

if (!fs.existsSync(TARGET_KEY)) { console.error(`❌  Target key not found: ${TARGET_KEY}`); process.exit(1); }
if (!fs.existsSync(SOURCE_KEY)) { console.error(`❌  Source key not found: ${SOURCE_KEY}`); process.exit(1); }

// ─── Colours ─────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;
const C = s => `\x1b[36m${s}\x1b[0m`;

// ─── Init both apps (modular) ───────────────────────
const srcCreds = JSON.parse(fs.readFileSync(SOURCE_KEY, 'utf8'));
const dstCreds = JSON.parse(fs.readFileSync(TARGET_KEY, 'utf8'));

const srcApp = initializeApp({ credential: cert(srcCreds) }, 'source');
const dstApp = initializeApp({ credential: cert(dstCreds) }, 'target');

const srcDb = getFirestore(srcApp);
const dstDb = getFirestore(dstApp);
srcDb.settings({ ignoreUndefinedProperties: true });
dstDb.settings({ ignoreUndefinedProperties: true });

const srcAuth = getAuth(srcApp);
const dstAuth = getAuth(dstApp);

// ─── Helpers ─────────────────────────────────────────
const now = () => FieldValue.serverTimestamp();
const isoOrNull = v => (v == null ? null : (typeof v === 'number' ? new Date(v).toISOString() : String(v)));

function fullPreset(bool) {
  return {
    dashboard: { view: bool },
    products: { view: bool, create: bool, edit: bool, delete: bool },
    kits: { view: bool, create: bool, edit: bool, delete: bool },
    stock: { view: bool, stockIn: bool, stockOut: bool, adjustment: bool },
    invoices: { view: bool, upload: bool, verify: bool, delete: bool },
    quotations: { view: bool, create: bool, edit: bool, delete: bool },
    employees: { view: bool, create: bool, edit: bool, delete: bool },
    assets: { view: bool, create: bool, edit: bool, delete: bool },
    assignments: { view: bool, assign: bool, return: bool, transfer: bool },
    categories: { view: bool, create: bool, delete: bool },
    audit: { view: bool },
    users: { view: bool, create: bool, edit: bool, delete: bool },
    attendance: { markOwn: bool, viewOwn: bool, viewAll: bool, editAll: bool, exportAll: bool },
    leaves: { applyOwn: bool, viewOwn: bool, cancelOwn: bool, viewAll: bool, approve: bool, exportAll: bool },
    schools: { view: bool, create: bool, edit: bool, delete: bool },
    settings: { view: bool, edit: bool },
    requests: { createOwn: bool, viewOwn: bool, cancelOwn: bool, viewAll: bool, approve: bool },
  };
}

const ROLE_PRESETS = {
  super_admin: fullPreset(true),
  admin: (() => { const p = fullPreset(true); p.users.delete = false; p.settings.edit = false; return p; })(),
  hr: {
    dashboard: { view: true },
    products: { view: true, create: false, edit: false, delete: false },
    kits: { view: true, create: false, edit: false, delete: false },
    stock: { view: true, stockIn: false, stockOut: false, adjustment: false },
    invoices: { view: false, upload: false, verify: false, delete: false },
    quotations: { view: false, create: false, edit: false, delete: false },
    employees: { view: true, create: true, edit: true, delete: false },
    assets: { view: true, create: true, edit: true, delete: false },
    assignments: { view: true, assign: true, return: true, transfer: true },
    categories: { view: true, create: false, delete: false },
    audit: { view: true },
    users: { view: true, create: true, edit: true, delete: false },
    attendance: { markOwn: true, viewOwn: true, viewAll: true, editAll: false, exportAll: true },
    leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true, exportAll: true },
    schools: { view: true, create: true, edit: true, delete: false },
    settings: { view: true, edit: false },
    requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true },
  },
  manager: {
    ...fullPreset(false),
    dashboard: { view: true },
    employees: { view: true, create: false, edit: false, delete: false },
    attendance: { markOwn: true, viewOwn: true, viewAll: true, editAll: false, exportAll: true },
    leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true, exportAll: false },
    schools: { view: true, create: false, edit: false, delete: false },
    requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: true, approve: true },
  },
  employee: {
    ...fullPreset(false),
    dashboard: { view: true },
    attendance: { markOwn: true, viewOwn: true, viewAll: false, editAll: false, exportAll: false },
    leaves: { applyOwn: true, viewOwn: true, cancelOwn: true, viewAll: false, approve: false, exportAll: false },
    schools: { view: true, create: false, edit: false, delete: false },
    requests: { createOwn: true, viewOwn: true, cancelOwn: true, viewAll: false, approve: false },
  },
};

const getRolePreset = (role) => ROLE_PRESETS[role] || ROLE_PRESETS.employee;

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const convertWorkingDays = (arr) => {
  if (!Array.isArray(arr)) return ['MO','TU','WE','TH','FR'];
  return arr.map(i => typeof i === 'number' ? WEEKDAY_CODES[i] : i).filter(Boolean);
};

function colorToHex(name) {
  const map = { blue:'#3B82F6', red:'#EF4444', green:'#10B981', pink:'#EC4899', purple:'#8B5CF6', amber:'#F59E0B', gray:'#6B7280', orange:'#F97316' };
  return map[name?.toLowerCase()] || '#F97316';
}

// ─── AUTH ────────────────────────────────────────────
async function migrateAuth() {
  if (!INCLUDE_AUTH) { console.log(Y('\n⏭️   Skipping auth (use --includeAuth to enable)')); return; }
  console.log(B('\n━━━ AUTH USERS ━━━'));

  const srcUsers = [];
  let pageToken;
  do {
    const res = await srcAuth.listUsers(1000, pageToken);
    srcUsers.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  console.log(`  Source Auth users: ${srcUsers.length}`);

  const dstUids = new Set();
  let dstToken;
  do {
    const res = await dstAuth.listUsers(1000, dstToken);
    res.users.forEach(u => dstUids.add(u.uid));
    dstToken = res.pageToken;
  } while (dstToken);

  const passwordResets = [];
  let created = 0, skipped = 0, failed = 0;

  for (const u of srcUsers) {
    if (dstUids.has(u.uid)) { skipped++; continue; }

    const tempPw = TEMP_PW || Math.random().toString(36).slice(2) + 'A1!';

    if (DRY_RUN) {
      console.log(C(`  [DRY] would create ${u.email} (uid: ${u.uid.slice(0,8)}...)`));
      created++;
      continue;
    }

    try {
      await dstAuth.createUser({
        uid: u.uid,
        email: u.email,
        emailVerified: u.emailVerified,
        displayName: u.displayName,
        password: tempPw,
        disabled: u.disabled,
      });
      try {
        const resetLink = await dstAuth.generatePasswordResetLink(u.email);
        passwordResets.push({ email: u.email, uid: u.uid, resetLink });
      } catch { /* ignore */ }
      created++;
      console.log(G(`  ✓ created ${u.email}`));
    } catch (err) {
      failed++;
      console.log(R(`  ✗ ${u.email}: ${err.message}`));
    }
  }

  console.log(`\n  ${G('Created:')} ${created}  ${Y('Skipped:')} ${skipped}  ${R('Failed:')} ${failed}`);

  if (passwordResets.length && !DRY_RUN) {
    const outFile = `password-resets-${new Date().toISOString().slice(0,10)}.txt`;
    const content = passwordResets.map(r =>
      `${r.email}\n  UID: ${r.uid}\n  Reset link: ${r.resetLink}\n`
    ).join('\n');
    fs.writeFileSync(outFile, content, 'utf8');
    console.log(G(`\n  📧 Reset links saved to: ${outFile}`));
  }
}

// ─── USERS ───────────────────────────────────────────
async function migrateUsers() {
  if (!shouldRun('users')) return;
  console.log(B('\n━━━ USERS ━━━'));

  const srcSnap = await srcDb.collection('users').get();
  console.log(`  Source users: ${srcSnap.size}`);

  let created = 0, merged = 0, skipped = 0;

  for (const doc of srcSnap.docs) {
    const src = doc.data();
    const uid = src.uid || src.id || doc.id;

    if (src.deleted === true) { skipped++; continue; }

    const dstRef = dstDb.collection('users').doc(uid);
    const dstSnap = await dstRef.get();

    const attendanceFields = {
      phone: src.phone || null,
      department: src.department || null,
      designation: src.designation || null,
      assignedSchools: Array.isArray(src.assignedSchools) ? src.assignedSchools : [],
      officeAddress: src.officeAddress || null,
      officeLat: src.officeLat ?? null,
      officeLng: src.officeLng ?? null,
      officeRadiusM: src.officeRadiusM ?? null,
      joinedOn: src.joinedOn || null,
    };

    if (dstSnap.exists && !OVERWRITE_USERS) {
      if (DRY_RUN) {
        console.log(C(`  [DRY] would MERGE ${src.email}`));
      } else {
        await dstRef.set({ ...attendanceFields, updatedAt: now() }, { merge: true });
      }
      merged++;
      console.log(G(`  ⊕ merged ${src.email}`));
    } else {
      const role = src.role || 'employee';
      const perms = getRolePreset(role);

      const newUser = {
        uid,
        email: src.email,
        name: src.name || src.email?.split('@')[0] || 'User',
        role,
        permissions: perms,
        active: src.active !== false,
        ...attendanceFields,
        createdAt: now(),
        createdBy: 'migration',
        updatedAt: now(),
      };

      if (DRY_RUN) {
        console.log(C(`  [DRY] would CREATE ${src.email} (${role})`));
      } else {
        await dstRef.set(newUser);
      }
      created++;
      console.log(G(`  ✓ created ${src.email} (${role})`));
    }
  }

  console.log(`\n  ${G('Created:')} ${created}  ${G('Merged:')} ${merged}  ${Y('Skipped:')} ${skipped}`);
}

// ─── SCHOOLS ─────────────────────────────────────────
async function migrateSchools() {
  if (!shouldRun('schools')) return;
  console.log(B('\n━━━ SCHOOLS ━━━'));

  const srcSnap = await srcDb.collection('schools').get();
  console.log(`  Source schools: ${srcSnap.size}`);

  let count = 0;
  for (const doc of srcSnap.docs) {
    const s = doc.data();
    const payload = {
      name: s.name || 'Unnamed School',
      inTime: s.inTime || '09:00',
      outTime: s.outTime || '17:00',
      workingDays: convertWorkingDays(s.workingDays),
      address: s.address || '',
      lat: s.lat ?? 0,
      lng: s.lng ?? 0,
      radiusM: s.radiusM ?? 100,
      active: s.active !== false,
      createdAt: now(),
      updatedAt: now(),
    };

    if (DRY_RUN) console.log(C(`  [DRY] would create school: ${payload.name}`));
    else await dstDb.collection('schools').doc(doc.id).set(payload);
    count++;
    console.log(G(`  ✓ ${payload.name}`));
  }
  console.log(`\n  ${G('Migrated:')} ${count}`);
}

// ─── SETTINGS ────────────────────────────────────────
async function migrateSettings() {
  if (!shouldRun('settings')) return;
  console.log(B('\n━━━ SETTINGS ━━━'));

  const doc = await srcDb.collection('settings').doc('general').get();
  if (!doc.exists) { console.log(Y('  No settings/general doc — skipping')); return; }

  const s = doc.data();

  const payload = {
    officeStartTime: s.officeStartTime || '09:30',
    officeEndTime: '17:00',
    lateGraceMinutes: 15,
    workingDays: convertWorkingDays(s.workingDays),
    orgGeofence: {
      lat: s.officeLat ?? 0,
      lng: s.officeLng ?? 0,
      radiusM: s.officeRadiusM ?? 100,
    },
    strictGeofence: !!s.geofenceStrict,
    leaveTypes: Array.isArray(s.leaveTypes) ? s.leaveTypes.map(lt => ({
      code: lt.code,
      name: lt.name,
      default: lt.default ?? 0,
      colorHex: lt.color ? colorToHex(lt.color) : (lt.colorHex || '#F97316'),
    })) : [],
    departments: Array.isArray(s.departments) ? s.departments : ['Engineering','HR','Sales'],
    updatedAt: now(),
  };

  if (DRY_RUN) {
    console.log(C('  [DRY] would write settings/general'));
    console.log(C(`       leaveTypes: ${payload.leaveTypes.length}, departments: ${payload.departments.length}`));
  } else {
    await dstDb.collection('settings').doc('general').set(payload, { merge: true });
    console.log(G('  ✓ settings/general written'));
  }
}

// ─── LEAVE BALANCES ──────────────────────────────────
async function migrateLeaveBalances() {
  if (!shouldRun('leaveBalances')) return;
  console.log(B('\n━━━ LEAVE BALANCES ━━━'));

  const srcSnap = await srcDb.collection('leaveBalances').get();
  console.log(`  Source docs: ${srcSnap.size}`);

  const year = new Date().getFullYear();
  let count = 0;

  for (const doc of srcSnap.docs) {
    const s = doc.data();
    const userId = s.userId || doc.id;

    let balances = s.balances && typeof s.balances === 'object' ? { ...s.balances } : {};
    if (Object.keys(balances).length === 0) {
      const codes = ['CL','SL','EL','ML','PL','CO','BL','LOP'];
      codes.forEach(c => { if (typeof s[c] === 'number') balances[c] = s[c]; });
    }

    const targetYear = s.year || year;
    const targetId = `${userId}_${targetYear}`;

    const payload = { userId, year: targetYear, balances };

    if (DRY_RUN) console.log(C(`  [DRY] would write ${targetId}: ${JSON.stringify(balances)}`));
    else await dstDb.collection('leaveBalances').doc(targetId).set(payload);
    count++;
  }
  console.log(`\n  ${G('Migrated:')} ${count}`);
}

// ─── LEAVES ──────────────────────────────────────────
async function migrateLeaves() {
  if (!shouldRun('leaves')) return;
  console.log(B('\n━━━ LEAVES ━━━'));

  const srcSnap = await srcDb.collection('leaves').get();
  console.log(`  Source leaves: ${srcSnap.size}`);

  const batchSize = 400;
  let batch = dstDb.batch();
  let inBatch = 0, committed = 0;

  for (const doc of srcSnap.docs) {
    const s = doc.data();
    const payload = {
      userId: s.userId,
      leaveType: s.type || s.leaveType,
      fromDate: s.from || s.fromDate,
      toDate: s.to || s.toDate,
      days: s.days || 1,
      reason: s.reason || '',
      status: s.status || 'pending',
      appliedAt: isoOrNull(s.appliedAt) || new Date().toISOString(),
      reviewedBy: s.decidedBy || s.reviewedBy || null,
      reviewedAt: isoOrNull(s.decidedAt) || isoOrNull(s.reviewedAt),
      reviewNotes: s.remarks || s.reviewNotes || null,
    };

    if (DRY_RUN) { committed++; continue; }

    const newRef = dstDb.collection('leaves').doc(doc.id);
    batch.set(newRef, payload);
    inBatch++;

    if (inBatch >= batchSize) {
      await batch.commit();
      committed += inBatch;
      console.log(G(`  ✓ committed ${committed}`));
      batch = dstDb.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0 && !DRY_RUN) {
    await batch.commit();
    committed += inBatch;
  }
  console.log(`\n  ${G('Migrated:')} ${committed}`);
}

// ─── ATTENDANCE ──────────────────────────────────────
async function migrateAttendance() {
  if (!shouldRun('attendance')) return;
  console.log(B('\n━━━ ATTENDANCE ━━━'));

  const srcSnap = await srcDb.collection('attendance').get();
  console.log(`  Source records: ${srcSnap.size}`);

  const batchSize = 200;
  let batch = dstDb.batch();
  let inBatch = 0, committed = 0;

  for (const doc of srcSnap.docs) {
    const s = doc.data();
    const ci = s.checkIn || {};
    const co = s.checkOut || null;

    const payload = {
      userId: s.userId,
      date: s.date,
      checkInAt: isoOrNull(ci.at),
      checkOutAt: co ? isoOrNull(co.at) : null,
      checkInSelfie: ci.selfieUrl || '',
      checkOutSelfie: co ? (co.selfieUrl || null) : null,
      checkInLat: ci.lat ?? 0,
      checkInLng: ci.lng ?? 0,
      checkInAddress: ci.address || '',
      checkOutLat: co?.lat ?? null,
      checkOutLng: co?.lng ?? null,
      checkOutAddress: co?.address ?? null,
      locationType: s.locationType || 'office',
      schoolId: s.schoolId || null,
      schoolName: s.schoolName || null,
      isLate: s.status === 'late' || s.status === 'half-day',
      workingMinutes: s.workingMinutes || 0,
      notes: s.notes || '',
    };

    if (DRY_RUN) { committed++; continue; }

    const newRef = dstDb.collection('attendance').doc(doc.id);
    batch.set(newRef, payload);
    inBatch++;

    if (inBatch >= batchSize) {
      await batch.commit();
      committed += inBatch;
      console.log(G(`  ✓ committed ${committed}`));
      batch = dstDb.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0 && !DRY_RUN) {
    await batch.commit();
    committed += inBatch;
  }
  console.log(`\n  ${G('Migrated:')} ${committed}`);
}

// ─── Main ────────────────────────────────────────────
async function main() {
  console.log(B('\n═══════════════════════════════════════════'));
  console.log(B('  STEMmantra Attendance → Inventory Migrator'));
  console.log(B('═══════════════════════════════════════════'));
  console.log(`  Source (from): ${C(srcCreds.project_id)}`);
  console.log(`  Target (to):   ${C(dstCreds.project_id)}`);
  console.log(`  Collections:   ${ONLY_LIST.join(', ')}`);
  console.log(`  Include Auth:  ${INCLUDE_AUTH ? G('yes') : Y('no')}`);
  console.log(`  Overwrite:     ${OVERWRITE_USERS ? Y('YES') : G('no (merge mode)')}`);
  if (DRY_RUN) console.log(Y('  🔍 DRY RUN — no writes will happen'));

  await migrateAuth();
  await migrateSchools();
  await migrateSettings();
  await migrateUsers();
  await migrateLeaveBalances();
  await migrateLeaves();
  await migrateAttendance();

  console.log(B('\n═══ Migration Complete ═══'));
  if (DRY_RUN) console.log(Y('\n🔍 DRY RUN — re-run without --dryRun to apply\n'));
  else console.log(G('\n✅ All data migrated. Log in and verify!\n'));

  await deleteApp(srcApp);
  await deleteApp(dstApp);
  process.exit(0);
}

main().catch(err => {
  console.error(R('\n❌ ' + err.message));
  if (err.code) console.error(R('   Code: ' + err.code));
  console.error(err.stack);
  process.exit(1);
});
