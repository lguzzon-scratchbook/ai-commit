
@ECHO OFF

::SET "DEBUG="
::SET "DEBUG=1"
::SET "DEBUG=2"

IF ["%DEBUG%"]==["2"] (
	ECHO ON
)

SETLOCAL
SET "TO_NUL= > NUL 2> NUL"
IF NOT ["%DEBUG%"]==[""] (
	SET TO_NUL=
)



SET /A "LOCAL_ERROR=0"
SET "CURRENT_DIR=%CD%"
SET "SCRIPT_DIR=%~dp0"
::FOR %%* IN (%SCRIPT_DIR%.) DO SET "SCRIPT_DIR_NAME=%%~nx*"

::Main script here
IF defined ProgramFiles(x86) (
    ECHO Detected Windows 64-bit [%~dpn0] %TO_NUL%
) ELSE (
    ECHO Detected Windows 32-bit [%~dpn0] %TO_NUL%
)

PUSHD "%SCRIPT_DIR%"
CALL CMD /C "git-bash gitConfig.sh"
CALL CMD /C "git config --global --unset credential.helper"
CALL CMD /C "git config --system --unset credential.helper"
CALL CMD /C "git config --global credential.helper manager"

POPD
:: --- BATCH ENDS HERE
GOTO LABEL__EXIT

:: LOCAL PROCS HERE



:LABEL__EXIT
:: SET /A "LOCAL_ERROR=%ERRORLEVEL%"
ENDLOCAL & EXIT /B %LOCAL_ERROR%


:: DOCs here

:: https://ss64.com/nt/
:: https://ss64.com/ps/

:: https://ss64.com/nt/for_cmd.html


:: SNIPETS HERE

:LOCAL_CHECK_DIR
	SET "DIR_EXIST_LOCAL=1" && PUSHD "%~1" 2>NUL && POPD || SET "DIR_EXIST_LOCAL=0"
EXIT /B %DIR_EXIST_LOCAL%


:: EXECUTE A COMPLEX COMMAND
CMD /C ""%~dp0callToolService.bat" CodeWorker cwRunScript.bat "%~dpn0.cws" %*"

:: CREATE DIR IF NOT EXIST
SET "OUTPUTS_TEXT_DIR=%OUTPUTS_DIR%\TEXTS"
PUSHD "%OUTPUTS_TEXT_DIR%" 2>NUL && POPD
IF ERRORLEVEL 1 MKDIR "%OUTPUTS_TEXT_DIR%"

:: GET UNIQUE TEXT
::: Check WMIC is available
WMIC.EXE Alias /? >NUL 2>&1 || GOTO LOCAL_NOWMIC
::: Use WMIC to retrieve date and time
FOR /F "skip=1 tokens=1-6" %%G IN ('WMIC Path Win32_LocalTime Get Day^,Hour^,Minute^,Month^,Second^,Year /Format:table') DO (
   IF "%%~L"=="" goto LOCAL_WMIC_DONE
      Set _yyyy=%%L
      Set _mm=00%%J
      Set _ss=00%%K
      Set _dd=00%%G
      Set _hour=00%%H
      SET _minute=00%%I
)
:LOCAL_WMIC_DONE
::: Pad digits with leading zeros
      Set _mm=%_mm:~-2%
      Set _ss=%_ss:~-2%
      Set _dd=%_dd:~-2%
      Set _hour=%_hour:~-2%
      Set _minute=%_minute:~-2%
::: DISPLAY THE DATE/TIME IN ISO 8601 FORMAT:
Set UNIQUE=%_yyyy%%_mm%%_dd%-%_hour%%_minute%%_ss%
GOTO LOCAL_UNIQUE
:LOCAL_NOWMIC
FOR /f "skip=1 tokens=2-4 delims=(-/)" %%a in ('"ECHO.|date"') do (
    FOR /f "tokens=1-3 delims=/.- " %%A in ("%date:* =%") do (
        SET %%a=%%A&SET %%b=%%B&SET %%c=%%C))
IF ["%gg%"]==[""] (
	FOR /f "tokens=1-4 delims=:., " %%A in ("%time: =0%") do SET UNIQUE=%yy%%mm%%dd%-%%A%%B%%C%%D
) ELSE (
	FOR /f "tokens=1-4 delims=:., " %%A in ("%time: =0%") do SET UNIQUE=%aa%%mm%%gg%-%%A%%B%%C%%D
)
:LOCAL_UNIQUE

:: FOR EACH FILE ...
for /r %%f in (*.ppt) do (
	REM svn rename "%%f" "%%fx"
	svn rename  "%%f" "%%fx"
	move "%%fx" "%%f"
)
