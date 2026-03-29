# DOOM 叠加演示

在 pi 中将《DOOM》作为叠加层来玩。证明叠加系统可以处理 35 FPS 的实时游戏渲染。

＃＃ 用法

```bash
pi --extension ./examples/extensions/doom-overlay
```

然后运行：
```
/doom-overlay
```

共享软件 WAD 文件 (~4MB) 会在首次运行时自动下载。

## 控制

| 行动 | 按键 |
|--------|------|
| 移动 | WASD 或箭头键 |
| 跑步 | Shift + WASD |
| 火 | F 或 Ctrl |
| 使用/打开 | 空间 |
| 武器 | 1-7 |
| 地图 | 选项卡 |
| 菜单 | 逃脱 |
| 暂停/退出 | Q |

## 它是如何工作的

DOOM 作为从 [doomgeneric](https://github.com/ozkl/doomgeneric) 编译的 WebAssembly 运行。每个帧都使用 24 位颜色的半块字符 (-) 进行渲染，其中顶部像素是前景色，底部像素是背景色。

覆盖层使用：
- `width: "90%"` - 端子宽度的 90%
- `maxHeight: "80%"` - 最大端子高度的 80%
- `anchor: "center"` - 以终端为中心

高度根据宽度计算，以保持 DOOM 的 3.2:1 宽高比（考虑半块渲染）。

## 学分

- [id Software](https://github.com/id-Software/DOOM) 代表原版《DOOM》
- [doomgeneric](https://github.com/ozkl/doomgeneric) 用于便携式 DOOM 实现
- [pi-doom](https://github.com/badlogic/pi-doom) 用于原始 pi 积分
