' TalentScout AI Silent Desktop Launcher
' Runs the desktop application with zero console windows visible.

Set fso = CreateObject("Scripting.FileSystemObject")
ScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

PythonExe = ScriptDir & "\runtime\pythonw.exe"
If Not fso.FileExists(PythonExe) Then
    PythonExe = ScriptDir & "\runtime\python.exe"
End If
If Not fso.FileExists(PythonExe) Then
    PythonExe = ScriptDir & "\.venv\Scripts\pythonw.exe"
End If
If Not fso.FileExists(PythonExe) Then
    PythonExe = ScriptDir & "\.venv\Scripts\python.exe"
End If
ScriptFile = ScriptDir & "\desktop_app.py"

If Not fso.FileExists(PythonExe) Then
    MsgBox "Python runtime was not found in:" & vbCrLf & _
           ScriptDir & "\runtime\" & vbCrLf & vbCrLf & _
           "Please ensure you have extracted (unzipped) the entire package.", vbCritical, "TalentScout AI Error"
    WScript.Quit 1
End If

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = ScriptDir

' Launch pythonw silently (0 = hide window, False = don't wait)
WshShell.Run """" & PythonExe & """ """ & ScriptFile & """", 0, False
