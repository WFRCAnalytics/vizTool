@echo off

rem Set the name of the Python script
set script=_start-server.py

rem Find the Python executable in the PATH
for /f %%i in ('where python') do set python_exec=%%i

rem Check if Python executable was found
if not defined python_exec (
    echo Python executable not found in PATH.
    pause
    exit /b 1
)

rem Start the Python script using the found Python executable
start /b %python_exec% %script%