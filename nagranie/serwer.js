// Serwer gry "Ludzik w nagraniu".
// Potrzebny, bo strona wczytuje film i moduły ES — przy otwarciu z dysku (file://)
// przeglądarka blokuje jedno i drugie.
// Uruchomienie:  node serwer.js      albo dwuklik w GRAJ-NAGRANIE.bat
//
// Samego nagrania NIE trzymamy w projekcie: ma 111 MB i rozdęłoby repozytorium.
// Jest czytane prosto z katalogu, w którym zapisał je Roblox.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const FILM = path.join(os.homedir(), 'Videos', 'Roblox', 'Roblox-2026-08-02T18_38_02.130Z.mp4');
const KATALOG = __dirname;
const PORT = 8099;

const TYPY = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function wyslij(res, plik) {
  res.writeHead(200, {
    'Content-Type': TYPY[path.extname(plik)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(fs.readFileSync(plik));
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url.startsWith('/video.mp4')) {
    if (!fs.existsSync(FILM)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nie znaleziono nagrania:\n' + FILM +
                     '\n\nPopraw sciezke FILM na gorze pliku serwer.js.');
    }
    const rozmiar = fs.statSync(FILM).size;
    const zakres = req.headers.range;
    if (zakres) {                                   // bez tego nie dziala przewijanie
      const [a, b] = zakres.replace(/bytes=/, '').split('-');
      const od = parseInt(a, 10);
      const doo = b ? parseInt(b, 10) : rozmiar - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${od}-${doo}/${rozmiar}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': doo - od + 1,
        'Content-Type': 'video/mp4',
      });
      fs.createReadStream(FILM, { start: od, end: doo }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': rozmiar, 'Content-Type': 'video/mp4',
                           'Accept-Ranges': 'bytes' });
      fs.createReadStream(FILM).pipe(res);
    }
    return;
  }

  // pliki obok serwera; nic spoza tego katalogu nie wychodzi
  const nazwa = url === '/' ? 'index.html'
              : url === '/miasto' ? 'miasto.html'
              : url === '/plaskie' ? 'plaskie.html'
              : path.basename(url);
  const plik = path.join(KATALOG, nazwa);
  if (!plik.startsWith(KATALOG) || !fs.existsSync(plik)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('brak ' + nazwa);
  }
  wyslij(res, plik);
}).listen(PORT, () => {
  console.log('');
  console.log('  Gra dziala:  http://localhost:' + PORT);
  console.log('  Zatrzymanie: Ctrl+C w tym oknie.');
  console.log('');
});
