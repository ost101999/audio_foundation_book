@echo off
chcp 65001 >nul
title كتاب التأسيس التفاعلي - رفع ونشر
cd /d "%~dp0.."
git add -A
git commit -m "تحديث كتاب التأسيس التفاعلي"
git push origin main
if errorlevel 1 pause
