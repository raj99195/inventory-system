# Run from C:\Users\Blockchain\Videos\inventory-system
# PowerShell: right-click "Run with PowerShell" ya terminal me: powershell -ExecutionPolicy Bypass -File fix-structure.ps1

Write-Host "Fixing folder structure..." -ForegroundColor Cyan

# Create nested folder structure
$folders = @(
    "src",
    "src\components",
    "src\components\layout",
    "src\components\ui",
    "src\components\charts",
    "src\contexts",
    "src\hooks",
    "src\lib",
    "src\pages",
    "src\stores",
    "src\types"
)

foreach ($f in $folders) {
    if (-not (Test-Path $f)) {
        New-Item -ItemType Directory -Path $f -Force | Out-Null
        Write-Host "  Created: $f" -ForegroundColor Green
    }
}

# File name -> destination mapping
# NOTE: file extensions detected automatically (.tsx, .ts, .css)
$moves = @{
    "main.tsx"                  = "src\main.tsx"
    "App.tsx"                   = "src\App.tsx"
    "index.css"                 = "src\index.css"
    "vite-env.d.ts"             = "src\vite-env.d.ts"

    "firebase.ts"               = "src\lib\firebase.ts"
    "utils.ts"                  = "src\lib\utils.ts"

    "AuthContext.tsx"           = "src\contexts\AuthContext.tsx"

    "DashboardLayout.tsx"       = "src\components\layout\DashboardLayout.tsx"
    "LoadingScreen.tsx"         = "src\components\ui\LoadingScreen.tsx"
    "PlaceholderPage.tsx"       = "src\components\ui\PlaceholderPage.tsx"

    "LoginPage.tsx"             = "src\pages\LoginPage.tsx"
    "DashboardPage.tsx"         = "src\pages\DashboardPage.tsx"
    "ProductsPage.tsx"          = "src\pages\ProductsPage.tsx"
    "StockPage.tsx"             = "src\pages\StockPage.tsx"
    "InvoicesPage.tsx"          = "src\pages\InvoicesPage.tsx"
    "EmployeesPage.tsx"         = "src\pages\EmployeesPage.tsx"
    "AssetsPage.tsx"            = "src\pages\AssetsPage.tsx"
    "AssignmentsPage.tsx"       = "src\pages\AssignmentsPage.tsx"
    "RepairsPage.tsx"           = "src\pages\RepairsPage.tsx"
    "ReportsPage.tsx"           = "src\pages\ReportsPage.tsx"
    "AuditPage.tsx"             = "src\pages\AuditPage.tsx"
}

foreach ($file in $moves.Keys) {
    $dest = $moves[$file]
    # Try both with and without extension (Windows may hide it)
    $candidates = @($file, ($file -replace '\.tsx$',''), ($file -replace '\.ts$',''), ($file -replace '\.css$',''))
    $found = $false
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            Move-Item -Path $c -Destination $dest -Force
            Write-Host "  Moved: $c  ->  $dest" -ForegroundColor Yellow
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host "  Skipped (not found): $file" -ForegroundColor DarkGray
    }
}

# Special handling for types/index.ts (conflicts with index.html/index.css)
# The types index.ts might just be called "index" — check by content
if (Test-Path "index.ts") {
    Move-Item -Path "index.ts" -Destination "src\types\index.ts" -Force
    Write-Host "  Moved: index.ts  ->  src\types\index.ts" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done! Now run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
