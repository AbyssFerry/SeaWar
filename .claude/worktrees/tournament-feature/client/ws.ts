import type { ServerMessage } from '../src/types';

let ws: WebSocket | null = null;
let messageHandler: ((msg: ServerMessage) => void) | null = null;

export function initWebSocket(handler: (msg: ServerMessage) => void) {
  messageHandler = handler;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    const msg: ServerMessage = JSON.parse(event.data);
    if (messageHandler) messageHandler(msg);
  };

  ws.onclose = () => {
    alert('连接已断开，请刷新页面重试');
    location.reload();
  };

  ws.onerror = () => {
    alert('WebSocket 错误');
  };
}

export function send(msg: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function closeConnection() {
  if (ws) ws.close();
}
