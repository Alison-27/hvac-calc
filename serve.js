// 本地靜態伺服器 — node serve.js
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 5500;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  // 影片等大檔：支援 HTTP Range 串流（Chrome <video> 需要）
  if (req.headers.range) {
    fs.stat(filePath, (err, st) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range) || [];
      const start = m[1] ? parseInt(m[1]) : 0;
      const end   = m[2] ? parseInt(m[2]) : st.size - 1;
      res.writeHead(206, {
        'Content-Type': mime,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    });
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('HVAC server running at http://localhost:' + PORT);
  require('child_process').exec('start http://localhost:' + PORT);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    // port 已被佔用（上次沒關），直接開瀏覽器
    require('child_process').exec('start http://localhost:' + PORT);
  }
});
