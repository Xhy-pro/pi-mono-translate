# 文物服务器

通过 Cloudflare Tunnel 公开共享 HTML 文件、可视化和交互式演示，并支持实时重新加载。

## 这是什么？

工件服务器允许妈妈创建 HTML/JS/CSS 文件，您可以立即在浏览器中查看这些文件，并使用基于 WebSocket 的实时重新加载进行开发。非常适合仪表板、可视化、原型和交互式演示。

＃＃ 安装

### 1.安装依赖项

**Node.js 包：**
```bash
cd /workspace/artifacts
npm init -y
npm install express ws chokidar
```

**Cloudflare（Cloudflare 隧道）：**
```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared --version
```

### 2.创建服务器

将其保存为 `/workspace/artifacts/server.js`：

```javascript
#!/usr/bin/env node

const express = require('express');
const { WebSocketServer } = require('ws');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 8080;
const FILES_DIR = path.join(__dirname, 'files');

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, clientTracking: true });

// Track connected WebSocket clients
const clients = new Set();

// WebSocket connection handler with error handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);
  
  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
    clients.delete(ws);
  });
  
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });
});

wss.on('error', (err) => {
  console.error('WebSocket server error:', err.message);
});

// Watch for file changes
const watcher = chokidar.watch(FILES_DIR, {
  persistent: true,
  ignoreInitial: true,
  depth: 99, // Watch all subdirectory levels
  ignorePermissionErrors: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50
  }
});

watcher.on('all', (event, filepath) => {
  console.log(`File ${event}: ${filepath}`);
  
  // If a new directory is created, explicitly watch it
  // This ensures newly created artifact folders are monitored without restart
  if (event === 'addDir') {
    watcher.add(filepath);
    console.log(`Now watching directory: ${filepath}`);
  }
  
  const relativePath = path.relative(FILES_DIR, filepath);
  const message = JSON.stringify({
    type: 'reload',
    file: relativePath
  });
  
  clients.forEach(client => {
    if (client.readyState === 1) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error sending to client:', err.message);
        clients.delete(client);
      }
    } else {
      clients.delete(client);
    }
  });
});

watcher.on('error', (err) => {
  console.error('File watcher error:', err.message);
});

// Cache-busting headers
app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// Inject live reload script for HTML files with ?ws=true
app.use((req, res, next) => {
  if (!req.path.endsWith('.html') || req.query.ws !== 'true') {
    return next();
  }
  
  const filePath = path.join(FILES_DIR, req.path);
  
  // Security: Prevent path traversal attacks
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(FILES_DIR);
  if (!resolvedPath.startsWith(resolvedBase)) {
    return res.status(403).send('Forbidden: Path traversal detected');
  }
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return next();
    }
    
    const liveReloadScript = `
<script>
(function() {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;bottom:10px;left:10px;background:rgba(0,150,0,0.9);color:white;padding:15px;border-radius:8px;font-family:monospace;font-size:12px;max-width:90%;z-index:9999;word-break:break-all';
  errorDiv.textContent = 'Live reload: connecting...';
  document.body.appendChild(errorDiv);
  
  function showStatus(msg, isError) {
    errorDiv.textContent = msg;
    errorDiv.style.background = isError ? 'rgba(255,0,0,0.9)' : 'rgba(0,150,0,0.9)';
    if (!isError) setTimeout(() => errorDiv.style.display = 'none', 3000);
  }
  
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = protocol + window.location.host;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => showStatus('Live reload connected!', false);
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'reload') {
        showStatus('File changed, reloading...', false);
        setTimeout(() => window.location.reload(), 500);
      }
    };
    ws.onerror = () => showStatus('Connection failed', true);
    ws.onclose = (e) => showStatus('Disconnected: ' + e.code, true);
  } catch (err) {
    showStatus('Error: ' + err.message, true);
  }
})();
</script>`;
    
    if (data.includes('</body>')) {
      data = data.replace('</body>', liveReloadScript + '</body>');
    } else {
      data = data + liveReloadScript;
    }
    
    res.type('html').send(data);
  });
});

// Serve static files
app.use(express.static(FILES_DIR));

// Error handling
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(500).send('Internal server error');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', err.message);
  }
});

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing gracefully');
  watcher.close();
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing gracefully');
  watcher.close();
  server.close(() => process.exit(0));
});

// Start server
server.listen(PORT, () => {
  console.log(`Artifacts server running on http://localhost:${PORT}`);
  console.log(`Serving files from: ${FILES_DIR}`);
  console.log(`Add ?ws=true to any URL for live reload`);
});
```

使可执行：
```bash
chmod +x /workspace/artifacts/server.js
```

### 3.创建启动脚本

将其保存为 `/workspace/artifacts/start-server.sh`：

```bash
#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting artifacts server..."

# Start Node.js server in background
node server.js > /tmp/server.log 2>&1 &
NODE_PID=$!

# Wait for server to be ready
sleep 2

# Start cloudflare tunnel
echo "Starting Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:8080 2>&1 | tee /tmp/cloudflared.log &
TUNNEL_PID=$!

# Wait for tunnel to establish
sleep 5

# Extract and display public URL
PUBLIC_URL=$(grep -o 'https://.*\.trycloudflare\.com' /tmp/cloudflared.log | head -1)

if [ -n "$PUBLIC_URL" ]; then
  echo ""
  echo "=========================================="
  echo "Artifacts server is running!"
  echo "=========================================="
  echo "Public URL: $PUBLIC_URL"
  echo "Files directory: $SCRIPT_DIR/files/"
  echo ""
  echo "Add ?ws=true to any URL for live reload"
  echo "Example: $PUBLIC_URL/test.html?ws=true"
  echo "=========================================="
  echo ""
  
  echo "$PUBLIC_URL" > /tmp/artifacts-url.txt
else
  echo "Warning: Could not extract public URL"
fi

# Keep script running
cleanup() {
  echo "Shutting down..."
  kill $NODE_PID 2>/dev/null || true
  kill $TUNNEL_PID 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM
wait $NODE_PID $TUNNEL_PID
```

使可执行：
```bash
chmod +x /workspace/artifacts/start-server.sh
```

## 目录结构

```
/workspace/artifacts/
鈹溾攢鈹€ server.js              # Node.js server
鈹溾攢鈹€ start-server.sh        # Startup script
鈹溾攢鈹€ package.json           # Dependencies
鈹溾攢鈹€ node_modules/          # Installed packages
鈹斺攢鈹€ files/                 # PUT YOUR ARTIFACTS HERE
    鈹溾攢鈹€ 2025-12-14-demo/
    鈹?  鈹溾攢鈹€ index.html
    鈹?  鈹溾攢鈹€ style.css
    鈹?  鈹斺攢鈹€ logo.png
    鈹溾攢鈹€ 2025-12-15-chart/
    鈹?  鈹斺攢鈹€ index.html
    鈹斺攢鈹€ test.html (standalone OK)
```

＃＃ 用法

### 启动服务器

```bash
cd /workspace/artifacts
./start-server.sh
```

这将：
1. 在 localhost:8080 上启动 Node.js 服务器
2. 使用公共 URL 创建 Cloudflare 隧道
3. 打印 URL（例如 `https://random-words-123.trycloudflare.com`）
4. 将 URL 保存到 `/tmp/artifacts-url.txt`

**注意：** 每次重新启动时，URL 都会更改（免费 Cloudflare Tunnel 限制）。

### 创建工件

**文件夹组织：**
- 每个工件创建一个子文件夹：`$(date +%Y-%m-%d)-description/`
- 将主文件设置为 `index.html` 以获得干净的 URL
- 在同一文件夹中包含图像、CSS、JS、数据
- CDN 资源（Tailwind、Three.js 等）工作正常

**例子：**
```bash
mkdir -p /workspace/artifacts/files/$(date +%Y-%m-%d)-dashboard
cat > /workspace/artifacts/files/$(date +%Y-%m-%d)-dashboard/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white p-8">
    <h1 class="text-4xl font-bold">My Dashboard</h1>
    <img src="logo.png" alt="Logo">
</body>
</html>
EOF
```

**访问：**
- **重要：** 始终使用完整的 `index.html` 路径进行实时重新加载工作
- 开发（实时重新加载）：`https://your-url.trycloudflare.com/2025-12-14-dashboard/index.html?ws=true`
- 分享（静态）：`https://your-url.trycloudflare.com/2025-12-14-dashboard/index.html`

**注意：** 文件夹 URL (`/folder/`) 不会注入 WebSocket 脚本，必须使用 `/folder/index.html`

### 实时重新加载

使用 `?ws=true` 查看时：
1. 您会在左下角看到一个绿色框：“实时重新加载已连接！”
2. 编辑artifact文件夹中的任意文件
3. 页面1秒内自动重新加载
4. 非常适合迭代设计

**共享时删除 `?ws=true`** - 观看者没有 WebSocket 开销。

## 它是如何工作的

**架构：**
- Node.js 服务器 (Express) 提供来自 `/workspace/artifacts/files/` 的静态文件
- Chokidar 文件观察器监视更改（包括新目录）
- WebSocket 向连接的客户端广播重新加载消息
- Cloudflare Tunnel 通过公共 HTTPS URL 将本地主机公开到互联网
- 当检测到文件更改时，客户端脚本自动重新加载浏览器

**安全：**
- 路径遍历保护可防止访问 `files/` 目录之外的内容
- 仅提供 `/workspace/artifacts/files/` 中的文件
- 缓存破坏标头可防止陈旧内容

**文件观看：**
- 自动检测服务器启动后创建的新工件文件夹
- 递归地监视所有子目录（深度：99）
- 创建新项目时无需重新启动服务器

## 故障排除

**502 错误网关：**
- 节点服务器崩溃。检查日志：`cat /tmp/server.log`
- 重新启动：`cd /workspace/artifacts && node server.js &`

**WebSocket 未连接：**
- 检查浏览器控制台是否有错误
- 确保 `?ws=true` 在 URL 中
- 左下角的红色/黄色框显示连接错误
- 使用完整的 `index.html` 路径，而不是文件夹 URL

**文件未更新：**
- 检查文件观察器日志：`tail /tmp/server.log`
- 确保文件位于 `/workspace/artifacts/files/` 中
- 应该在日志中看到“文件更改：”消息

**端口已在使用：**
- 杀死现有服务器：`pkill node`
- 等待2秒，重新启动

**浏览器缓存问题：**
- 服务器发送无缓存标头
- 硬刷新：Ctrl+Shift+R
- 添加版本参数：`?ws=true&v=2`

## 会话示例

**您：**“使用 Tailwind UI 创建 Three.js 旋转立方体演示”

**妈妈创造：**
```
/workspace/artifacts/files/2025-12-14-threejs-cube/
鈹溾攢鈹€ index.html (Three.js from CDN, Tailwind from CDN)
鈹斺攢鈹€ screenshot.png
```

**访问：** `https://concepts-rome-123.trycloudflare.com/2025-12-14-threejs-cube/index.html?ws=true`

**你：**“将立方体变成紫色并添加网格”

**妈妈：** 编辑 `index.html`

**结果：** 您的浏览器自动重新加载，显示带有网格的紫色立方体（1秒内）

## 技术说明

**为什么不是 Node.js fs.watch？**
- `fs.watch` 和 `recursive: true` 仅适用于 macOS/Windows
- 在Linux（Docker）上，不支持递归观看
- Chokidar是最可靠的跨平台解决方案
- 我们在检测到时明确添加新目录以确保监控

**WebSocket 与服务器发送的事件：**
- WebSocket 通过 Cloudflare Tunnel 可靠地工作
- 当任何文件更改时，所有连接的客户端都会重新加载（简单方法）
- 对于生产，您可以按当前页面路径进行过滤

**Cloudflare 隧道免费套餐：**
- 每次重新启动时随机子域更改
- 没有付费帐户就没有持久的 URL
- 尽管是免费套餐，但 WebSocket 支持仍然可靠
