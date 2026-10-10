' Arranca print-agent.exe (o el agente con Node) sin mostrar ninguna ventana
' de consola — pensado para ponerlo en el Inicio de Windows (shell:startup).
' Tiene que quedar en la MISMA carpeta que print-agent.exe (y el .env, si usás uno).

Set objFSO = CreateObject("Scripting.FileSystemObject")
strFolder = objFSO.GetParentFolderName(WScript.ScriptFullName)

Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = strFolder
objShell.Run """" & strFolder & "\print-agent.exe""", 0, False
