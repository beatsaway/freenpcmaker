@echo off
setlocal
cd /d "%~dp0"

set PORT=8770
set URL=http://127.0.0.1:%PORT%/demo/index.html

echo.
echo === Free NPC Maker ===
echo Freeing port %PORT% ...

powershell -NoProfile -Command ^
  "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

timeout /t 1 /nobreak >nul

if not exist "node_modules\vite\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Is Node.js installed?
    pause
    exit /b 1
  )
)

echo.
echo Starting Vite — open ONLY this URL:
echo   %URL%
echo.
echo Do not use python http.server (bare "three" imports will fail).
echo Press Ctrl+C to stop.
echo.

REM Open browser once Vite is accepting connections
start /b powershell -NoProfile -Command ^
  "for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 1; if($r.StatusCode -eq 200){ Start-Process '%URL%'; break } } catch {} ; Start-Sleep -Milliseconds 250 }"

call npx vite --port %PORT% --host --strictPort
endlocal
