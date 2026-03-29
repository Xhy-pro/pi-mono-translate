> pi 可以创造技能。要求它为您的用例构建一个。

# 技能

技能是代理按需加载的独立功能包。技能为特定任务提供专门的工作流程、设置说明、帮助脚本和参考文档。

Pi 实施 [Agent Skills standard](https://agentskills.io/specification)，对违规行为发出警告，但保持宽容。

＃＃ 目录

- [Locations](#locations)
- [How Skills Work](#how-skills-work)
- [Skill Commands](#skill-commands)
- [Skill Structure](#skill-structure)
- [Frontmatter](#frontmatter)
- [Validation](#validation)
- [Example](#example)
- [Skill Repositories](#skill-repositories)

## 地点

> **安全性：** 技能可以指示模型执行任何操作，并且可能包括模型调用的可执行代码。使用前查看技能内容。

Pi 从以下位置加载技能：

- 全球：
  - `~/.pi/agent/skills/`
  - `~/.agents/skills/`
- 项目：
  - `.pi/skills/`
  - `cwd` 和祖先目录中的 `.agents/skills/` （直到 git repo 根目录，或者不在 repo 中时的文件系统根目录）
- 包：`skills/` 目录或 `package.json` 中的 `pi.skills` 条目
- 设置：包含文件或目录的 `skills` 数组
- CLI：`--skill <path>`（可重复，可添加，甚至与 `--no-skills` 一起使用）

发现规则：
- 在 `~/.pi/agent/skills/` 和 `.pi/skills/` 中，直接根 `.md` 文件被发现为个人技能
- 在所有技能位置中，递归地发现包含 `SKILL.md` 的目录
- 在 `~/.agents/skills/` 和项目 `.agents/skills/` 中，根 `.md` 文件被忽略

使用 `--no-skills` 禁用发现（仍加载显式 `--skill` 路径）。

### 使用其他装备的技能

要使用 Claude Code 或 OpenAI Codex 中的技能，请将其目录添加到设置中：

```json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

对于项目级别的 Claude Code 技能，请添加到 `.pi/settings.json`：

```json
{
  "skills": ["../.claude/skills"]
}
```

## 技能如何发挥作用

1. 启动时，pi 扫描技能位置并提取名称和描述
2. 系统提示包含 XML 格式的可用技能（根据 [specification](https://agentskills.io/integrate-skills)）
3. 当任务匹配时，代理使用 `read` 加载完整的 SKILL.md（模型并不总是这样做；使用提示或 `/skill:name` 强制它）
4.代理按照说明操作，使用相对路径引用脚本和资产

这是渐进式披露：只有描述始终处于上下文中，完整的说明按需加载。

## 技能命令

技能注册为 `/skill:name` 命令：

```bash
/skill:brave-search           # Load and execute the skill
/skill:pdf-tools extract      # Load skill with arguments
```

命令后面的参数将作为 `User: <args>` 附加到技能内容中。

在交互模式或 `settings.json` 中通过 `/settings` 切换技能命令：

```json
{
  "enableSkillCommands": true
}
```

## 技能结构

技能是一个带有 `SKILL.md` 文件的目录。其他一切都是自由形式。

```
my-skill/
鈹溾攢鈹€ SKILL.md              # Required: frontmatter + instructions
鈹溾攢鈹€ scripts/              # Helper scripts
鈹?  鈹斺攢鈹€ process.sh
鈹溾攢鈹€ references/           # Detailed docs loaded on-demand
鈹?  鈹斺攢鈹€ api-reference.md
鈹斺攢鈹€ assets/
    鈹斺攢鈹€ template.json
```

### SKILL.md 格式

```markdown
---
name: my-skill
description: What this skill does and when to use it. Be specific.
---

# My Skill

## Setup

Run once before first use:
\`\`\`bash
cd /path/to/skill && npm install
\`\`\`

## Usage

\`\`\`bash
./scripts/process.sh <input>
\`\`\`
```

使用技能目录中的相对路径：

```markdown
See [the reference guide](references/REFERENCE.md) for details.
```

## 前题

根据 [Agent Skills specification](https://agentskills.io/specification#frontmatter-required)：

| 场地 | 必需的 | 描述 |
|-------|----------|-------------|
| `name` | 是的 | 最多 64 个字符。小写 a-z、0-9、连字符。必须匹配父目录。 |
| `description` | 是的 | 最多 1024 个字符。该技能的作用是什么以及何时使用它。 |
| `license` | 不 | 许可证名称或捆绑文件的引用。 |
| `compatibility` | 不 | 最多 500 个字符。环境要求。 |
| `metadata` | 不 | 任意键值映射。 |
| `allowed-tools` | 不 | 以空格分隔的预先批准的工具列表（实验性）。 |
| `disable-model-invocation` | 不 | 当`true`时，技能在系统提示中隐藏。用户必须使用 `/skill:name`。 |

### 命名规则

- 1-64 个字符
- 仅限小写字母、数字、连字符
- 没有前导/尾随连字符
- 没有连续的连字符
- 必须匹配父目录名称

有效：`pdf-processing`、`data-analysis`、`code-review`
无效：`PDF-Processing`、`-pdf`、`pdf--processing`

### 描述最佳实践

描述决定代理何时加载技能。具体一点。

好的：
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

贫穷的：
```yaml
description: Helps with PDFs.
```

＃＃ 验证

Pi 根据代理技能标准验证技能。大多数问题都会产生警告，但仍会加载技能：

- 名称与父目录不匹配
- 名称超过 64 个字符或包含无效字符
- 名称以连字符开头/结尾或具有连续的连字符
- 描述超过 1024 个字符

未知的 frontmatter 字段将被忽略。

**例外：** 缺少描述的技能不会加载。

名称冲突（不同位置的相同名称）会发出警告并保留找到的第一个技能。

＃＃ 例子

```
brave-search/
鈹溾攢鈹€ SKILL.md
鈹溾攢鈹€ search.js
鈹斺攢鈹€ content.js
```

**技能.md:**
```markdown
---
name: brave-search
description: Web search and content extraction via Brave Search API. Use for searching documentation, facts, or any web content.
---

# Brave Search

## Setup

\`\`\`bash
cd /path/to/brave-search && npm install
\`\`\`

## Search

\`\`\`bash
./search.js "query"              # Basic search
./search.js "query" --content    # Include page content
\`\`\`

## Extract Page Content

\`\`\`bash
./content.js https://example.com
\`\`\`
```

## 技能库

- [Anthropic Skills](https://github.com/anthropics/skills) - 文档处理（docx、pdf、pptx、xlsx）、Web 开发
- [Pi Skills](https://github.com/badlogic/pi-skills) - 网络搜索、浏览器自动化、Google API、转录
