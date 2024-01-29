@echo off

rem Set the name of the Python script
set script=_start-server.py

rem Set the path to the Python executable (two folders back)
set python_path=..\..\2_ModelScripts\_Python\py-tdm-env\python.exe

rem Check if Python executable exists
if not exist %python_path% (
    echo Python executable not found at: %python_path%
    pause
    exit /b 1
)

rem Start the Python script using the specified Python executable
%python_path% %script%

rem Pause to keep the console window open
pause
