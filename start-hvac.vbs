Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\HomeX64\Documents\hvac-calc"
sh.Run "node serve.js", 0, False
WScript.Sleep 1200
sh.Run "http://localhost:5500", 1, False
