@echo off
title DARKFANTASY Mobile
cd /d "%~dp0.."
call rtk proxy powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-frontend.ps1
