/**
 * Add an Employee via Firebase Admin SDK.
 * Uses modular imports (firebase-admin v10+).
 *
 * PREREQ:
 *   - service-account.json in project root
 *   - npm install firebase-admin
 *
 * USAGE:
 *   node scripts/add-employee.cjs <email> <password> "<Full Name>"
 *
 * EXAMPLE:
 *   node scripts/add-employee.cjs [email protected] Sakshi@1234 "Sakshi Chaudhary"
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'service-account.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('\n❌ service-account.json not found at:');
  console.error(`   ${SERVICE_ACCOUNT_PATH}\n`);
  process.exit(1);
}

const email    = process.argv[2];
const password = process.argv[3];
const name     = process.argv[4] || 'Employee';

if (!email || !password) {
  console.error('\n❌ Missing arguments.\n');
  console.error('Usage:');
  console.error('  node scripts/add-employee.cjs <email> <password> "<Full Name>"\n');
  console.error('Example:');
  console.error('  node scripts/add-employee.cjs [email protected] Sakshi@1234 "Sakshi Chaudhary"\n');
  process.exit(1);
}

if (password.length < 6) {
  console.error('❌ Password must be at least 6 characters');
  process.exit(1);
}

const EMPLOYEE_PERMS = [
  'dashboard.view',
  'schools.view',
  'attendance_own.view', 'attendance_own.mark',
  'leaves_own.apply', 'leaves_own.view', 'leaves_own.cancel'
];

const DEFAULT_LEAVE_BALANCES = {
  CL: 12, SL: 12, EL: 18, ML: 182, PL: 15, CO: 0, BL: 5, LOP: 0
};

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db   = getFirestore();

async function run() {
  console.log(`\n🚀 Adding Employee`);
  console.log(`   Email:  ${email}`);
  console.log(`   Name:   ${name}\n`);

  let uid;
  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    await auth.updateUser(uid, {
      password,
      displayName: name,
      emailVerified: true,
      disabled: false
    });
    console.log(`✓ Found existing Auth account (uid: ${uid})`);
    console.log(`✓ Password reset, account enabled`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const user = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: true
      });
      uid = user.uid;
      console.log(`✓ Created fresh Auth account (uid: ${uid})`);
    } else {
      throw err;
    }
  }

  const userRef = db.collection('users').doc(uid);
  const existing = await userRef.get();
  const now = new Date().toISOString().slice(0, 10);

  const payload = {
    id: uid,
    uid,
    email: email.toLowerCase(),
    name,
    role: 'employee',
    permissions: EMPLOYEE_PERMS,
    department: '',
    designation: '',
    phone: '',
    assignedSchools: [],
    officeAddress: '',
    officeLat: null,
    officeLng: null,
    officeRadiusM: null,
    joinedOn: existing.exists ? (existing.data().joinedOn || now) : now,
    active: true,
    deleted: false
  };

  await userRef.set(payload, { merge: true });

  if (existing.exists && existing.data().deleted) {
    await userRef.update({
      originalEmail: FieldValue.delete(),
      deletedAt: FieldValue.delete()
    });
    console.log(`✓ Soft-delete flags cleared`);
  }

  console.log(`✓ Firestore doc ${existing.exists ? 'updated' : 'created'}: users/${uid}`);

  const year = new Date().getFullYear();
  const balRef = db.collection('leaveBalances').doc(`${uid}_${year}`);
  const balExists = (await balRef.get()).exists;
  if (!balExists) {
    await balRef.set({
      id: `${uid}_${year}`,
      userId: uid,
      year,
      balances: DEFAULT_LEAVE_BALANCES
    });
    console.log(`✓ Leave balance created for ${year}`);
  } else {
    console.log(`✓ Leave balance already exists for ${year}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ SUCCESS`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     Employee\n`);

  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Add employee failed:');
  console.error(err.message);
  if (err.code) console.error(`   Code: ${err.code}`);
  process.exit(1);
});
