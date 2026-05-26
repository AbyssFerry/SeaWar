import { handleMessage, handleClose } from './src/server/message-handler';
import indexHtmlPath from './public/index.html' with { type: 'file' };
import clientJsPath from './public/client.js' with { type: 'file' };
import styleCssPath from './public/style.css' with { type: 'file' };

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
      return new Response(Bun.file(indexHtmlPath as unknown as string));
    }
    if (pathname === '/client.js') {
      return new Response(Bun.file(clientJsPath), {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }
    if (pathname === '/style.css') {
      return new Response(Bun.file(styleCssPath), {
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
