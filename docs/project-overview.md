# SeaWar 海战棋 - 项目架构文档

> 本文档生成于 2026-05-26，基于代码仓库最新状态编写。

---

## 1. 项目概述

**SeaWar（海战棋）** 是一款基于浏览器的 LAN 多人对战海战棋游戏，支持两名玩家在同一局域网下创建/加入房间进行对战。

| 属性 | 说明 |
|------|------|
| 运行时 | [Bun](https://bun.sh/) |
| 语言 | TypeScript |
| 前端框架 | 无（原生 DOM） |
| 通信协议 | WebSocket |
| 当前版本 | v1.0.1 |

---

## 2. 目录结构

```
SeaWar/
├── server.ts                 # 服务器入口：HTTP + WebSocket
├── package.json              # 依赖：bun-types, typescript
├── public/                   # 前端静态资源
│   ├── index.html            # 单页应用（4个Screen）
│   ├── client.ts             # 前端游戏逻辑与通信
│   ├── client.js             # client.ts 编译输出（手动维护）
│   └── style.css             # 深色主题样式
├── src/
│   ├── types.ts              # 全栈共享类型定义
│   └── server/
│       ├── message-handler.ts    # WebSocket 消息路由
│       ├── room-manager.ts       # 房间生命周期管理
│       ├── game-logic.ts         # 核心战斗逻辑
│       ├── ship-validator.ts     # 舰船摆放验证与随机生成
│       ├── shell-resolver.ts     # 特殊炮弹效果解析
│       └── item-spawner.ts       # 道具箱生成逻辑
├── dist/                     # 构建输出（Bun 编译）
└── docs/                     # 项目文档
```

---

## 3. 技术架构

### 3.1 整体架构

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│   Browser       │  ◄──────────────────────►  │   Bun Server     │
│  (client.ts)    │                            │  (server.ts)     │
│                 │                            │                  │
│  Lobby Screen   │                            │  message-handler │
│  Placement Scr  │                            │  room-manager    │
│  Battle Screen  │                            │  game-logic      │
└─────────────────┘                            └──────────────────┘
```

- **前端**：纯原生 TypeScript，无构建工具（`client.js` 为手工编译或持续维护）
- **后端**：Bun 原生 HTTP 服务器 + WebSocket，单文件入口 `server.ts`
- **通信**：JSON 文本消息，全双工 WebSocket

### 3.2 启动流程

```bash
bun --watch server.ts   # 开发模式（热重载）
bun server.ts           # 生产模式
```

服务器监听 `http://localhost:3000`：
1. 根路径 `/` 返回 `public/index.html`
2. `/client.js` 返回前端脚本
3. `/style.css` 返回样式表
4. `/ws` 路径升级为 WebSocket 连接

---

## 4. 前端架构（`public/`）

### 4.1 页面结构

`index.html` 采用单页应用模式，包含 4 个互斥的 `screen` div：

| Screen ID | 说明 |
|-----------|------|
| `#lobby` | 大厅：输入昵称、创建房间、输入房间号加入 |
| `#placement` | 舰船摆放：拖拽/点击摆放 5 艘舰船，支持旋转和随机摆放 |
| `#battle` | 战斗画面：双棋盘（己方海域 + 敌方海域）、炮弹选择、回合指示 |
| `#gameOverModal` | 结束弹窗：显示胜负、比分、再来一局/退出 |

### 4.2 前端状态（`client.ts`）

```typescript
// 核心状态
ws: WebSocket | null        // 连接实例
myId: string                // 当前玩家 ID
roomId: string              // 房间号
currentPhase: string        // 当前阶段
isMyTurn: boolean           // 是否我的回合
selectedShell: string|null  // 选中的特殊炮弹
placedShips: Ship[]         // 已摆放的舰船
inventory: string[]         // 持有的炮弹道具

// 棋盘 DOM 缓存
myBoardCells: HTMLDivElement[][]       // 己方棋盘单元格
enemyBoardCells: HTMLDivElement[][]    // 敌方棋盘单元格
placementBoardCells: HTMLDivElement[][] // 摆放棋盘单元格

// 棋盘认知状态
enemyBoardState: string[][]  // 'unknown' | 'hit' | 'miss' | 'item'
```

### 4.3 前端模块职责

| 模块 | 职责 |
|------|------|
| `connect()` | 建立 WebSocket，绑定 `onmessage` → `handleServerMessage()` |
| `send()` | 序列化 JSON 发送消息 |
| `handleServerMessage()` | 消息分发中心，根据 `msg.type` 路由到各处理器 |
| `initPlacementBoard()` | 生成 10x10 摆放棋盘，绑定点击/悬停事件 |
| `initBattleBoards()` | 生成双 10x10 战斗棋盘，绑定敌方棋盘点击事件 |
| `updateShellInventory()` | 根据 `inventory` 渲染炮弹按钮栏 |

### 4.4 交互设计

- **舰船摆放**：点击 palette 选择舰船尺寸 → 在棋盘上悬停预览（绿色=合法，红色=非法）→ 点击确认放置
- **旋转**：点击"旋转"按钮切换水平/垂直方向
- **开火**：选中炮弹类型（或默认普通炮弹）→ 点击敌方棋盘格子 → 等待服务器返回结果
- **道具拾取**：击中带有 `?` 标记的格子随机获得特殊炮弹

---

## 5. 后端架构（`src/server/`）

### 5.1 模块职责

| 文件 | 职责 |
|------|------|
| `server.ts` | HTTP 服务器入口，静态文件服务，WebSocket upgrade |
| `message-handler.ts` | WebSocket 消息解析与路由，协调各模块完成请求处理 |
| `room-manager.ts` | 房间 CRUD、玩家加入/离开、广播消息、房间清理定时器 |
| `game-logic.ts` | 核心规则：开火判定、炮弹效果、胜负判定、玩家/棋盘创建 |
| `ship-validator.ts` | 舰船摆放合法性验证（边界、重叠、间距、直线连续）、随机生成算法 |
| `shell-resolver.ts` | 三种特殊炮弹的坐标范围计算（十字、散射、核弹） |
| `item-spawner.ts` | 道具箱生成时机判定与随机位置选取 |

### 5.2 房间生命周期

```
 lobby（大厅）
    │
    ▼  第二名玩家加入
 placement（摆放舰船）
    │
    ▼  两名玩家都确认摆放
  battle（战斗中）
    │
    ▼  一方所有舰船被击沉
  ended（游戏结束）
    │
    ▼  双方都点击"再来一局"
 placement（重新开始）
```

### 5.3 核心数据结构

```typescript
// src/types.ts

interface Ship {
  id: string;
  size: number;        // 舰船长度（2~5）
  coords: Coord[];     // 占据的格子坐标
  hits: Coord[];       // 已被击中的坐标
  sunk: boolean;       // 是否沉没
}

interface Board {
  ships: Ship[];
  shots: Map<string, 'hit' | 'miss'>;  // 已开火记录
  items: Set<string>;                   // 道具箱位置
}

interface Player {
  id: string;
  name: string;
  board: Board;
  ready: boolean;       // 是否已确认摆放
  inventory: string[];  // 持有的特殊炮弹
}

interface Room {
  id: string;           // 6位数字房间号
  players: [Player|null, Player|null];
  phase: RoomPhase;     // 'lobby' | 'placement' | 'battle' | 'ended'
  currentTurn: string;  // 当前回合玩家 ID
  winner: string|null;
  turnCount: number;    // 回合计数（用于道具生成）
  playAgainVotes: Set<string>;
  scores: [number, number];
}
```

### 5.4 消息协议

#### 客户端 → 服务器（`ClientMessage`）

| 类型 | 说明 |
|------|------|
| `CREATE_ROOM` | 创建房间，附带玩家昵称 |
| `JOIN_ROOM` | 加入指定房间 |
| `PLACE_SHIPS` | 提交舰船摆放方案 |
| `PLACE_SHIPS_AUTO` | 请求服务器随机摆放 |
| `FIRE` | 向指定坐标开火 |
| `USE_SHELL` | 使用特殊炮弹攻击 |
| `PLAY_AGAIN` | 投票再来一局 |

#### 服务器 → 客户端（`ServerMessage`）

| 类型 | 说明 |
|------|------|
| `ROOM_CREATED` | 返回创建的房间号 |
| `PLAYER_ASSIGNED` | 分配玩家 ID |
| `ROOM_STATE` | 房间状态更新（玩家列表、阶段） |
| `GAME_START` | 游戏开始，通知先手玩家 |
| `FIRE_RESULT` | 开火结果（命中/miss、是否沉没、是否获得道具） |
| `SHELL_RESULT` | 特殊炮弹多点攻击结果 |
| `TURN_CHANGE` | 回合切换通知 |
| `ITEM_SPAWNED` | 新道具箱生成位置 |
| `INVENTORY_UPDATE` | 玩家炮弹库存更新 |
| `GAME_OVER` | 游戏结束（胜负、比分、揭晓所有舰船位置） |
| `RESTART_READY` | 双方同意重启，进入摆放阶段 |

---

## 6. 游戏机制

### 6.1 舰船配置

| 舰船 | 尺寸 | 数量 |
|------|------|------|
| 航母 | 5格 | 1 |
| 战列舰 | 4格 | 1 |
| 巡洋舰 | 3格 | 1 |
| 潜艇 | 3格 | 1 |
| 驱逐舰 | 2格 | 1 |

**摆放规则**：
- 舰船必须水平或垂直直线连续放置
- 舰船之间不能重叠
- 舰船之间不能正交相邻（斜对角可以）
- 棋盘大小：15 x 15（后端定义），但前端目前渲染为 10 x 10

### 6.2 特殊炮弹系统

| 炮弹 | 效果范围 | 说明 |
|------|----------|------|
| 普通炮弹 | 1格 | 默认无限使用 |
| 十字炮弹 (`cross`) | 中心 + 上下左右 共5格 | 十字形范围攻击 |
| 散射炮弹 (`multi`) | 中心 + 随机4格 | 在未被攻击过的格子里随机选4个 |
| 核弹 (`nuke`) | 菱形 13格 | 中心 5x5 菱形区域 |

**炮弹获取方式**：
- 开局赠送：2个十字炮弹
- 拾取道具箱：击中带有 `?` 标记的格子，随机获得一种特殊炮弹
- 道具箱从第5回合开始，每回合有 30% 概率生成

### 6.3 回合规则

- 命中且未击沉：继续当前玩家回合
- Miss 或击沉舰船：切换回合
- 使用特殊炮弹时，仅当中心格命中且未击沉时继续回合

### 6.4 胜负判定

一方所有舰船全部被击沉时游戏结束，击沉方获胜。比分系统记录多局胜负。

---

## 7. 已知问题与注意事项

### 7.1 前后端棋盘尺寸不一致

- **后端定义**：`BOARD_SIZE = 15`（`src/types.ts:69`）
- **前端渲染**：`client.ts` 中所有棋盘循环为 `10 x 10`
- **CSS 定义**：`style.css` 中 `.board` 为 `repeat(15, 32px)`

这导致前端实际只渲染了 10x10 的棋盘，但 CSS 预留了 15x15 的空间。建议统一为相同尺寸。

### 7.2 client.js 需要手动编译

`public/client.js` 是 `client.ts` 的手动编译产物，没有自动构建流程。修改 `client.ts` 后需要手动运行：

```bash
bun build ./public/client.ts --outfile ./public/client.js
```

### 7.3 WebSocket 断线处理

前端仅在 `onclose` 时弹出 alert 并刷新页面，没有重连机制。

### 7.4 内存管理

`room-manager.ts` 设置了 30 分钟超时清理，但仅基于房间创建时间，不基于最后活动时间。

---

## 8. 开发指南

### 8.1 添加新的特殊炮弹

1. **定义炮弹类型**：在 `src/types.ts` 的 `SHELL_TYPES` 数组中添加
2. **实现效果逻辑**：在 `src/server/shell-resolver.ts` 中新增解析函数
3. **接入游戏逻辑**：在 `src/server/game-logic.ts` 的 `useShell()` 中 case 分支调用
4. **前端展示**：在 `client.ts` 的 `updateShellInventory()` 和 CSS 中添加按钮样式

### 8.2 修改棋盘尺寸

需同步修改以下位置：
- `src/types.ts`：`BOARD_SIZE`
- `public/client.ts`：所有 `10` 的循环上限
- `public/style.css`：`.board` 的 `grid-template-columns/rows`

### 8.3 添加新消息类型

1. 在 `src/types.ts` 的 `ClientMessage` 或 `ServerMessage` 联合类型中添加
2. 在 `src/server/message-handler.ts` 的 `handleMessage()` switch 中处理
3. 在 `public/client.ts` 的 `handleServerMessage()` switch 中处理

---

## 9. 文件依赖图

```
server.ts
  ├── src/server/message-handler.ts
  │     ├── src/types.ts
  │     ├── src/server/ship-validator.ts
  │     │     └── src/types.ts
  │     ├── src/server/game-logic.ts
  │     │     ├── src/types.ts
  │     │     ├── src/server/shell-resolver.ts
  │     │     │     └── src/types.ts
  │     │     └── src/server/item-spawner.ts
  │     │           └── src/types.ts
  │     └── src/server/room-manager.ts
  │           ├── src/types.ts
  │           └── src/server/game-logic.ts
  │
  └── public/ (静态文件)
        ├── index.html
        ├── client.js
        └── style.css

public/client.ts
  └── src/types.ts (类型引用，编译时)
```

---

*文档结束*
