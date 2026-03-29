# 计划模式扩展

用于安全代码分析的只读探索模式。

＃＃ 特征

- **只读工具**：限制可用工具读取、bash、grep、find、ls、question
- **Bash 允许列表**：仅允许只读 bash 命令
- **计划提取**：从 `Plan:` 部分中提取编号的步骤
- **进度跟踪**：小部件在执行过程中显示完成状态
- **[DONE:n] 标记**：显式步骤完成跟踪
- **会话持久性**：状态在会话恢复后仍然存在

## 命令

- `/plan` - 切换计划模式
- `/todos` - 显示当前计划进度
- `Ctrl+Alt+P` - 切换计划模式（快捷方式）

＃＃ 用法

1. 使用 `/plan` 或 `--plan` 标志启用计划模式
2.要求代理分析代码并制定计划
3. 代理应在 `Plan:` 标题下输出编号计划：

```
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. 出现提示时选择“执行计划”
5. 在执行过程中，代理使用 `[DONE:n]` 标签将步骤标记为完成
6.进度小部件显示完成状态

## 它是如何工作的

### 计划模式（只读）
- 仅提供只读工具
- 通过白名单过滤的 Bash 命令
- 代理创建计划而不进行更改

### 执行模式
- 恢复完整的工具访问权限
- 代理按顺序执行步骤
- `[DONE:n]` 标记跟踪完成情况
- 小部件显示进度

### 命令白名单

安全命令（允许）：
- 文件检查：`cat`、`head`、`tail`、`less`、`more`
- 搜索：`grep`、`find`、`rg`、`fd`
- 目录：`ls`、`pwd`、`tree`
- Git 读取：`git status`、`git log`、`git diff`、`git branch`
- 包装信息：`npm list`、`npm outdated`、`yarn info`
- 系统信息：`uname`、`whoami`、`date`、`uptime`

被阻止的命令：
- 文件修改：`rm`、`mv`、`cp`、`mkdir`、`touch`
- Git 写入：`git add`、`git commit`、`git push`
- 软件包安装：`npm install`、`yarn add`、`pip install`
- 系统：`sudo`、`kill`、`reboot`
- 编辑：`vim`、`nano`、`code`
