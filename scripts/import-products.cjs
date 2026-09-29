#!/usr/bin/env node
'use strict';
/**
 * STEMmantra Product Import Script (v2 with Category)
 * Works with firebase-admin v12+ (modular API)
 *
 * SETUP (once):
 *   npm install firebase-admin xlsx
 *
 * USAGE:
 *   # Dry run — parse & preview, no writes
 *   node scripts/import-products.cjs --key=./serviceAccount.json --dryRun
 *
 *   # Wipe all existing products + fresh import (RECOMMENDED for update)
 *   node scripts/import-products.cjs --key=./serviceAccount.json --wipe
 *
 *   # Import without wiping (adds on top of existing)
 *   node scripts/import-products.cjs --key=./serviceAccount.json
 *
 *   # Skip duplicates by name
 *   node scripts/import-products.cjs --key=./serviceAccount.json --skipDupes
 *
 *   # Preview only how many would be deleted
 *   node scripts/import-products.cjs --key=./serviceAccount.json --wipe --dryRun
 *
 * FLAGS:
 *   --key=<path>       Firebase service account JSON (required)
 *   --file=<path>      Excel file (default: Item_imported_from_zoho-2.xlsx)
 *   --dryRun           Preview without any writes
 *   --wipe             DELETE all existing products before importing
 *   --skipDupes        Skip products whose name already exists
 *   --defaultCategory  Fallback category when Excel row has none (default: Uncategorized)
 */

const fs   = require('fs');
const path = require('path');

// ─── Load packages ────────────────────────────────────────────
function req(pkg) {
  try { return require(pkg); }
  catch {
    console.error(`\n❌  "${pkg}" not found. Run: npm install firebase-admin xlsx\n`);
    process.exit(1);
  }
}

const { initializeApp, cert, deleteApp } = req('firebase-admin/app');
const { getFirestore, FieldValue }       = req('firebase-admin/firestore');
const XLSX                               = req('xlsx');

// ─── CLI flags ────────────────────────────────────────────────
const args    = process.argv.slice(2);
const flag    = n => { const e = args.find(a => a.startsWith(`--${n}=`)); return e ? e.split('=').slice(1).join('=') : null; };
const hasFlag = n => args.includes(`--${n}`);

const keyPath          = flag('key');
const xlsxPath         = flag('file') || 'Item_imported_from_zoho-2.xlsx';
const DRY_RUN          = hasFlag('dryRun');
const WIPE             = hasFlag('wipe');
const SKIP_DUPES       = hasFlag('skipDupes');
const DEFAULT_CATEGORY = flag('defaultCategory') || 'Uncategorized';

// ─── Validate ─────────────────────────────────────────────────
if (!keyPath) {
  console.error('\n❌  --key=<serviceAccount.json> is required.\n');
  process.exit(1);
}

const KEY_ABS  = path.resolve(keyPath);
const XLSX_ABS = path.resolve(xlsxPath);

if (!fs.existsSync(KEY_ABS))  { console.error(`\n❌  Not found: ${KEY_ABS}\n`);  process.exit(1); }
if (!fs.existsSync(XLSX_ABS)) { console.error(`\n❌  Not found: ${XLSX_ABS}\n`); process.exit(1); }

// ─── Colour helpers ───────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;
const C = s => `\x1b[36m${s}\x1b[0m`;

// ─── Helpers ──────────────────────────────────────────────────
const parsePrice = raw => {
  if (raw == null) return 0;
  const n = parseFloat(String(raw).replace(/INR\s*/i, '').replace(/,/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
};

const normaliseUnit = raw => {
  if (!raw) return 'pcs';
  const u = String(raw).toLowerCase().trim();
  if (['pcs','piece','pieces'].includes(u)) return 'pcs';
  if (['set','sets'].includes(u))            return 'set';
  return u;
};

const cleanCategory = raw => {
  if (!raw) return DEFAULT_CATEGORY;
  const c = String(raw).trim();
  return c || DEFAULT_CATEGORY;
};

// ─── Delete all products in batches ───────────────────────────
async function wipeProducts(db) {
  console.log(R('\n⚠️   WIPING ALL EXISTING PRODUCTS...\n'));

  let totalDeleted = 0;
  let round = 0;

  while (true) {
    round++;
    // Fetch up to 500 at a time
    const snap = await db.collection('products').limit(500).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snap.size;
    console.log(R(`  ✗  Round ${round} → ${snap.size} deleted  (total: ${totalDeleted})`));

    if (snap.size < 500) break;
  }

  console.log(R(`\n💥  ${totalDeleted} product(s) deleted\n`));
  return totalDeleted;
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('\n' + B('━━━ STEMmantra Product Importer v2 ━━━'));
  if (DRY_RUN) console.log(Y('  🔍  DRY RUN — nothing will be written\n'));
  if (WIPE)    console.log(R('  💥  WIPE mode — all existing products will be deleted\n'));

  // 1. Init Firebase
  const serviceAccount = JSON.parse(fs.readFileSync(KEY_ABS, 'utf8'));
  const app = initializeApp({ credential: cert(serviceAccount) });
  const db  = getFirestore(app);
  console.log(`🔥  Firebase: ${B(serviceAccount.project_id)}`);

  // 2. Read Excel
  console.log(`📂  Reading: ${XLSX_ABS}`);
  const wb       = XLSX.readFile(XLSX_ABS);
  const sheet    = wb.SheetNames[0];
  const rawRows  = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });
  console.log(`    ${rawRows.length} rows in sheet "${sheet}"`);

  // 3. Detect columns automatically (handles slight header variations)
  if (!rawRows.length) {
    console.log(Y('\n⚠️   Empty sheet, nothing to import.\n'));
    await deleteApp(app);
    process.exit(0);
  }

  const headers = Object.keys(rawRows[0]);
  console.log(C(`\n📋  Detected headers: ${headers.join(' | ')}`));

  // Auto-detect column names
  const findHeader = (...keywords) =>
    headers.find(h => keywords.some(kw => h.toLowerCase().replace(/[\s\/_]/g,'').includes(kw))) || null;

  const nameCol     = findHeader('itemname','name');
  const hsnCol      = findHeader('hsn','sac');
  const categoryCol = findHeader('category');   // 🚀 new
  const priceCol    = findHeader('sellingprice','price');
  const purchaseCol = findHeader('purchaserate','purchase');
  const gstCol      = findHeader('intrastatetaxrate','taxrate','gstrate');
  const unitCol     = findHeader('usageunit','unit');

  console.log(C(`\n🔎  Column mapping:`));
  console.log(`    Name:     ${nameCol || R('❌ NOT FOUND')}`);
  console.log(`    HSN:      ${hsnCol || '(missing, using empty)'}`);
  console.log(`    Category: ${categoryCol || Y('(missing → default "'+DEFAULT_CATEGORY+'")')}`);
  console.log(`    Price:    ${priceCol || Y('(missing → 0)')}`);
  console.log(`    Purchase: ${purchaseCol || Y('(missing → 0)')}`);
  console.log(`    GST:      ${gstCol || Y('(missing → 18)')}`);
  console.log(`    Unit:     ${unitCol || Y('(missing → pcs)')}`);

  if (!nameCol) {
    console.error(R('\n❌  Cannot find item name column. Aborting.\n'));
    await deleteApp(app);
    process.exit(1);
  }

  // 4. Parse rows
  const products = [];
  const skipped  = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row  = rawRows[i];
    const name = String(row[nameCol] || '').trim();
    if (!name) { skipped.push(`Row ${i+2}: empty name`); continue; }

    products.push({
      name,
      sku:           hsnCol      && row[hsnCol]      != null ? String(row[hsnCol]).trim() : '',
      category:      cleanCategory(categoryCol ? row[categoryCol] : null),
      description:   '',
      unit:          normaliseUnit(unitCol ? row[unitCol] : 'pcs'),
      purchasePrice: parsePrice(purchaseCol ? row[purchaseCol] : 0),
      sellingPrice:  parsePrice(priceCol ? row[priceCol] : 0),
      gstPercent:    (() => {
        if (!gstCol) return 18;
        const v = row[gstCol];
        if (typeof v === 'number') return v;
        const parsed = parseFloat(String(v || '18'));
        return isNaN(parsed) ? 18 : parsed;
      })(),
      minStockLevel: 0,
      currentStock:  0,
      status:        'active',
    });
  }

  console.log(G(`\n✅  Parsed: ${products.length} products`));
  if (skipped.length) skipped.forEach(s => console.log(Y(`⚠️   ${s}`)));

  // 5. Category distribution
  const catCount = {};
  products.forEach(p => { catCount[p.category] = (catCount[p.category]||0) + 1; });
  const sortedCats = Object.entries(catCount).sort((a,b)=>b[1]-a[1]);

  console.log(C(`\n📁  Categories (${sortedCats.length} unique):`));
  sortedCats.forEach(([cat, count]) => {
    const bar = '█'.repeat(Math.min(30, Math.ceil(count/2)));
    console.log(`    ${cat.padEnd(24)} ${String(count).padStart(4)}  ${C(bar)}`);
  });

  // 6. Sample preview
  console.log('\n' + B('── Sample (first 5) ──'));
  products.slice(0, 5).forEach((p, i) => {
    const n = p.name.length > 38 ? p.name.slice(0,35)+'...' : p.name;
    console.log(
      `  ${String(i+1).padStart(3)}. ${n.padEnd(38)} | ${p.category.padEnd(16)} | HSN: ${p.sku.padEnd(10)} | ` +
      `₹${String(p.sellingPrice).padEnd(8)} | GST ${p.gstPercent}%`
    );
  });

  const gst5  = products.filter(p => p.gstPercent === 5).length;
  const gst18 = products.filter(p => p.gstPercent === 18).length;
  console.log(`\n  GST: ${gst5} × 5%  |  ${gst18} × 18%  |  ${products.length} total`);

  // 7. Check existing products count
  const existingSnap = await db.collection('products').select().get();
  const existingCount = existingSnap.size;
  console.log(C(`\n📊  Currently in Firestore: ${existingCount} product(s)`));

  // 8. Dry run → stop here
  if (DRY_RUN) {
    console.log(Y(`\n🔍  DRY RUN — nothing changed.`));
    if (WIPE) console.log(Y(`    Would delete ${existingCount} existing product(s).`));
    console.log(Y(`    Would import ${products.length} new product(s).\n`));
    await deleteApp(app);
    process.exit(0);
  }

  // 9. Wipe if requested
  if (WIPE) {
    if (existingCount > 0) {
      await wipeProducts(db);
    } else {
      console.log(Y('\n⚠️   --wipe passed but no existing products to delete\n'));
    }
  }

  // 10. Duplicate detection (only if not wiped)
  let existingNames = new Set();
  if (SKIP_DUPES && !WIPE) {
    process.stdout.write('\n🔍  Checking existing product names... ');
    const snap = await db.collection('products').select('name').get();
    snap.forEach(d => { const n = d.data().name; if (n) existingNames.add(n.toLowerCase().trim()); });
    console.log(`${existingNames.size} found`);
  }

  const toImport = SKIP_DUPES && !WIPE
    ? products.filter(p => !existingNames.has(p.name.toLowerCase().trim()))
    : products;

  if (SKIP_DUPES && !WIPE && toImport.length < products.length) {
    console.log(Y(`    Skipping ${products.length - toImport.length} duplicate name(s)`));
  }

  if (toImport.length === 0) {
    console.log(Y('\n⚠️   Nothing to import.\n'));
    await deleteApp(app);
    process.exit(0);
  }

  // 11. Batch write
  const BATCH_SIZE   = 499;
  const totalBatches = Math.ceil(toImport.length / BATCH_SIZE);
  const now          = FieldValue.serverTimestamp();
  let written        = 0;

  console.log(`\n🚀  Importing ${toImport.length} products in ${totalBatches} batch(es)...\n`);

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const chunk    = toImport.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch    = db.batch();

    chunk.forEach(p => {
      batch.set(db.collection('products').doc(), { ...p, createdAt: now, updatedAt: now });
    });

    await batch.commit();
    written += chunk.length;
    console.log(G(`  ✓  Batch ${batchNum}/${totalBatches}  →  ${written}/${toImport.length} written`));
  }

  // 12. Summary
  console.log('\n' + B('━━━ Import Complete ━━━'));
  console.log(G(`\n✅  ${written} products imported successfully!\n`));
  console.log(`    Collection : /products`);
  console.log(`    Project    : ${serviceAccount.project_id}`);
  console.log(`    Categories : ${sortedCats.length} unique`);
  console.log(`    Stock      : 0 for all (update via Stock Movement)\n`);

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error(R('\n❌  ' + err.message));
  if (err.code) console.error(R('    Code: ' + err.code));
  process.exit(1);
});
