# 例子

pi-coding-agent SDK 和扩展的示例代码。

## 目录

### [sdk/](sdk/)
通过 `createAgentSession()` 进行编程使用。展示如何自定义模型、提示、工具、扩展和会话管理。

### [extensions/](extensions/)
示例扩展演示：
- 生命周期事件处理程序（工具拦截、安全门、上下文修改）
- 自定义工具（待办事项列表、问题、子代理、输出截断）
- 命令和键盘快捷键
- 自定义用户界面（页脚、页眉、编辑器、覆盖层）
- Git 集成（检查点、自动提交）
- 系统提示修改和自定义压缩
- 外部集成（SSH、文件观察器、系统主题同步）
- 自定义提供商（带有自定义流的 Anthropic、GitLab Duo）

## 文档

- [SDK Reference](sdk/README.md)
- [Extensions Documentation](../docs/extensions.md)
- [Skills Documentation](../docs/skills.md)
