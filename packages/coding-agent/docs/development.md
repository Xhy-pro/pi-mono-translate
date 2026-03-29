＃ 发展

请参阅 [AGENTS.md](../../../AGENTS.md) 了解更多指南。

＃＃ 设置

```bash
git clone https://github.com/badlogic/pi-mono
cd pi-mono
npm install
npm run build
```

从源运行：

```bash
/path/to/pi-mono/pi-test.sh
```

该脚本可以从任何目录运行。 Pi 保留调用者当前的工作目录。

## 分叉/品牌重塑

通过 `package.json` 配置：

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

更改您的 fork 的 `name`、`configDir` 和 `bin` 字段。影响 CLI 横幅、配置路径和环境变量名称。

## 路径解析

三种执行模式：npm install、独立二进制文件、tsx from source。

**始终对包资源使用 `src/config.ts`**：

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

切勿直接将 `__dirname` 用于包资源。

## 调试命令

`/debug`（隐藏）写入 `~/.pi/agent/pi-debug.log`：
- 使用 ANSI 代码渲染 TUI 线
- 发送给法学硕士的最新消息

## 测试

```bash
./test.sh                         # Run non-LLM tests (no API keys needed)
npm test                          # Run all tests
npm test -- test/specific.test.ts # Run specific test
```

## 项目结构

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```
