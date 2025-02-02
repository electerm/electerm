@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting electerm-web installation...

:: Check for required software
echo 📋 Checking system requirements...

:: Check for Git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed!
    echo Please download and install Git from:
    echo https://git-scm.com/download/win
    exit /b 1
)

:: Check for Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    exit /b 1
)

:: Check Node.js version
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set node_major=%%a
)
set node_major=%node_major:~1%
if %node_major% LSS 20 (
    echo ❌ Node.js version must be 20 or higher
    echo Current version: %node_major%
    echo Please upgrade Node.js from https://nodejs.org/
    exit /b 1
)

:: Check for npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed!
    echo Please install Node.js which includes npm
    exit /b 1
)

:: Check for Python
where python3 >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed!
    echo Please download and install Python3 from:
    echo https://www.python.org/downloads/
    exit /b 1
)

:: Check for Visual Studio Build Tools
if not exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
    echo ❌ Visual Studio Build Tools not found!
    echo Please install Visual Studio Build Tools or run:
    echo npm install --global --production windows-build-tools
    exit /b 1
)

echo ✅ All requirements met!

echo 📥 Cloning repository...
git clone --depth 1 https://github.com/electerm/electerm-web.git
if %errorlevel% neq 0 (
    echo ❌ Failed to clone repository
    exit /b 1
)

cd electerm-web
if %errorlevel% neq 0 (
    echo ❌ Failed to enter project directory
    exit /b 1
)

echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)

echo 🏗️ Building project...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Failed to build project
    exit /b 1
)

echo ⚙️ Setting up configuration...
copy .sample.env .env
if %errorlevel% neq 0 (
    echo ❌ Failed to create .env file
    exit /b 1
)

:: Generate a random secret
for /f "tokens=* USEBACKQ" %%F in ('powershell -Command "[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).Guid))"') do (
    set "SERVER_SECRET=%%F"
)

:: Set DB_PATH
set "DB_PATH=%APPDATA%\electerm"

:: Update .env file
powershell -Command "(gc .env) -replace 'SERVER_SECRET=.*', 'SERVER_SECRET=!SERVER_SECRET!' | Out-File -encoding ASCII .env"
echo DB_PATH="%DB_PATH%" >> .env

echo 🚀 Starting application...
set NODE_ENV=production
node ./src/app/app.js