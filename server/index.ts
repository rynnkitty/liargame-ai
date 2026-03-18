import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import next from 'next';
import { parse } from 'url';
import { initSocketServer } from '../src/lib/socket/server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  // Socket.IO 서버 초기화
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: dev ? '*' : process.env.ALLOWED_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IO 이벤트 핸들러 등록
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initSocketServer(io as any);

  // Next.js 요청 처리 (Socket.IO 제외 모든 HTTP 요청)
  expressApp.all('*', (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.info(
      `[Server] 서버 시작: http://${hostname}:${port} (${dev ? 'development' : 'production'})`,
    );
  });
});
