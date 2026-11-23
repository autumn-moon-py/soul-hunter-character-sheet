@echo off
rem Keep this file ASCII-only. cmd.exe parses batch files with the OEM code page,
rem so Chinese text here breaks the parser. All Chinese output comes from pwsh.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Soul Hunter Character Sheet

where pwsh >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] PowerShell 7 ^(pwsh^) was not found.
  echo Install it from: https://aka.ms/powershell
  echo.
  pause
  exit /b 1
)

pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if "%~1"=="" (
  echo.
  pause
)

exit /b %EXIT_CODE%
