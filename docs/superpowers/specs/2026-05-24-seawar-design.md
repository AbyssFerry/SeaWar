# SeaWar 海战棋 — 设计文档

## 1. 概述

局域网双人对战海战棋游戏，基于 TypeScript + Bun 构建，浏览器访问。

## 2. 技术栈

| 层级 | 技术 |
|-----|------|
| 运行时 | Bun |
| 语言 | TypeScript |
| 前端渲染 | DOM CSS Grid |
| 网络通信 | Bun 原生 WebSocket |
| 状态存储 | 内存（Map）|
| 依赖 | 零外部依赖 |

## 3. 架构

单进程 Bun 应用，`server.ts` 同时提供 HTTP 静态文件服务和 WebSocket 游戏服务。

```
┌─────────────────────────────────────────┐
│           Bun Server (server.ts)         │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ HTTP Static  │  │ WebSocket Handler │ │
│  │  (public/*)  │  │  (游戏逻辑 + 状态) │ │
│  └──────────────┘  └──────────────────┘ │
│                    ┌──────────────────┐ │
│                    │   内存状态存储     │ │
│                    │  Map<roomId, Room>│ │
│                    └──────────────────┘ │
└─────────────────────────────────────────┘
        ↑                        ↑
   浏览器玩家A              浏览器玩家B
```

## 4. 文件结构

```
SeaWar/
├── server.ts              # Bun 入口：HTTP + WebSocket + 游戏逻辑
├── package.json           # { "dependencies": {} }
├── tsconfig.json
└── public/
    ├── index.html         # 单页应用
    ├── style.css          # 棋盘、舰船、特效样式
    └── client.ts          # 前端：连接、UI、交互
```

## 5. 游戏规则

### 5.1 基础规则

- **棋盘**：10×10 格子，坐标 (0-9, 0-9)
- **舰船配置**：
  - 航空母舰：5格 × 1
  - 战列舰：4格 × 1
  - 巡洋舰：3格 × 2
  - 驱逐舰：2格 × 1
- **摆放规则**：
  - 舰船不可越界、不可重叠
  - 舰船之间必须至少间隔一格（包括对角方向）
  - 支持手动摆放（点击放置、拖拽、旋转）和随机自动生成
- **回合规则**：
  - 命中敌方舰船 → 继续射击
  - 未命中 → 回合交给对方
- **胜利条件**：击沉敌方全部舰船

### 5.2 道具系统

#### 道具生成

- **触发时机**：游戏进行满 **5 回合后**（当前回合数 ≥ 5），每回合有 **30%** 概率生成道具
- **生成范围**：双方棋盘**各自独立**生成一个道具（触发时双方都有）
- **生成位置**：随机选择**未被攻击过**的格子（可以是有船的格子）
- **视觉表现**：该格子显示为 "?"
- **持续规则**：道具一直保留在棋盘上，直到被射击触发

#### 开局赠送

- 对战开始时，每位玩家**初始获得 2 个十字炸弹**

#### 道具触发

射击到 "?" 格子时：
1. **必定获得一枚随机炮弹**（存入库存）
2. **单独判定是否命中舰船**（正常伤害逻辑）

#### 炮弹库存

- 可同时持有**多个炮弹**，**无上限**
- 在自己的回合可以选择使用某枚炮弹，或进行普通攻击
- **不跨局保留**（再来一局时清空）

#### 炮弹类型

| 炮弹 | 效果 |
|-----|------|
| **十字炸弹** | 以目标为中心，攻击自身及上下左右共 **5 格** |
| **多头炮弹** | 攻击目标格子的同时，**随机攻击地图上另外 4 个未被攻击的格子** |
| **核弹** | 攻击 **13 格菱形区域**，形状如下（每行格数 1-3-5-3-1）：<br>`  X  `<br>` X X X `<br>`X X X X X`<br>` X X X `<br>`  X  ` |

## 6. 游戏状态机

```
创建房间 ──→ 等待玩家 ──→ 双方就绪 ──→ 摆放阶段 ──→ 对战阶段 ──→ 游戏结束
   ↑           (1人)       (2人)       (各自摆船)    (轮流射击)     (一方获胜)
   │                                                      │
   │                                                      │
   └── 掉线/离开 ←─────────────────────────────────────────┘
                            ↑
                            └── 双方都点"再来一局" ──→ 回到摆放阶段
```

## 7. 网络协议

WebSocket 通信，JSON 格式，所有消息含 `type` 字段。

### 7.1 客户端 → 服务器

| 消息类型 |  payload | 说明 |
|---------|---------|------|
| `CREATE_ROOM` | `{ playerName: string }` | 创建房间 |
| `JOIN_ROOM` | `{ roomId: string, playerName: string }` | 加入房间 |
| `LEAVE_ROOM` | `{}` | 离开房间 |
| `READY` | `{}` | 准备好（进入摆放）|
| `PLACE_SHIPS` | `{ ships: Ship[] }` | 提交舰船摆放方案 |
| `PLACE_SHIPS_AUTO` | `{}` | 请求系统随机摆放 |
| `FIRE` | `{ x: number, y: number }` | 普通攻击 |
| `USE_SHELL` | `{ shellType: string, x: number, y: number }` | 使用炮弹 |
| `PLAY_AGAIN` | `{}` | 请求再来一局 |

### 7.2 服务器 → 客户端

| 消息类型 | payload | 说明 |
|---------|---------|------|
| `ROOM_CREATED` | `{ roomId: string }` | 房间创建成功 |
| `ROOM_STATE` | `{ roomId, players[], phase }` | 房间状态更新 |
| `GAME_START` | `{ firstTurn: string }` | 双方摆放完成，游戏开始 |
| `FIRE_RESULT` | `{ x, y, result: 'hit'|'miss', shipSunk?, gotShell?, shellType? }` | 射击结果 |
| `SHELL_RESULT` | `{ type, targets: {x,y,result}[], gotShell?, shellType? }` | 炮弹效果结果 |
| `TURN_CHANGE` | `{ currentTurn: string }` | 回合切换 |
| `ITEM_SPAWNED` | `{ positions: {x,y}[] }` | 道具生成通知 |
| `INVENTORY_UPDATE` | `{ shells: string[] }` | 炮弹库存更新 |
| `GAME_OVER` | `{ winner: string, reason: string }` | 游戏结束 |
| `RESTART_READY` | `{}` | 双方确认，回到摆放阶段 |
| `OPPONENT_LEFT` | `{}` | 对手离开 |
| `ERROR` | `{ message: string }` | 错误提示 |

## 8. 数据模型

```typescript
// 坐标
type Coord = { x: number; y: number };

// 舰船
type Ship = {
  id: string;
  size: number;
  coords: Coord[];
  hits: Coord[];
  sunk: boolean;
};

// 棋盘格子状态
type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'item';

// 棋盘
type Board = {
  ships: Ship[];
  shots: Map<string, 'hit' | 'miss'>; // key: "x,y"
  items: Set<string>; // 道具位置 "x,y"
};

// 玩家
type Player = {
  id: string;
  name: string;
  ws: ServerWebSocket;
  board: Board;
  ready: boolean;
  inventory: string[]; // 持有的炮弹类型
};

// 房间
type Room = {
  id: string; // 6位数字
  players: [Player?, Player?];
  phase: 'lobby' | 'placement' | 'battle' | 'ended';
  currentTurn: string; // 玩家ID
  winner: string | null;
  turnCount: number;
  playAgainVotes: Set<string>;
  createdAt: number;
};
```

## 9. 后端模块

| 模块 | 职责 |
|-----|------|
| `RoomManager` | 创建/查找/销毁房间，6位房间号生成，超时清理 |
| `ShipValidator` | 验证舰船摆放合法性（边界、重叠、间隔规则）|
| `ItemSpawner` | 5回合后每回合30%概率在双方棋盘生成道具 |
| `ShellResolver` | 解析炮弹效果范围（十字/多头/核弹）|
| `GameLogic` | 判定命中/击沉/胜负，处理道具触发，管理回合 |
| `MessageRouter` | 根据消息类型分发到对应处理器 |

## 10. 前端模块

| 模块 | 职责 |
|-----|------|
| `Connection` | WebSocket 连接、心跳、断线检测 |
| `LobbyUI` | 大厅：创建房间、输入房间号加入、显示房间号 |
| `PlacementUI` | 摆放界面：己方棋盘、舰船选择、拖拽/点击放置、旋转、随机按钮 |
| `BattleUI` | 对战界面：左右双棋盘（己方左、敌方右）、炮弹选择栏、回合提示 |
| `GameRenderer` | DOM Grid 渲染：棋盘格子、舰船、命中/未命中标记、道具标记 |

## 11. 错误处理

| 场景 | 处理 |
|-----|------|
| 房间已满 | `ERROR: room_full` |
| 房间不存在 | `ERROR: room_not_found` |
| 非法射击 | `ERROR: invalid_fire`（越界/重复/非自己回合）|
| 非法摆放 | `ERROR: invalid_placement` |
| WebSocket 断线 | 广播 `OPPONENT_LEFT`，销毁房间 |
| 房间空闲超 30 分钟 | RoomManager 自动清理 |

## 12. 断线规则

一方断开连接（关闭页面、刷新、网络中断）后：
- 立即广播 `OPPONENT_LEFT` 给另一方
- 房间标记为结束状态
- 不支持断线重连

## 13. 再来一局

游戏结束后：
- 双方界面显示"再来一局"按钮
- 双方都点击后，房间回到 `placement` 阶段
- 重置棋盘、清空炮弹库存、重置回合计数
- 保留房间号和玩家身份