@echo off
setlocal
set "DEPLOY_DIR=%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-sub2api-manual.ps1" -DeployDir "%DEPLOY_DIR%" -PublicHealthUrl "https://wawazz.xyz/health"
endlocal
