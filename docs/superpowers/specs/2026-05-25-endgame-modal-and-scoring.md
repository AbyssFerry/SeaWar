# 游戏结束模态框 + 计分系统 — 设计文档

## 1. 概述

改进游戏结束体验：
1. 游戏结束后停留在战斗页面，弹出模态框选择再来一局或退出
2. 双方海域显示所有舰船位置（已击沉 + 未击沉）
3. 同一房间内累计比分

## 2. 计分系统

### 数据模型

```typescript
// Room 新增字段
type Room = {
  // ... existing fields
  scores: [number, number]; // 对应 players[0], players[1]
};
```

### 规则

- 房间创建时 `scores = [0, 0]`
- `GAME_OVER` 时，winner 对应的 index +1
- `resetRoomForRestart` 时 **保留** scores
- 玩家退出房间时 scores 随房间销毁而消失

### 显示

- 位置：战斗页面顶部，`turn-indicator` 左侧
- 格式：简洁数字 `1 : 0`
- 更新时机：`GAME_OVER` 时随消息更新

### 协议变更

```typescript
// GAME_OVER 新增 scores
| { type: 'GAME_OVER'; winner: string; reason: string; scores: number[] }
```

## 3. 游戏结束模态框

### 行为

- 不跳离 `#battle` 页面
- `GAME_OVER` 到达时，在战斗页面上叠加半透明遮罩 + 居中弹窗
- 弹窗内容：
  - 标题：「胜利！」或「失败！」
  - 比分：`2 : 1`
  - 按钮：「再来一局」「退出」
- 点击遮罩或按 ESC **不关闭**弹窗（必须二选一）

### 退出按钮

- 断开 WebSocket
- 回到大厅（`#lobby`）
- 发送 `LEAVE_ROOM` 给服务器

### 再来一局按钮

- 与现有逻辑一致：发送 `PLAY_AGAIN`
- 双方都点击后，`RESTART_READY` 到达，关闭模态框，清空海域，回到摆放阶段

## 4. 游戏结束后显示所有舰船

### 规则

游戏结束后，双方海域应显示**所有**舰船位置：
- 己方海域：正常显示（已实现）
- 敌方海域：
  - 已击沉的：保持 `.sunk` 样式
  - 未击沉的：添加 `.ship-revealed` 样式（半透明蓝色 `#4a90d9` + `opacity: 0.5`）

### 数据流

前端不知道敌方未击沉船的位置，需要服务器在 `GAME_OVER` 时发送：

```typescript
// GAME_OVER 新增 revealShips
| { type: 'GAME_OVER'; winner: string; reason: string; scores: number[]; revealShips: { playerId: string; ships: Ship[] }[] }
```

前端收到后：
- 遍历 `revealShips`
- 如果是敌方船（`playerId !== myId`），在 `enemyBoard` 上渲染未击沉的船
- 如果是己方船（`playerId === myId`），在 `myBoard` 上确保所有船都已显示

## 5. 修改清单

### 后端

| 文件 | 修改 |
|-----|------|
| `src/types.ts` | Room 添加 `scores`; GAME_OVER 添加 `scores` 和 `revealShips` |
| `src/server/room-manager.ts` | `createRoom` 初始化 `scores: [0, 0]`; `resetRoomForRestart` 保留 scores |
| `src/server/message-handler.ts` | `handleFire` 和 `handleUseShell` 的 GAME_OVER 广播附带 scores 和 revealShips |

### 前端

| 文件 | 修改 |
|-----|------|
| `public/index.html` | 在 `#battle` 内添加模态框 DOM |
| `public/style.css` | 模态框样式、遮罩样式、`.ship-revealed` 样式、比分显示样式 |
| `public/client.js` | `handleServerMessage` 中处理 GAME_OVER 显示模态框和船位；显示比分；处理退出按钮 |
