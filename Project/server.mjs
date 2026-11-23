// Local server + Direct Save/Delete APIs for كتاب التأسيس التفاعلي
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = import.meta.dirname;
const DATA_FILE = path.join(ROOT, 'readingAppData.json');
const AUDIO_DIR = path.join(ROOT, 'audio');
const LEGACY_AUDIO_DIR = path.join(AUDIO_DIR, 'audio');
const PORT = Number(process.env.PORT) || 5174;

fs.mkdirSync(AUDIO_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const VALID_ID = /^[a-zA-Z0-9_\-]+$/;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function listAudioIds() {
  const ids = new Set();
  for (const dir of [AUDIO_DIR, LEGACY_AUDIO_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.toLowerCase().endsWith('.webm')) {
        ids.add(entry.slice(0, -5));
      }
    }
  }
  return [...ids];
}

function removeAudioFiles(id) {
  let deleted = false;
  for (const dir of [AUDIO_DIR, LEGACY_AUDIO_DIR]) {
    const filePath = path.join(dir, `${id}.webm`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      deleted = true;
    }
  }
  return deleted;
}

async function handleApi(req, res, parsedUrl) {
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/api/status' && req.method === 'GET') {
    sendJson(res, 200, {
      local: true,
      dataFile: DATA_FILE,
      audioDir: AUDIO_DIR,
      audioIds: listAudioIds(),
    });
    return true;
  }

  if (pathname === '/api/save-data' && req.method === 'POST') {
    try {
      const raw = (await readBody(req)).toString('utf8');
      const pages = JSON.parse(raw);
      if (!Array.isArray(pages) || pages.length === 0) {
        sendJson(res, 400, { error: 'Invalid pages data' });
        return true;
      }
      fs.writeFileSync(DATA_FILE, `${JSON.stringify(pages, null, 2)}\n`, 'utf8');
      sendJson(res, 200, { ok: true, pages: pages.length });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  if (pathname === '/api/save-audio' && req.method === 'POST') {
    const id = parsedUrl.searchParams.get('id') || '';
    if (!VALID_ID.test(id)) {
      sendJson(res, 400, { error: 'Invalid audio id' });
      return true;
    }
    try {
      const buf = await readBody(req);
      if (buf.length === 0) {
        sendJson(res, 400, { error: 'Empty audio body' });
        return true;
      }
      fs.mkdirSync(AUDIO_DIR, { recursive: true });
      const targetPath = path.join(AUDIO_DIR, `${id}.webm`);
      fs.writeFileSync(targetPath, buf);
      sendJson(res, 200, { ok: true, id, size: buf.length, path: targetPath });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  if (pathname === '/api/delete-audio' && req.method === 'POST') {
    const id = parsedUrl.searchParams.get('id') || '';
    if (!VALID_ID.test(id)) {
      sendJson(res, 400, { error: 'Invalid audio id' });
      return true;
    }
    try {
      const deleted = removeAudioFiles(id);
      sendJson(res, 200, { ok: true, id, deleted });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return true;
  }

  return false;
}

function serveStatic(req, res, pathname) {
  const cleanRel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, cleanRel);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
    };
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': end - start + 1,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, parsedUrl);
    if (!handled) sendJson(res, 404, { error: 'Unknown endpoint' });
    return;
  }

  serveStatic(req, res, pathname);
}).listen(PORT, () => {
  console.log(`\n  كتاب التأسيس التفاعلي — المعاينة المحلية:`);
  console.log(`    الموقع      : http://localhost:${PORT}/`);
  console.log(`    وضع المعلم   : http://localhost:${PORT}/?teacher`);
  console.log(`    مجلد الصوتيات: ${AUDIO_DIR}\n`);
});
