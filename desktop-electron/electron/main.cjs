const { app, BrowserWindow, ipcMain, safeStorage, session, autoUpdater } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { UNSIGNED_UPDATE_WARNING, normalizeUpdateFeedUrl, probeSquirrelFeed } = require("./update-contract.cjs");
const {
  authenticate,
  applyResponseCookies,
  boundedRequest,
  cookieHeader,
  credentialIdentity,
  createConnectionState,
  createLoginAttemptCoordinator,
  completeLoginAttempt,
  invalidateConnectionState,
  invalidateIfCurrent,
  MAX_REQUEST_PAYLOAD_BYTES,
  boundedErrorDetail,
  normalizeBaseUrl,
  normalizeUsername,
  projectConfig,
  resolveLoginCredentials,
  requestEffectIfCurrent,
  validateEnabled,
  validateNotificationAction,
  validateNotificationQuery,
  validateTemperature,
  validateApiResponse
} = require("./auth-client.cjs");

const DEFAULT_BASE_URL = "http://127.0.0.1:8888";
const CONFIG_VERSION = 1;
const TAB_IDS = ["dashboard", "notifications", "settings"];
const FONT_FAMILIES = ["Segoe UI Variable", "Segoe UI", "Arial", "Cascadia Code", "Consolas", "system-ui"];
let mainWindow;
let connection = createConnectionState(DEFAULT_BASE_URL);
const loginAttempts = createLoginAttemptCoordinator();
let updateFeedUrl = "";
let updateReady = false;
let updateTimer;

function configPath() {
  return path.join(app.getPath("userData"), "controller-config.json");
}

function defaultConfig() {
  return {
    baseUrl: DEFAULT_BASE_URL, username: "", password: "", remember: false,
    language: "en", funnyEnglish: 2, funnyCantonese: 3, theme: "dark", density: "compact", accent: "#9de7c0", fontFamily: "Segoe UI Variable", fontScale: 1, updateFeedUrl: "",
    activeTab: "dashboard", tabOrder: TAB_IDS, tabAppearance: normalizeTabAppearance({})
  };
}

function readRawConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), "utf8")); }
  catch { return {}; }
}

function readStoredConfig() {
  const raw = readRawConfig();
  try {
    const savedPassword = raw.password && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(raw.password, "base64"))
      : "";
    let storedIdentity = null;
    if (savedPassword && typeof raw.credentialBaseUrl === "string" && typeof raw.credentialUsername === "string") {
      try { storedIdentity = credentialIdentity(raw.credentialBaseUrl, raw.credentialUsername); } catch { storedIdentity = null; }
    }
    return {
      baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl : DEFAULT_BASE_URL,
      username: typeof raw.username === "string" ? raw.username : "",
      password: savedPassword,
      credentialBaseUrl: storedIdentity?.baseUrl || "",
      credentialUsername: storedIdentity?.username || "",
      remember: Boolean(savedPassword && storedIdentity),
      language: raw.language === "yue" || raw.language === "bilingual" ? raw.language : "en",
      funnyEnglish: clampFunny(raw.funnyEnglish),
      funnyCantonese: clampFunny(raw.funnyCantonese),
      theme: raw.theme === "light" ? "light" : "dark",
      density: raw.density === "comfortable" ? "comfortable" : "compact",
      accent: normalizeAccent(raw.accent),
      fontFamily: normalizeFontFamily(raw.fontFamily),
      fontScale: normalizeFontScale(raw.fontScale),
      updateFeedUrl: typeof raw.updateFeedUrl === "string" ? raw.updateFeedUrl : "",
      activeTab: TAB_IDS.includes(raw.activeTab) ? raw.activeTab : "dashboard",
      tabOrder: normalizeTabOrder(raw.tabOrder),
      tabAppearance: normalizeTabAppearance(raw.tabAppearance)
    };
  } catch { return defaultConfig(); }
}

function readConfig() {
  return projectConfig(readStoredConfig());
}

function normalizeAccent(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : "#9de7c0";
}

function normalizeFontFamily(value) {
  return typeof value === "string" && FONT_FAMILIES.includes(value) ? value : "Segoe UI Variable";
}

function normalizeFontScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.min(1.35, Math.max(0.85, n)) * 20) / 20;
}

function clampFunny(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 2;
}

function normalizeTabOrder(value) {
  const incoming = Array.isArray(value) ? value.filter((item) => TAB_IDS.includes(item)) : [];
  return [...new Set(incoming.concat(TAB_IDS))].slice(0, TAB_IDS.length);
}

function normalizeTabAppearance(value) {
  const source = value && typeof value === "object" ? value : {};
  const output = {};
  for (const id of TAB_IDS) {
    const item = source[id] && typeof source[id] === "object" ? source[id] : {};
    const foreground = typeof item.foreground === "string" && /^#[0-9a-f]{6}$/i.test(item.foreground) ? item.foreground : "#e6f1eb";
    const background = typeof item.background === "string" && /^#[0-9a-f]{6}$/i.test(item.background) ? item.background : "#16221e";
    const fontSize = Number(item.fontSize);
    output[id] = { foreground, background, fontSize: Number.isFinite(fontSize) ? Math.min(28, Math.max(11, Math.round(fontSize))) : 14 };
  }
  return output;
}

function saveConfig(partial) {
  const old = readStoredConfig();
  const raw = readRawConfig();
  const next = { ...old, ...partial, version: CONFIG_VERSION };
  const suppliedPassword = typeof partial?.password === "string" && partial.password.length > 0;
  const remember = Boolean(next.remember);
  const suppliedIdentity = typeof partial?.credentialBaseUrl === "string" && typeof partial?.credentialUsername === "string"
    ? credentialIdentity(partial.credentialBaseUrl, partial.credentialUsername)
    : null;
  let targetIdentity = null;
  try { targetIdentity = credentialIdentity(next.baseUrl, next.username); } catch { targetIdentity = null; }
  const payload = {
    version: CONFIG_VERSION,
    baseUrl: next.baseUrl,
    username: next.username,
    language: next.language,
    funnyEnglish: clampFunny(next.funnyEnglish),
    funnyCantonese: clampFunny(next.funnyCantonese),
    theme: next.theme,
    density: next.density,
    accent: normalizeAccent(next.accent),
    fontFamily: normalizeFontFamily(next.fontFamily),
    fontScale: normalizeFontScale(next.fontScale),
    updateFeedUrl: typeof next.updateFeedUrl === "string" ? next.updateFeedUrl : "",
    activeTab: TAB_IDS.includes(next.activeTab) ? next.activeTab : "dashboard",
    tabOrder: normalizeTabOrder(next.tabOrder),
    tabAppearance: normalizeTabAppearance(next.tabAppearance)
  };
  if (remember && suppliedPassword && safeStorage.isEncryptionAvailable()) {
    payload.password = safeStorage.encryptString(partial.password).toString("base64");
    if (suppliedIdentity) {
      payload.credentialBaseUrl = suppliedIdentity.baseUrl;
      payload.credentialUsername = suppliedIdentity.username;
    }
  } else if (remember && typeof raw.password === "string" && raw.password
      && targetIdentity
      && raw.credentialBaseUrl === targetIdentity.baseUrl
      && raw.credentialUsername === targetIdentity.username) {
    // Renderer-safe config projections carry password: "". Preserve the encrypted
    // bytes during unrelated preference saves instead of decrypting them into IPC.
    payload.password = raw.password;
    payload.credentialBaseUrl = raw.credentialBaseUrl;
    payload.credentialUsername = raw.credentialUsername;
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(payload, null, 2), { mode: 0o600 });
}

async function request(pathname, options = {}) {
  const activeConnection = connection;
  if (!activeConnection.baseUrl || !activeConnection.username) throw new Error("Connect to the defender before using controls.");
  const url = `${activeConnection.baseUrl}${pathname}`;
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const cookies = await cookieHeader(activeConnection.jar, url);
  if (!requestEffectIfCurrent(activeConnection, connection, () => {})) throw new Error("Defender request was superseded by a newer session.");
  if (!cookies) throw new Error("Connect to the defender before using controls.");
  headers.set("Cookie", cookies);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const { timeoutMs, maxBodyBytes, ...fetchOptions } = options;
  let result;
  try {
    result = await boundedRequest(fetch, url, {
      ...fetchOptions,
      headers,
      redirect: "manual"
    }, { timeoutMs, maxBodyBytes: maxBodyBytes ?? 1024 * 1024, maxRequestPayloadBytes: MAX_REQUEST_PAYLOAD_BYTES });
  } catch (error) {
    throw new Error(`Defender request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!requestEffectIfCurrent(activeConnection, connection, () => {})) throw new Error("Defender request was superseded by a newer session.");
  const response = result.response;
  await applyResponseCookies(activeConnection.jar, response, url);
  if (!requestEffectIfCurrent(activeConnection, connection, () => {})) throw new Error("Defender request was superseded by a newer session.");
  const text = result.body;
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (response.status === 401 || response.status === 403) {
    if (!requestEffectIfCurrent(activeConnection, connection, () => { connection = invalidateConnectionState(activeConnection, activeConnection.baseUrl); })) throw new Error("Defender request was superseded by a newer session.");
    throw new Error("The defender rejected this session. Sign in again.");
  }
  if (!response.ok) {
    const detail = boundedErrorDetail(body && body.error);
    throw new Error(`Defender returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return validateApiResponse(pathname, body);
}

async function login({ baseUrl, username, password, remember } = {}) {
  const attempt = loginAttempts.begin();
  const attemptedBaseUrl = typeof baseUrl === "string" ? baseUrl : "";
  connection = invalidateConnectionState(connection, attemptedBaseUrl);
  let normalized = attemptedBaseUrl;
  try {
    normalized = normalizeBaseUrl(baseUrl);
    const cleanUsername = normalizeUsername(username);
    const stored = readStoredConfig();
    const storedIdentity = stored.credentialBaseUrl && stored.credentialUsername
      ? { baseUrl: stored.credentialBaseUrl, username: stored.credentialUsername }
      : null;
    const credentials = resolveLoginCredentials({ baseUrl: normalized, username: cleanUsername, password, rememberedPassword: stored.password, storedIdentity });
    const candidate = await authenticate({ baseUrl: credentials.baseUrl, username: credentials.username, password: credentials.password, remember });
    // Persist first. A write failure must not make an unpersisted session live.
    return completeLoginAttempt(
      loginAttempts,
      attempt,
      candidate,
      () => saveConfig({ baseUrl: credentials.baseUrl, username: credentials.username, password: credentials.password, remember, credentialBaseUrl: credentials.baseUrl, credentialUsername: credentials.username }),
      (nextConnection) => { connection = nextConnection || invalidateConnectionState(connection, normalized); }
    );
  } catch (error) {
    invalidateIfCurrent(loginAttempts, attempt, () => { connection = invalidateConnectionState(connection, normalized); });
    throw error;
  }
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
  const normalized = normalizeUpdateFeedUrl(feedUrl);
  if (normalized !== updateFeedUrl) updateReady = false;
  updateFeedUrl = normalized;
  if (updateTimer) { clearInterval(updateTimer); updateTimer = undefined; }
  if (!updateFeedUrl) return { configured: false, platform: process.platform, unsignedWarning: UNSIGNED_UPDATE_WARNING };
  if (process.platform !== "win32") return { configured: false, platform: process.platform, unsignedWarning: UNSIGNED_UPDATE_WARNING };
  // Squirrel.Windows owns the HTTPS download and RELEASES/package-hash checks. The artifacts
  // remain unsigned, so this path never claims publisher-signature authenticity.
  autoUpdater.setFeedURL({ url: updateFeedUrl });
  updateTimer = setInterval(() => {
    Promise.resolve(autoUpdater.checkForUpdates()).catch((error) => sendUpdateEvent("update-error", { message: error instanceof Error ? error.message : String(error) }));
  }, 30 * 60 * 1000);
  return { configured: true, platform: process.platform, unsignedWarning: UNSIGNED_UPDATE_WARNING };
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": ["default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'"] } });
  });
  ipcMain.handle("config:load", () => readConfig());
  ipcMain.handle("config:save", (_event, values) => {
    const nextValues = values || {};
    const feedUrl = normalizeUpdateFeedUrl(nextValues.updateFeedUrl ?? readStoredConfig().updateFeedUrl);
    saveConfig({ ...nextValues, updateFeedUrl: feedUrl });
    configureUpdater(feedUrl);
    return readConfig();
  });
  ipcMain.handle("auth:connect", (_event, values) => login(values));
  ipcMain.handle("api:status", () => request("/api/status"));
  ipcMain.handle("api:notifications", (_event, query) => {
    const safeQuery = validateNotificationQuery(query);
    return request(`/api/notifications?limit=${encodeURIComponent(safeQuery.limit)}&includeDismissed=${safeQuery.includeDismissed ? "true" : "false"}`);
  });
  ipcMain.handle("api:notification-action", (_event, values) => {
    const { id, action } = validateNotificationAction(values?.id, values?.action);
    return request(`/api/notifications/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, { method: "POST" });
  });
  ipcMain.handle("api:target", (_event, temperature) => request("/api/target", { method: "POST", body: JSON.stringify({ temperatureCelsius: validateTemperature(temperature) }) }));
  ipcMain.handle("api:defender", (_event, enabled) => request("/api/defender", { method: "POST", body: JSON.stringify({ enabled: validateEnabled(enabled) }) }));
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
  ipcMain.handle("auth:disconnect", () => {
    loginAttempts.begin();
    connection = invalidateConnectionState(connection, connection.baseUrl);
    return true;
  });
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
    try {
      // Probe the direct RELEASES manifest first. Squirrel still owns package-hash
      // integrity checks; this gives the operator a precise, actionable error when
      // a website URL or incomplete feed was configured by mistake.
      const manifest = await probeSquirrelFeed(updateFeedUrl);
      await autoUpdater.checkForUpdates();
      return { status: "checking", manifestEntries: manifest.entries.length, unsignedWarning: manifest.unsignedWarning };
    } catch (error) {
      updateReady = false;
      throw new Error(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ipcMain.handle("update:install", () => {
    if (!updateReady) throw new Error("No downloaded update is ready to install.");
    updateReady = false;
    autoUpdater.quitAndInstall(false, true);
    return true;
  });
  autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
    updateReady = true;
    sendUpdateEvent("update-ready", { releaseName: releaseName || "new version", releaseNotes: typeof releaseNotes === "string" ? releaseNotes : "", unsignedWarning: UNSIGNED_UPDATE_WARNING });
  });
  autoUpdater.on("error", (error) => {
    updateReady = false;
    sendUpdateEvent("update-error", { message: error instanceof Error ? error.message : String(error) });
  });
  createWindow();
  const saved = readConfig();
  if (saved.updateFeedUrl) {
    try { configureUpdater(saved.updateFeedUrl); } catch (error) { sendUpdateEvent("update-error", { message: error instanceof Error ? error.message : String(error) }); }
  }
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
