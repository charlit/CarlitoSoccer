// Serveur de Carlito Soccer : sert le jeu (dossier public) et met en relation les joueurs en ligne.
// Mise en relation : le 1er joueur qui cherche attend, le 2e démarre la partie avec lui.
// Ensuite le serveur relaie seulement les messages entre les deux (l'hôte fait tourner la partie).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const HEADS = 5;

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(PUB, path.normalize(p));
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    const ext = path.extname(file);
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };
    // la page est revérifiée à chaque visite (sinon Safari garde l'ancienne version)
    if (ext === '.html') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
let waiting = null;
const send = (ws, m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    const txt = raw.toString();
    let m;
    try { m = JSON.parse(txt); } catch (e) { return; }
    if (m.t === 'find' && !ws.peer) {
      ws.head = Math.min(HEADS - 1, Math.max(0, m.head | 0));
      if (waiting && waiting !== ws && waiting.readyState === 1) {
        const host = waiting; waiting = null;
        host.peer = ws; ws.peer = host;
        const heads = [host.head, ws.head];
        send(host, { t: 'start', role: 0, heads });
        send(ws, { t: 'start', role: 1, heads });
        console.log('partie lancée', heads);
      } else waiting = ws;
    } else if ((m.t === 'in' || m.t === 's') && ws.peer && ws.peer.readyState === 1) {
      ws.peer.send(txt);
    }
  });
  ws.on('close', () => {
    if (waiting === ws) waiting = null;
    if (ws.peer) { send(ws.peer, { t: 'left' }); ws.peer.peer = null; }
  });
});

server.listen(PORT, () => console.log('Carlito Soccer sur le port ' + PORT));
