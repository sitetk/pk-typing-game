@echo off
start "" chrome.exe --user-data-dir="%TEMP%\chrome_temp_user" --allow-file-access-from-files "%~dp0index.html"