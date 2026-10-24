import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createStaticServer(root = resolve('.')) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json' };
  return createServer(async (request, response) => {
    try {
      const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
      if (path !== root && !path.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const file = await realpath(path === root ? resolve(root, 'example/index.html') : path);
      if (!file.startsWith(root + sep) || file.slice(root.length + 1).split(sep).some(part => part.startsWith('.'))) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : 404).end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 8080);
  createStaticServer().listen(port, '127.0.0.1', () => console.log(`Demo: http://127.0.0.1:${port}`));
}
