@echo off
chcp 65001 >nul
title كتاب التأسيس التفاعلي - معاينة محلية
cd /d "%~dp0"

netstat -ano | findstr :5174 >nul
if errorlevel 1 (
  start "" /b node server.mjs
  ping 127.0.0.1 -n 3 >nul
)

start http://localhost:5174/
