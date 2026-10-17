import { app, BrowserWindow, protocol, session } from 'electron';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([{ scheme: 'docs', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const mime: Record<string,string> = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.ico':'image/x-icon'};
void app.whenReady().then(() => {
protocol.handle('docs', async request => {
  try {
    const url = new URL(request.url);
    if (url.hostname !== 'reader' || request.method !== 'GET') return new Response('Forbidden', {status:403});
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').includes('..')) return new Response('Forbidden', {status:403});
    const path = resolve(root, '.' + decoded + (decoded.endsWith('/') ? 'index.html' : ''));
    if (!path.startsWith(root + sep)) return new Response('Forbidden', {status:403});
    return new Response(await readFile(path), {headers: {'Content-Type':mime[extname(path)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"}});
  } catch { return new Response('Bundled content unavailable', {status:404}); }
});
session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({cancel: !details.url.startsWith('docs://reader/') && !details.url.startsWith('data:')}));
session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
function openReader() {
  const window = new BrowserWindow({width:1100,height:760,minWidth:680,minHeight:520,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate', (event, url) => {if (url !== 'docs://reader/index.html') event.preventDefault();});
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  void window.loadURL('docs://reader/index.html');
}
openReader();
app.on('activate', () => {if (BrowserWindow.getAllWindows().length === 0) openReader();});
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});

});
