@echo off
title ApexTrade Backend (ASP.NET Core Web API)
cd /d "%~dp0backend\Exchange.API"
echo Starting CryptoExchange Backend on http://localhost:5000 ...
echo Swagger UI will be available at http://localhost:5000/swagger
dotnet run --launch-profile http
pause
