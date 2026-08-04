const { app, BrowserWindow, ipcMain, safeStorage, session, autoUpdater } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const DEFAULT_BASE_URL = "http://127.0.0.1:8888";
const CONFIG_VERSION = 1;
let mainWindow;
let connection = { baseUrl: DEFAULT_BASE_URL, username: "", cookie: "" };
let updateFeedUrl = "";
let updateReady = false;
let updateTimer;

function configPath() {
  return path.join(app.getPath("userData"), "controller-config.json");
}

function readConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    const savedPassword = raw.password && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(raw.password, "base64"))
      : "";
    return {
      baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : DEFAULT_BASE_URL,
      username: typeof raw.username === "string" ? raw.username : "",
      password: savedPassword,
      remember: Boolean(savedPassword),
      language: raw.language === "yue" || raw.language === "bilingual" ? raw.language : "en",
      funnyEnglish: clampFunny(raw.funnyEnglish),
      funnyCantonese: clampFunny(raw.funnyCantonese),
      theme: raw.theme === "light" ? "light" : "dark",
      density: raw.density === "comfortable" ? "comfortable" : "compact",
      updateFeedUrl: typeof raw.updateFeedUrl === "string" ? raw.updateFeedUrl : ""
    };
  } catch {
    return {
      baseUrl: DEFAULT_BASE_URL, username: "", password: "", remember: false,
      language: "en", funnyEnglish: 2, funnyCantonese: 3, theme: "dark", density: "compact", updateFeedUrl: ""
    };
  }
}

function clampFunny(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 2;
}

function saveConfig(partial) {
  const old = readConfig();
  const next = { ...old, ...partial, version: CONFIG_VERSION };
  const payload = {
    version: CONFIG_VERSION,
    baseUrl: next.baseUrl,
    username: next.username,
    language: next.language,
    funnyEnglish: clampFunny(next.funnyEnglish),
    funnyCantonese: clampFunny(next.funnyCantonese),
    theme: next.theme,
    density: next.density,
    updateFeedUrl: typeof next.updateFeedUrl === "string" ? next.updateFeedUrl : ""
  };
  if (next.remember && next.password && safeStorage.isEncryptionAvailable()) {
    payload.password = safeStorage.encryptString(next.password).toString("base64");
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(payload, null, 2), { mode: 0o600 });
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("Enter a valid http:// or https:// defender address."); }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP and HTTPS defender addresses are supported.");
  if (parsed.username || parsed.password) throw new Error("Do not put credentials in the defender address.");
  return parsed.toString().replace(/\/+$/, "");
}

function mergeCookies(existing, response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/g);
  const jar = new Map((existing || "").split("; ").filter(Boolean).map((item) => item.split("=", 2)));
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(pathname, options = {}) {
  if (!connection.baseUrl || !connection.cookie) throw new Error("Connect to the defender before using controls.");
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (connection.cookie) headers.set("Cookie", connection.cookie);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(`${connection.baseUrl}${pathname}`, { ...options, headers, redirect: "manual" });
  } catch (error) {
    throw new Error(`Defender request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  connection.cookie = mergeCookies(connection.cookie, response);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (response.status === 401 || response.status === 403) {
    connection.cookie = "";
    throw new Error("The defender rejected this session. Sign in again.");
  }
  if (!response.ok) {
    const detail = body && typeof body.error === "string" ? body.error : text.slice(0, 240);
    throw new Error(`Defender returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return body;
}

async function login({ baseUrl, username, password, remember }) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!String(username || "").trim() || !password) throw new Error("Username and password are required.");
  connection = { baseUrl: normalized, username: String(username).trim(), cookie: "" };
  let loginPage;
  try {
    loginPage = await fetch(`${normalized}/login`, { redirect: "manual" });
  } catch (error) {
    throw new Error(`Could not reach defender: ${error instanceof Error ? error.message : String(error)}`);
  }
  const loginHtml = await loginPage.text();
  connection.cookie = mergeCookies("", loginPage);
  // Blazor's <AntiforgeryToken /> emits a hidden RequestVerificationToken input.
  // Keep the parser deliberately small and local: this is only a server-issued token,
  // never a credential supplied by the user.
  const tokenInputs = [...loginHtml.matchAll(/<input\b[^>]*>/gi)];
  const hidden = {};
  for (const match of tokenInputs) {
    const tag = match[0];
    const name = tag.match(/name=["']([^"']+)["']/i)?.[1];
    const value = tag.match(/value=["']([^"']*)["']/i)?.[1];
    const type = tag.match(/type=["']([^"']+)["']/i)?.[1] || "text";
    if (name && value !== undefined && type.toLowerCase() === "hidden") hidden[name] = value;
  }
  const form = new URLSearchParams({ ...hidden, action: "login", username: connection.username, password, keepSignedIn: remember ? "true" : "false" });
  const response = await fetch(`${normalized}/login`, {
    method: "POST", body: form, redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" }
  });
  connection.cookie = mergeCookies(connection.cookie, response);
  if (response.status >= 400 && response.status !== 302 && response.status !== 303) {
    throw new Error(`Login returned HTTP ${response.status}.`);
  }
  let status;
  try { status = await request("/api/status"); } catch (error) {
    connection.cookie = "";
    throw new Error(`Sign-in failed or API is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  saveConfig({ baseUrl: normalized, username: connection.username, password, remember });
  return status;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 820, minWidth: 840, minHeight: 600,
    title: "AC Defender Controller",
    frame: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    backgroundColor: "#101a17",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

function sendUpdateEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function configureUpdater(feedUrl) {
  updateFeedUrl = String(feedUrl || "").trim();
  if (updateTimer) { clearInterval(updateTimer); updateTimer = undefined; }
  if (!updateFeedUrl) return { configured: false, platform: process.platform };
  let parsed;
  try { parsed = new URL(updateFeedUrl); } catch { throw new Error("Update feed URL must be a valid HTTPS URL."); }
  if (parsed.protocol !== "https:") throw new Error("Update feeds must use HTTPS so Squirrel signatures and metadata cannot be replaced in transit.");
  if (process.platform !== "win32") return { configured: false, platform: process.platform };
  // Squirrel.Windows verifies the signed RELEASES package. We never download or execute an
  // installer ourselves; autoUpdater owns that verified transaction and only reports ready.
  autoUpdater.setFeedURL({ url: updateFeedUrl });
  updateTimer = setInterval(() => {
    Promise.resolve(autoUpdater.checkForUpdates()).catch((error) => sendUpdateEvent("update-error", { message: error instanceof Error ? error.message : String(error) }));
  }, 30 * 60 * 1000);
  return { configured: true, platform: process.platform };
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": ["default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'"] } });
  });
  ipcMain.handle("config:load", () => readConfig());
  ipcMain.handle("config:save", (_event, values) => { saveConfig(values || {}); configureUpdater(values?.updateFeedUrl ?? readConfig().updateFeedUrl); return readConfig(); });
  ipcMain.handle("auth:connect", (_event, values) => login(values));
  ipcMain.handle("api:status", () => request("/api/status"));
  ipcMain.handle("api:notifications", (_event, query) => request(`/api/notifications?limit=${encodeURIComponent(query?.limit || 30)}&includeDismissed=${query?.includeDismissed ? "true" : "false"}`));
  ipcMain.handle("api:notification-action", (_event, { id, action }) => request(`/api/notifications/${encodeURIComponent(id)}/${action}`, { method: "POST" }));
  ipcMain.handle("api:target", (_event, temperature) => request("/api/target", { method: "POST", body: JSON.stringify({ temperatureCelsius: temperature }) }));
  ipcMain.handle("api:defender", (_event, enabled) => request("/api/defender", { method: "POST", body: JSON.stringify({ enabled }) }));
  ipcMain.handle("api:command", (_event, command) => {
    const routes = {
      forceTarget: ["/api/thermostat/force-target", "POST"],
      forceBoost: ["/api/thermostat/force-boost", "POST"],
      refresh: ["/api/thermostat/refresh", "POST"],
      thermostatOff: ["/api/thermostat/off", "POST"]
    };
    const route = routes[command];
    if (!route) throw new Error("Unknown controller command.");
    return request(route[0], { method: route[1] });
  });
  ipcMain.handle("auth:disconnect", () => { connection.cookie = ""; return true; });
  ipcMain.handle("window:control", (event, action) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return false;
    if (action === "minimize") window.minimize();
    else if (action === "maximize") window.isMaximized() ? window.unmaximize() : window.maximize();
    else if (action === "close") window.close();
    else throw new Error("Unknown window control.");
    return true;
  });
  ipcMain.handle("update:configure", (_event, values) => {
    const result = configureUpdater(values?.feedUrl);
    saveConfig({ updateFeedUrl: updateFeedUrl });
    return result;
  });
  ipcMain.handle("update:check", async () => {
    if (!updateFeedUrl) return { status: "disabled" };
    if (process.platform !== "win32") return { status: "windows-only" };
    try { await autoUpdater.checkForUpdates(); return { status: "checking" }; }
    catch (error) { throw new Error(`Update check failed: ${error instanceof Error ? error.message : String(error)}`); }
  });
  ipcMain.handle("update:install", () => {
    if (!updateReady) throw new Error("No verified update is ready to install.");
    autoUpdater.quitAndInstall(false, true);
    return true;
  });
  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    updateReady = true;
    sendUpdateEvent("update-ready", { releaseName: releaseName || "new version", releaseNotes: typeof releaseNotes === "string" ? releaseNotes : "" });
  });
  autoUpdater.on("error", (error) => sendUpdateEvent("update-error", { message: error instanceof Error ? error.message : String(error) }));
  createWindow();
  const saved = readConfig();
  if (saved.updateFeedUrl) {
    try { configureUpdater(saved.updateFeedUrl); } catch (error) { sendUpdateEvent("update-error", { message: error instanceof Error ? error.message : String(error) }); }
  }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
