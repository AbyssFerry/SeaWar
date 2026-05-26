# SeaWar

SeaWar 是一个局域网多人海战棋游戏。后端使用 Bun 和 WebSocket 提供房间、回合、炮弹和胜负结算，前端在浏览器中运行。

## 玩法简介

1. 一名玩家创建房间，另一名玩家输入房间号加入。
2. 双方摆放自己的舰船，可以手动摆放，也可以随机摆放。
3. 双方确认后进入战斗，每回合选择敌方海域中的格子开火。
4. 命中、击沉和特殊炮弹会影响战局。
5. 一方舰队被全部击沉后游戏结束，弹出胜负和比分。

## 下载 Windows 版

打开 GitHub Release 页面：

https://github.com/AbyssFerry/SeaWar/releases/tag/v1.0.0

下载 `SeaWar-1.0.0-windows-x64.zip`，解压后运行 `SeaWar.exe`。

运行后在浏览器打开：

```text
http://localhost:3000
```

如果要在局域网内让其他设备加入，请让对方访问运行服务器这台电脑的局域网地址，例如：

```text
http://192.168.1.10:3000
```

## 从源码运行

安装依赖：

```powershell
bun install
```

构建浏览器脚本：

```powershell
bun run build
```

启动服务器：

```powershell
bun run start
```

然后打开 `http://localhost:3000`。

## 构建 Windows 发布包

```powershell
bun run build:release
```

构建完成后会生成：

```text
release/SeaWar-1.0.0-windows-x64.zip
```

压缩包内包含可直接运行的 `SeaWar.exe`。
