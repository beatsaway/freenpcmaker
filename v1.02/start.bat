@echo off
setlocal
cd /d "%~dp0"

set PORT=8772
set URL=http://127.0.0.1:%PORT%/

echo.
echo === Free NPC Maker v1.02 ===
echo Lean local server (Python + Three.js CDN — no npm)
echo Freeing port %PORT% ...

powershell -NoProfile -Command ^
  "Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

timeout /t 1 /nobreak >nul

where python >nul 2>&1
if errorlevel 1 (
  echo Python not found. Install Python 3, or use start-vite.bat instead.
  pause
  exit /b 1
)

if not exist "serve.py" (
  echo Missing serve.py
  pause
  exit /b 1
)

echo.
echo Open: %URL%
echo Press Ctrl+C to stop.
echo.

start /b powershell -NoProfile -Command ^
  "for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 1; if($r.StatusCode -eq 200){ Start-Process '%URL%'; break } } catch {} ; Start-Sleep -Milliseconds 250 }"

set PORT=%PORT%
python serve.py
endlocal
