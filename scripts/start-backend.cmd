@echo off
title DARKFANTASY Backend
cd /d "%~dp0..\dfbackend"
set "PORT=9000"
set "NODE_ENV=development"
rem Compile without Nest's directory cleanup, which fails on locked Windows folders.
call rtk proxy node node_modules\typescript\bin\tsc -p tsconfig.build.json --incremental false
if errorlevel 1 exit /b 1
call rtk proxy npm run start:prod
