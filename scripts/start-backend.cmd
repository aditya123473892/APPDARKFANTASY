@echo off
title DARKFANTASY Backend
cd /d "%~dp0..\backenddf\df-backend-pm-be"
set "PORT=9000"
set "NODE_ENV=development"
call rtk proxy npm run dev
