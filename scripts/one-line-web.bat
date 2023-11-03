@echo off
setlocal enabledelayedexpansion

REM Git clone
git clone --depth 1 https://github.com/electerm/electerm-web.git
cd electerm-web

REM npm install and build
npm install
npm run build

REM copy .sample.env to .env
copy .sample.env .env

REM Generate a random alphanumeric string of length 30
REM This requires Windows PowerShell
for /f "tokens=* USEBACKQ" %%F in (`powershell -Command "[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).Guid))"`) do (
    set "SERVER_SECRET=%%F"
)

REM Update .env file
powershell -Command "(gc .env) -replace 'SERVER_SECRET=.*', 'SERVER_SECRET=!SERVER_SECRET!' | Out-File -encoding ASCII .env"

set NODE_ENV=production && node ./src/app/app.js
