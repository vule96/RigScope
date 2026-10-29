@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where go >nul 2>nul || (echo Chưa có Go: cài từ https://go.dev/dl/ rồi chạy lại. & pause & exit /b 1)
where npm >nul 2>nul || (echo Chưa có Node.js: cài từ https://nodejs.org rồi chạy lại. & pause & exit /b 1)
set "PATH=%USERPROFILE%\go\bin;%PATH%"
rem The running app locks build\bin\rig-scope.exe.
taskkill /im rig-scope.exe /t /f >nul 2>nul && timeout /t 2 >nul
echo Đang build Rig Scope, lần đầu mất vài phút (tải Wails và thư viện)...
echo. > build.log
where wails >nul 2>nul || (
  echo [wails install] >> build.log
  go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0 >> build.log 2>&1 || goto fail
)
echo [go mod tidy] >> build.log
go mod tidy >> build.log 2>&1 || goto fail
echo [wails build] >> build.log
wails build >> build.log 2>&1 || goto fail
echo.
echo Xong: build\bin\rig-scope.exe
start "" "build\bin\rig-scope.exe"
timeout /t 5 >nul
exit /b 0
:fail
type build.log
echo.
echo Build lỗi, xem thông báo ở trên (đã lưu trong build.log).
pause
exit /b 1
