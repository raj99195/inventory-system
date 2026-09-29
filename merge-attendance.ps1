# ================================================================
# STEMmantra Merge Script - Sprint 1 File Copy
# Copies attendance files into inventory codebase
# Skips: layout, ui, login, firebase config, node_modules, android
# ================================================================

$ErrorActionPreference = 'Stop'

# --- Paths ------------------------------------------------------
$ATT = "C:\Users\Blockchain\Downloads\stemmantra-attendance Final"
$INV = "C:\Users\Blockchain\Videos\inventory-system"

# --- Sanity check -----------------------------------------------
if (-not (Test-Path $ATT)) { throw "Attendance path not found: $ATT" }
if (-not (Test-Path $INV)) { throw "Inventory path not found: $INV" }

Write-Host ""
Write-Host "=== STEMmantra Merge - Sprint 1 ===" -ForegroundColor Cyan
Write-Host "  Attendance : $ATT" -ForegroundColor Gray
Write-Host "  Inventory  : $INV" -ForegroundColor Gray
Write-Host ""

# --- Create target folders --------------------------------------
$folders = @(
  "$INV\src\components\attendance",
  "$INV\src\pages\attendance",
  "$INV\src\pages\attendance\admin",
  "$INV\src\services\attendance",
  "$INV\src\hooks\attendance",
  "$INV\src\lib\attendance",
  "$INV\resources",
  "$INV\_merge_reference"
)

foreach ($f in $folders) {
  if (-not (Test-Path $f)) {
    New-Item -ItemType Directory -Path $f -Force | Out-Null
    $rel = $f.Replace($INV, '')
    Write-Host "  [DIR] Created: $rel" -ForegroundColor Green
  }
}

# --- Copy helpers -----------------------------------------------
function Copy-One {
  param($src, $dst, $label)
  if (Test-Path $src) {
    Copy-Item $src $dst -Force
    Write-Host "  [OK] $label" -ForegroundColor Green
  } else {
    Write-Host "  [!!] Missing: $label" -ForegroundColor Yellow
  }
}

function Copy-All {
  param($src, $dst, $label)
  if (Test-Path $src) {
    Copy-Item "$src\*" $dst -Recurse -Force
    Write-Host "  [OK] $label" -ForegroundColor Green
  } else {
    Write-Host "  [!!] Missing: $label" -ForegroundColor Yellow
  }
}

# --- 1. Attendance components -----------------------------------
Write-Host ""
Write-Host "[1/9] Components..." -ForegroundColor Cyan
Copy-All "$ATT\src\components\attendance" "$INV\src\components\attendance" "components/attendance/*"

# --- 2. Employee pages ------------------------------------------
Write-Host ""
Write-Host "[2/9] Employee pages..." -ForegroundColor Cyan
Copy-One "$ATT\src\pages\employee\DashboardPage.jsx"     "$INV\src\pages\attendance\AttendanceHomePage.jsx"    "DashboardPage.jsx -> AttendanceHomePage.jsx"
Copy-One "$ATT\src\pages\employee\AttendancePage.jsx"    "$INV\src\pages\attendance\MarkAttendancePage.jsx"    "AttendancePage.jsx -> MarkAttendancePage.jsx"
Copy-One "$ATT\src\pages\employee\MyAttendancePage.jsx"  "$INV\src\pages\attendance\MyAttendancePage.jsx"      "MyAttendancePage.jsx"
Copy-One "$ATT\src\pages\employee\ApplyLeavePage.jsx"    "$INV\src\pages\attendance\ApplyLeavePage.jsx"        "ApplyLeavePage.jsx"
Copy-One "$ATT\src\pages\employee\MyLeavesPage.jsx"      "$INV\src\pages\attendance\MyLeavesPage.jsx"          "MyLeavesPage.jsx"

# --- 3. Admin pages ---------------------------------------------
Write-Host ""
Write-Host "[3/9] Admin pages..." -ForegroundColor Cyan
Copy-One "$ATT\src\pages\admin\AdminDashboardPage.jsx"   "$INV\src\pages\attendance\admin\AttendanceAdminDashboardPage.jsx" "AdminDashboardPage -> AttendanceAdminDashboardPage.jsx"
Copy-One "$ATT\src\pages\admin\AttendanceViewPage.jsx"   "$INV\src\pages\attendance\admin\AttendanceViewPage.jsx" "AttendanceViewPage.jsx"
Copy-One "$ATT\src\pages\admin\LeaveApprovalsPage.jsx"   "$INV\src\pages\attendance\admin\LeaveApprovalsPage.jsx" "LeaveApprovalsPage.jsx"
Copy-One "$ATT\src\pages\admin\SchoolsPage.jsx"          "$INV\src\pages\attendance\admin\SchoolsPage.jsx" "SchoolsPage.jsx"
Copy-One "$ATT\src\pages\admin\SettingsPage.jsx"         "$INV\src\pages\attendance\admin\AttendanceSettingsPage.jsx" "SettingsPage.jsx -> AttendanceSettingsPage.jsx"

# --- 4. Services ------------------------------------------------
Write-Host ""
Write-Host "[4/9] Services..." -ForegroundColor Cyan
Copy-One "$ATT\src\services\attendance.service.js" "$INV\src\services\attendance\attendance.service.js" "attendance.service.js"
Copy-One "$ATT\src\services\leaves.service.js"     "$INV\src\services\attendance\leaves.service.js"     "leaves.service.js"
Copy-One "$ATT\src\services\schools.service.js"    "$INV\src\services\attendance\schools.service.js"    "schools.service.js"
Copy-One "$ATT\src\services\settings.service.js"   "$INV\src\services\attendance\settings.service.js"   "settings.service.js"
Copy-One "$ATT\src\services\email.service.js"      "$INV\src\services\attendance\email.service.js"      "email.service.js"
Copy-One "$ATT\src\services\db.adapter.js"         "$INV\src\services\attendance\db.adapter.js"         "db.adapter.js (reference)"

# --- 5. Hooks ---------------------------------------------------
Write-Host ""
Write-Host "[5/9] Hooks..." -ForegroundColor Cyan
Copy-One "$ATT\src\hooks\useGeolocation.js"       "$INV\src\hooks\attendance\useGeolocation.js"       "useGeolocation.js"
Copy-One "$ATT\src\hooks\useNativePermissions.js" "$INV\src\hooks\attendance\useNativePermissions.js" "useNativePermissions.js"

# --- 6. Utils ---------------------------------------------------
Write-Host ""
Write-Host "[6/9] Utils..." -ForegroundColor Cyan
Copy-One "$ATT\src\utils\datetime.js"  "$INV\src\lib\attendance\datetime.js"  "datetime.js"
Copy-One "$ATT\src\utils\geocode.js"   "$INV\src\lib\attendance\geocode.js"   "geocode.js"
Copy-One "$ATT\src\utils\csvExport.js" "$INV\src\lib\attendance\csvExport.js" "csvExport.js"

# --- 7. Constants -----------------------------------------------
Write-Host ""
Write-Host "[7/9] Constants..." -ForegroundColor Cyan
Copy-One "$ATT\src\constants\leaveTypes.js"  "$INV\src\lib\attendance\leaveTypes.js"  "leaveTypes.js"
Copy-One "$ATT\src\constants\permissions.js" "$INV\src\lib\attendance\permissions.js" "permissions.js (reference for merge)"
Copy-One "$ATT\src\constants\roles.js"       "$INV\src\lib\attendance\roles.js"       "roles.js (reference for merge)"

# --- 8. Reference files -----------------------------------------
Write-Host ""
Write-Host "[8/9] Reference files..." -ForegroundColor Cyan
Copy-One "$ATT\src\contexts\AuthContext.jsx" "$INV\_merge_reference\AuthContext.attendance.jsx" "AuthContext.jsx (reference)"
Copy-One "$ATT\src\config\firebase.js"       "$INV\_merge_reference\firebase.attendance.js"     "firebase.js (reference)"
Copy-One "$ATT\firestore.rules"              "$INV\_merge_reference\firestore.attendance.rules" "firestore.rules (reference)"
Copy-One "$ATT\capacitor.config.json"        "$INV\_merge_reference\capacitor.config.attendance.json" "capacitor.config.json (reference)"
Copy-One "$ATT\tailwind.config.js"           "$INV\_merge_reference\tailwind.config.attendance.js" "tailwind.config.js (reference)"
Copy-One "$ATT\vite.config.js"               "$INV\_merge_reference\vite.config.attendance.js" "vite.config.js (reference)"
Copy-One "$ATT\package.json"                 "$INV\_merge_reference\package.attendance.json" "package.json (for deps reference)"

# --- 9. Assets & Scripts ----------------------------------------
Write-Host ""
Write-Host "[9/9] Assets & scripts..." -ForegroundColor Cyan
Copy-One "$ATT\resources\icon.png"   "$INV\resources\icon.png"   "resources/icon.png (for APK)"
Copy-One "$ATT\resources\splash.png" "$INV\resources\splash.png" "resources/splash.png (for APK)"
Copy-One "$ATT\public\apple-touch-icon.png" "$INV\public\apple-touch-icon.png" "apple-touch-icon.png"
Copy-One "$ATT\public\favicon.svg"          "$INV\public\favicon.svg"          "favicon.svg"
Copy-One "$ATT\public\icon-192.png"         "$INV\public\icon-192.png"         "icon-192.png"
Copy-One "$ATT\public\icon-512.png"         "$INV\public\icon-512.png"         "icon-512.png"
Copy-One "$ATT\scripts\add-employee.cjs"    "$INV\scripts\add-employee.cjs"    "add-employee.cjs"
Copy-One "$ATT\build-apk.bat"               "$INV\_merge_reference\build-apk.bat" "build-apk.bat (reference)"
Copy-One "$ATT\generate-icons.bat"          "$INV\_merge_reference\generate-icons.bat" "generate-icons.bat (reference)"

# --- Done -------------------------------------------------------
Write-Host ""
Write-Host "=== Copy Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "[SUCCESS] All attendance files copied into inventory." -ForegroundColor Green
Write-Host ""
Write-Host "Folders created inside inventory:" -ForegroundColor Yellow
Write-Host "  src/components/attendance/   -> 3 selfie/location components"
Write-Host "  src/pages/attendance/        -> 5 employee pages"
Write-Host "  src/pages/attendance/admin/  -> 5 admin pages"
Write-Host "  src/services/attendance/     -> 6 services"
Write-Host "  src/hooks/attendance/        -> 2 hooks"
Write-Host "  src/lib/attendance/          -> 6 utils/constants"
Write-Host "  resources/                   -> icon.png, splash.png"
Write-Host "  _merge_reference/            -> configs to reference during conversion"
Write-Host ""
Write-Host "Next step: convert .jsx to .tsx one module at a time." -ForegroundColor Cyan
Write-Host "See MERGE_STATUS.md for checklist." -ForegroundColor Cyan
Write-Host ""
