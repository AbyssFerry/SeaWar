import { handleMessage, handleClose } from './src/server/message-handler';

Bun.serve({
  port: 3000,
  fetch(req, server) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // WebSocket upgrade
    if (pathname === '/ws') {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined;
    }

    // Static files
    if (pathname === '/' || pathname === '/index.html') {
      return new Response(Bun.file('./public/index.html'));
    }
    if (pathname === '/client.js') {
      return new Response(Bun.file('./public/client.js'), {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
    if (pathname === '/style.css') {
      return new Response(Bun.file('./public/style.css'), {
        headers: { 'Content-Type': 'text/css' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
  websocket: {
    message(ws, message) {
      handleMessage(ws, message.toString());
    },
    close(ws) {
      handleClose(ws);
    },
  },
});

console.log('SeaWar server running on http://localhost:3000');
