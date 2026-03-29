> pi 可以创建提示模板。要求它为您的工作流程构建一个。

# 提示模板

提示模板是可扩展为完整提示的 Markdown 片段。在编辑器中键入 `/name` 以调用模板，其中 `name` 是不带 `.md` 的文件名。

## 地点

Pi 从以下位置加载提示模板：

- 全球：`~/.pi/agent/prompts/*.md`
- 项目：`.pi/prompts/*.md`
- 包：`prompts/` 目录或 `package.json` 中的 `pi.prompts` 条目
- 设置：包含文件或目录的 `prompts` 数组
- CLI：`--prompt-template <path>`（可重复）

使用 `--no-prompt-templates` 禁用发现。

＃＃ 格式

```markdown
---
description: Review staged git changes
---
Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps
```

- 文件名成为命令名。 `review.md` 变为 `/review`。
- `description` 是可选的。如果丢失，则使用第一个非空行。

＃＃ 用法

在编辑器中键入 `/`，后跟模板名称。自动完成显示可用模板和描述。

```
/review                           # Expands review.md
/component Button                 # Expands with argument
/component Button "click handler" # Multiple arguments
```

## 参数

模板支持位置参数和简单切片：

- `$1`, `$2`, ... 位置参数
- `$@` 或 `$ARGUMENTS` 对于所有加入的参数
- `${@:N}` 用于第 N 个位置的参数（1 索引）
- `${@:N:L}` 代表从 N 开始的 `L` 参数

例子：

```markdown
---
description: Create a component
---
Create a React component named $1 with features: $@
```

用法：`/component Button "onClick handler" "disabled support"`

## 加载规则

- `prompts/` 中的模板发现是非递归的。
- 如果您想要子目录中的模板，请通过 `prompts` 设置或包清单显式添加它们。
