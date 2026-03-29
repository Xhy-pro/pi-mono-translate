# Windows 设置

Pi 需要 Windows 上的 bash shell。检查地点（按顺序）：

1.来自`~/.pi/agent/settings.json`的自定义路径
2.Git Bash (`C:\Program Files\Git\bin\bash.exe`)
3. 路径上的 `bash.exe`（Cygwin、MSYS2、WSL）

对于大多数用户来说，[Git for Windows](https://git-scm.com/download/win) 就足够了。

## 自定义 Shell 路径

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```
