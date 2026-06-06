@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  러브몬 petgame 로컬 서버
echo  http://localhost:5500
echo  종료: Ctrl+C
echo.
python -m http.server 5500 2>nul
if errorlevel 1 (
  echo Python 없음 - npx serve 사용...
  npx --yes serve -l 5500 -c serve.json
)
pause
