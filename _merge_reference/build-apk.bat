@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ============================================
echo  STEMmantra Attendance - APK Builder v8
echo  (Auto-detects Android SDK)
echo ============================================
echo.

set "GRADLE_VERSION=8.13"
set "GRADLE_ZIP_NAME=gradle-%GRADLE_VERSION%-all.zip"
set "GRADLE_URL=https://services.gradle.org/distributions/%GRADLE_ZIP_NAME%"
set "CACHE_DIR=%~dp0.gradle-cache"
set "LOCAL_ZIP=%CACHE_DIR%\%GRADLE_ZIP_NAME%"

set "JDK_MAJOR=21"
set "JDK_URL=https://api.adoptium.net/v3/binary/latest/%JDK_MAJOR%/ga/windows/x64/jdk/hotspot/normal/eclipse"
set "JDK_CACHE=%~dp0.jdk-cache"
set "JDK_ZIP=%JDK_CACHE%\jdk%JDK_MAJOR%.zip"

REM ---------- 1. Web build ----------
echo [1/7] Building web assets...
call npm run build
if errorlevel 1 goto :fail

REM ---------- 2. Capacitor sync ----------
echo.
echo [2/7] Syncing Capacitor to Android...
call npx cap sync android
if errorlevel 1 goto :fail

REM ---------- 3. Ensure Gradle ----------
echo.
echo [3/7] Ensuring Gradle %GRADLE_VERSION%...
if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"

where curl.exe >nul 2>&1
if errorlevel 1 (echo [ERROR] curl not found & goto :fail)

if exist "%LOCAL_ZIP%" (
  for %%A in ("%LOCAL_ZIP%") do (
    if %%~zA LSS 100000000 (del /q "%LOCAL_ZIP%")
  )
)
if not exist "%LOCAL_ZIP%" (
  echo   Downloading Gradle...
  curl.exe -L --retry 20 --retry-delay 5 --connect-timeout 60 --retry-connrefused --fail -C - -o "%LOCAL_ZIP%" "%GRADLE_URL%"
  if errorlevel 1 (del /q "%LOCAL_ZIP%" 2>nul & goto :fail)
) else (echo   Using cached Gradle zip.)

REM ---------- 4. Ensure JDK 21 ----------
echo.
echo [4/7] Ensuring OpenJDK %JDK_MAJOR%...
if not exist "%JDK_CACHE%" mkdir "%JDK_CACHE%"

set "JDK_HOME_LOCAL="
for /d %%D in ("%JDK_CACHE%\jdk-%JDK_MAJOR%*") do (
  if exist "%%D\bin\java.exe" if exist "%%D\lib\jvm.cfg" (set "JDK_HOME_LOCAL=%%D") else (rmdir /s /q "%%D")
)

if not defined JDK_HOME_LOCAL (
  if exist "%JDK_ZIP%" (
    for %%A in ("%JDK_ZIP%") do (if %%~zA LSS 100000000 del /q "%JDK_ZIP%")
  )
  if exist "%JDK_ZIP%" (
    tar -tf "%JDK_ZIP%" >nul 2>&1
    if errorlevel 1 del /q "%JDK_ZIP%"
  )
  if not exist "%JDK_ZIP%" (
    echo   Downloading JDK 21...
    curl.exe -L --retry 20 --retry-delay 5 --connect-timeout 60 --retry-connrefused --fail -o "%JDK_ZIP%" "%JDK_URL%"
    if errorlevel 1 (del /q "%JDK_ZIP%" 2>nul & goto :fail)
  )
  echo   Extracting JDK...
  tar -xf "%JDK_ZIP%" -C "%JDK_CACHE%"
  if errorlevel 1 goto :fail
  for /d %%D in ("%JDK_CACHE%\jdk-%JDK_MAJOR%*") do set "JDK_HOME_LOCAL=%%D"
) else (echo   Using cached JDK.)

if not defined JDK_HOME_LOCAL goto :fail
"!JDK_HOME_LOCAL!\bin\java.exe" -version >nul 2>&1
if errorlevel 1 goto :fail
echo   JDK verified.

REM ---------- 5. Auto-detect Android SDK ----------
echo.
echo [5/7] Detecting Android SDK location...
set "ANDROID_SDK_LOCAL="

REM Priority order: existing local.properties, ANDROID_HOME env, common install paths
if exist "android\local.properties" (
  for /f "tokens=1,* delims==" %%A in ('type "android\local.properties" ^| findstr /R "^sdk\.dir="') do (
    set "SDK_FROM_FILE=%%B"
  )
  if defined SDK_FROM_FILE (
    echo   Found existing local.properties
    set "ANDROID_SDK_LOCAL=!SDK_FROM_FILE!"
  )
)

if not defined ANDROID_SDK_LOCAL (
  if defined ANDROID_HOME (
    if exist "%ANDROID_HOME%\platform-tools" (
      echo   Using ANDROID_HOME: %ANDROID_HOME%
      set "ANDROID_SDK_LOCAL=%ANDROID_HOME%"
    )
  )
)

if not defined ANDROID_SDK_LOCAL (
  REM Common paths (in order)
  for %%P in (
    "%LOCALAPPDATA%\Android\Sdk"
    "%USERPROFILE%\AppData\Local\Android\Sdk"
    "%USERPROFILE%\Android\Sdk"
    "C:\Android\Sdk"
    "D:\Android\Sdk"
    "%ProgramFiles%\Android\Sdk"
    "%ProgramFiles(x86)%\Android\Sdk"
  ) do (
    if not defined ANDROID_SDK_LOCAL (
      if exist "%%~P\platform-tools" (
        echo   Found Android SDK at: %%~P
        set "ANDROID_SDK_LOCAL=%%~P"
      )
    )
  )
)

if not defined ANDROID_SDK_LOCAL (
  echo.
  echo [ERROR] Android SDK not found on this machine.
  echo.
  echo   Please install Android Studio ^(one-time^):
  echo   https://developer.android.com/studio
  echo.
  echo   OR set ANDROID_HOME environment variable pointing to your Sdk folder.
  echo.
  goto :fail
)

REM Write local.properties (use forward slashes to avoid escape issues)
powershell -NoProfile -Command "$sdk = '!ANDROID_SDK_LOCAL!' -replace '\\', '/'; Set-Content -Path 'android\local.properties' -Value ('sdk.dir=' + $sdk)"
echo   Wrote android\local.properties

REM ---------- 6. Configure Gradle ----------
echo.
echo [6/7] Configuring Gradle...

powershell -NoProfile -Command "$zip = (Resolve-Path '%LOCAL_ZIP%').Path; $uri = [System.Uri]::new($zip); $url = $uri.AbsoluteUri; $escaped = $url -replace ':', '\:'; $file = 'android\gradle\wrapper\gradle-wrapper.properties'; (Get-Content $file) -replace '^distributionUrl=.*$', ('distributionUrl=' + $escaped) | Set-Content $file"
if errorlevel 1 goto :fail

powershell -NoProfile -Command "$jdk = '!JDK_HOME_LOCAL!' -replace '\\', '/'; $file = 'android\gradle.properties'; $keys = @{ 'org.gradle.java.home' = $jdk; 'org.gradle.java.installations.paths' = $jdk; 'org.gradle.java.installations.auto-detect' = 'false' }; $lines = if (Test-Path $file) { @(Get-Content $file) } else { @() }; foreach ($k in $keys.Keys) { $pattern = '^\s*' + [regex]::Escape($k) + '\s*='; $newLine = $k + '=' + $keys[$k]; $found = $false; $lines = foreach ($l in $lines) { if ($l -match $pattern) { $found = $true; $newLine } else { $l } }; if (-not $found) { $lines += $newLine } }; Set-Content -Path $file -Value $lines"
if errorlevel 1 goto :fail

echo.
echo   Configured:
findstr /R "^sdk.dir=" android\local.properties
findstr /R "^distributionUrl=" android\gradle\wrapper\gradle-wrapper.properties
findstr /R "^org.gradle.java" android\gradle.properties

REM ---------- 7. Build APK ----------
echo.
echo [7/7] Building APK... (first run: SDK deps ~5-10 min)
pushd android
call gradlew.bat assembleDebug --no-daemon --console=plain
set "BUILD_ERR=%errorlevel%"
popd
if not "%BUILD_ERR%"=="0" goto :fail

echo.
echo ============================================
echo  BUILD SUCCESSFUL
echo ============================================
echo APK: android\app\build\outputs\apk\debug\app-debug.apk
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
  explorer android\app\build\outputs\apk\debug
)
pause
exit /b 0

:fail
echo.
echo ============================================
echo  BUILD FAILED - see errors above
echo ============================================
pause
exit /b 1
