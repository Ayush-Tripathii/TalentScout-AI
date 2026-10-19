' TalentScout AI Silent Desktop Launcher
' Runs the desktop application with zero console windows visible.

Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

PythonExe = ScriptDir & "\.venv\Scripts\pythonw.exe"
ScriptFile = ScriptDir & "\desktop_app.py"

If Not fso.FileExists(PythonExe) Then
    MsgBox "Python virtual environment not found in .venv\Scripts\pythonw.exe!" & vbCrLf & _
           "Please ensure the folder was transferred with .venv intact.", vbCritical, "TalentScout Error"
    WScript.Quit 1
End If

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = ScriptDir

' Launch pythonw silently (0 = hide window, False = don't wait)
WshShell.Run """" & PythonExe & """ """ & ScriptFile & """", 0, False
