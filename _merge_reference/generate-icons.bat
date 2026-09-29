@echo off

if not defined _PERSISTENT (
  set _PERSISTENT=1
  start "Icon Generator" cmd /k "%~f0"
  exit /b
)

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "CWD=!CD!"

echo ============================================
echo  STEMmantra - Icon Generator v4
echo ============================================
echo.
echo Working directory:
echo   !CWD!
echo.

REM Step 1
echo [1/4] Checking for resources\icon.png ...
if not exist "resources\icon.png" goto :no_icon
echo   OK.

REM Step 2
echo.
echo [2/4] Checking for npm ...
where npm.cmd >nul 2>&1
if errorlevel 1 goto :no_npm
echo   OK.

REM Step 3
echo.
echo [3/4] Installing @capacitor/assets if needed ...
if not exist "node_modules\@capacitor\assets" goto :install_deps
echo   Already installed.
goto :generate

:install_deps
echo   Running: npm install --save-dev @capacitor/assets
call npm install --save-dev @capacitor/assets --no-audit --no-fund
if errorlevel 1 goto :npm_fail

:generate
REM Step 4
echo.
echo [4/4] Generating icons ...
echo.
call npx capacitor-assets generate --android
if errorlevel 1 goto :gen_fail

echo.
echo ============================================
echo  ICONS GENERATED SUCCESSFULLY
echo ============================================
echo.
echo Verify: android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png
echo.
echo Next: run build-apk.bat
echo Then: uninstall old APK from phone before installing new one
echo.
goto :end

:no_icon
echo   [ERROR] resources\icon.png not found
echo.
echo   Please save your 1024x1024 PNG at:
echo     resources\icon.png
echo   inside this directory.
goto :end

:no_npm
echo   [ERROR] npm not in PATH
echo   Install Node.js from https://nodejs.org
goto :end

:npm_fail
echo   [ERROR] npm install failed
goto :end

:gen_fail
echo   [ERROR] Icon generation failed - see error above
goto :end

:end
echo.
echo ============================================
echo  Type EXIT to close this window
echo ============================================
echo.
