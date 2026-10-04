@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  py -3.12 -m venv .venv
  if errorlevel 1 goto fail
)
.venv\Scripts\python.exe -c "import flask,torch,torchvision,numpy,PIL,scipy,sklearn" >nul 2>&1
if errorlevel 1 (
  .venv\Scripts\python.exe -m pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
  if errorlevel 1 goto fail
  .venv\Scripts\python.exe -m pip install -r requirements.txt
  if errorlevel 1 goto fail
)
echo.
echo InspectAI starts at http://127.0.0.1:7860
.venv\Scripts\python.exe app.py
if errorlevel 1 goto fail
exit /b 0
:fail
echo.
echo Setup failed. Install Python 3.12 from python.org and try again.
echo If Python is installed, read the error above and README.md.
pause
exit /b 1
