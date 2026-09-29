@echo off
REM ============================================================
REM Deploy Firestore Indexes for inventory-e9220
REM Auto-creates firestore.indexes.json if missing
REM ============================================================

setlocal enabledelayedexpansion

REM Go to project root (this script sits in scripts\ subfolder)
cd /d %~dp0..

echo.
echo === STEMmantra Firestore Index Deployer ===
echo Working dir: %CD%
echo.

REM Check firebase CLI
where firebase >nul 2>&1
if errorlevel 1 (
  echo [!] Firebase CLI not found. Installing globally...
  echo.
  call npm install -g firebase-tools
  if errorlevel 1 (
    echo.
    echo [X] Install failed. Run manually: npm install -g firebase-tools
    pause
    exit /b 1
  )
)

REM Auto-create firestore.indexes.json if missing
if not exist "firestore.indexes.json" (
  echo [i] firestore.indexes.json not found. Creating with all needed indexes...
  (
    echo {
    echo   "indexes": [
    echo     {
    echo       "collectionGroup": "attendance",
    echo       "queryScope": "COLLECTION",
    echo       "fields": [
    echo         { "fieldPath": "userId", "order": "ASCENDING" },
    echo         { "fieldPath": "date", "order": "DESCENDING" }
    echo       ]
    echo     },
    echo     {
    echo       "collectionGroup": "leaves",
    echo       "queryScope": "COLLECTION",
    echo       "fields": [
    echo         { "fieldPath": "userId", "order": "ASCENDING" },
    echo         { "fieldPath": "appliedAt", "order": "DESCENDING" }
    echo       ]
    echo     },
    echo     {
    echo       "collectionGroup": "leaves",
    echo       "queryScope": "COLLECTION",
    echo       "fields": [
    echo         { "fieldPath": "status", "order": "ASCENDING" },
    echo         { "fieldPath": "appliedAt", "order": "DESCENDING" }
    echo       ]
    echo     },
    echo     {
    echo       "collectionGroup": "requests",
    echo       "queryScope": "COLLECTION",
    echo       "fields": [
    echo         { "fieldPath": "userId", "order": "ASCENDING" },
    echo         { "fieldPath": "requestedAt", "order": "DESCENDING" }
    echo       ]
    echo     },
    echo     {
    echo       "collectionGroup": "requests",
    echo       "queryScope": "COLLECTION",
    echo       "fields": [
    echo         { "fieldPath": "status", "order": "ASCENDING" },
    echo         { "fieldPath": "requestedAt", "order": "DESCENDING" }
    echo       ]
    echo     },
    echo     {
    echo       "collectionGroup": "invoices",
    echo       "queryScope": "COLLECTION",
    echo       "fields": [
    echo         { "fieldPath": "invoiceNumber", "order": "ASCENDING" }
    echo       ]
    echo     }
    echo   ],
    echo   "fieldOverrides": []
    echo }
  ) > firestore.indexes.json
  echo [OK] firestore.indexes.json created
)

REM Auto-create firebase.json if missing
if not exist "firebase.json" (
  echo [i] firebase.json not found. Creating minimal config...
  (
    echo {
    echo   "firestore": {
    echo     "rules": "firestore.rules",
    echo     "indexes": "firestore.indexes.json"
    echo   }
    echo }
  ) > firebase.json
  echo [OK] firebase.json created
)

REM Auto-create .firebaserc if missing
if not exist ".firebaserc" (
  echo [i] .firebaserc not found. Creating with project inventory-e9220...
  (
    echo {
    echo   "projects": {
    echo     "default": "inventory-e9220"
    echo   }
    echo }
  ) > .firebaserc
  echo [OK] .firebaserc created
)

echo.
echo [1/2] Logging in to Firebase (opens browser if not already logged in)...
call firebase login --no-localhost
if errorlevel 1 (
  echo [X] Firebase login failed
  pause
  exit /b 1
)

echo.
echo [2/2] Deploying indexes to inventory-e9220...
echo.
call firebase deploy --only firestore:indexes --project inventory-e9220
if errorlevel 1 (
  echo.
  echo [X] Index deployment failed. Check errors above.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo [SUCCESS] Indexes deployed. Firebase is now building them.
echo Build takes 2-10 minutes per index.
echo Check status: https://console.firebase.google.com/project/inventory-e9220/firestore/indexes
echo ============================================================
echo.
pause
