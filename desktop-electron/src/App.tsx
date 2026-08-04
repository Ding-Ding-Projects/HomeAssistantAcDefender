import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DefenderSnapshot, NotificationItem, NotificationSnapshot } from "./api";
import "./App.css";

type Language = "en" | "yue" | "bilingual";
type Tab = "dashboard" | "notifications" | "settings";
type Copy = { en: string; yue: string };

const DEFAULT_CONFIG: ControllerConfig = {
  baseUrl: "http://192.168.50.242:8888", username: "", password: "", remember: false,
  language: "en", funnyEnglish: 2, funnyCantonese: 3, theme: "dark", density: "compact", updateFeedUrl: ""
};

const copy = (language: Language, value: Copy) => {
  if (language === "yue") return value.yue;
  if (language === "bilingual") return `${value.en} · ${value.yue}`;
  return value.en;
};

const labels = {
  app: { en: "AC Defender Controller", yue: "冷氣 Defender 控制台" },
  subtitle: { en: "A Windows control surface for the running defender.", yue: "Windows 控制面板，連住而家運行緊嘅 defender。" },
  connect: { en: "Connect", yue: "連線" },
  connecting: { en: "Connecting…", yue: "連緊線…" },
  dashboard: { en: "Dashboard", yue: "總覽" },
  notifications: { en: "Notifications", yue: "通知中心" },
  settings: { en: "Settings", yue: "設定" },
  refresh: { en: "Refresh status", yue: "更新狀態" },
  apply: { en: "Apply my temperature", yue: "套用我想要嘅溫度" },
  forceTarget: { en: "Step toward my temperature", yue: "行一步靠近我想要嘅溫度" },
  forceBoost: { en: "Force cooling", yue: "即刻加強冷氣" },
  off: { en: "Turn thermostat off", yue: "關閉溫控器" },
  defending: { en: "Defending", yue: "防守中" },
  stoodDown: { en: "Stood down", yue: "暫停防守" },
  noConnection: { en: "Not connected", yue: "未連線" },
  save: { en: "Save preferences", yue: "儲存偏好" },
  commandPalette: { en: "Command palette", yue: "指令工具箱" }
} satisfies Record<string, Copy>;

function displayNumber(value: unknown, suffix = "") {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : "—";
}

function displayHours(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const h = Math.floor(value);
  return `${h}h ${Math.round((value - h) * 60)}m`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [phase, setPhase] = useState<"login" | "connecting" | "live">("login");
  const [snapshot, setSnapshot] = useState<DefenderSnapshot | null>(null);
  const [notifications, setNotifications] = useState<NotificationSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetDraft, setTargetDraft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [offConfirm, setOffConfirm] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [regexOpen, setRegexOpen] = useState(false);
  const [regexMode, setRegexMode] = useState(false);
  const [regexPattern, setRegexPattern] = useState("");
  const [regexFlags, setRegexFlags] = useState("i");
  const [regexError, setRegexError] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState<{ releaseName?: string; releaseNotes?: string } | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stopReady = window.controller.onUpdateReady((payload) => setUpdateReady(payload));
    const stopUpdateError = window.controller.onUpdateError((payload) => setError(payload.message || "The update feed reported an error."));
    window.controller.loadConfig().then((saved) => {
      setConfig((current) => ({ ...current, ...saved }));
      if (saved.updateFeedUrl) return window.controller.configureUpdater(saved.updateFeedUrl);
      return undefined;
    }).catch((e) => setError(errorText(e)));
    return () => { stopReady(); stopUpdateError(); };
  }, []);

  const language = config.language;
  const t = useCallback((value: Copy) => copy(language, value), [language]);
  const applySnapshot = useCallback((value: DefenderSnapshot) => { setSnapshot(value); setError(null); }, []);

  const refresh = useCallback(async () => {
    try { applySnapshot(await window.controller.status()); }
    catch (e) { setError(errorText(e)); }
  }, [applySnapshot]);

  useEffect(() => {
    if (phase !== "live") return;
    poll.current = setInterval(refresh, 5000);
    return () => { if (poll.current) clearInterval(poll.current); poll.current = null; };
  }, [phase, refresh]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "f") { event.preventDefault(); setPaletteOpen(true); }
      if (event.key === "Escape") { setPaletteOpen(false); setRegexOpen(false); setOffConfirm(false); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  async function connect() {
    setPhase("connecting"); setError(null);
    try {
      const next = await window.controller.connect({ baseUrl: config.baseUrl, username: config.username, password: config.password, remember: config.remember });
      applySnapshot(next); setPhase("live"); setNotice(t({ en: "Connected to the live defender.", yue: "已經連到真實運行緊嘅 defender。" }));
    } catch (e) { setError(errorText(e)); setPhase("login"); }
  }

  async function action(run: () => Promise<DefenderSnapshot>, message?: Copy) {
    setBusy(true); setError(null);
    try { applySnapshot(await run()); if (message) setNotice(t(message)); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function loadNotifications() {
    try { setNotifications(await window.controller.notifications({ limit: 100, includeDismissed: false })); }
    catch (e) { setError(errorText(e)); }
  }

  const currentTarget = targetDraft ?? (typeof snapshot?.targetTemperatureCelsius === "number" ? snapshot.targetTemperatureCelsius : 22);
  const thermostat = snapshot?.homeAssistantThermostat;
  const runtime = snapshot?.acRuntime;
  const eventRows = Array.isArray(snapshot?.events) ? snapshot.events.slice(0, 12) : [];
  const online = Boolean(snapshot && (snapshot.connectionState === "connected" || thermostat));
  const themeClass = `${config.theme === "light" ? "theme-light" : "theme-dark"} density-${config.density}`;

  if (phase !== "live") {
    return <main className={`login-shell ${themeClass}`}>
      <section className="login-card" aria-labelledby="login-title">
        <img src="./shield.svg" className="brand-mark" alt="AC Defender shield" />
        <h1 id="login-title">{t(labels.app)}</h1>
        <p className="supporting">{t(labels.subtitle)}</p>
        <label>Defender address<input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="http://192.168.50.242:8888" /></label>
        <p className="field-help">The Docker host default is editable. Use HTTPS for a non-local network.</p>
        <label>Username<input value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} autoComplete="username" /></label>
        <label>Password<input type="password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && connect()} autoComplete="current-password" /></label>
        <label className="check-row"><input type="checkbox" checked={config.remember} onChange={(e) => setConfig({ ...config, remember: e.target.checked })} /> Remember securely on this computer</label>
        <div className="privacy-note">Credentials stay in the Electron main process; a remembered password is encrypted with Windows app storage when available. Nothing is logged by this controller.</div>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        <button className="button button-filled" onClick={connect} disabled={phase === "connecting"}>{phase === "connecting" ? t(labels.connecting) : t(labels.connect)}</button>
      </section>
    </main>;
  }

  const tabs: { id: Tab; label: Copy }[] = [{ id: "dashboard", label: labels.dashboard }, { id: "notifications", label: labels.notifications }, { id: "settings", label: labels.settings }];
  return <main className={`app-shell ${themeClass}`}>
    <header className="top-app-bar">
      <div className="brand"><img src="./shield.svg" alt="" /><div><strong>{t(labels.app)}</strong><small>Windows controller · real API only</small></div></div>
      <span className={`status-chip ${online ? "chip-ok" : "chip-warn"}`}>{online ? "● ONLINE" : "○ OFFLINE"}</span>
      <span className={`status-chip ${snapshot?.defenderEnabled ? "chip-ok" : "chip-neutral"}`}>{snapshot?.defenderEnabled ? t(labels.defending) : t(labels.stoodDown)}</span>
      <span className="grow" />
      <button className="icon-button" title="Open command palette (Ctrl+Shift+F)" aria-label="Open command palette" onClick={() => setPaletteOpen(true)}>⌘</button>
      <button className="button button-tonal" onClick={() => refresh()} disabled={busy}>{t(labels.refresh)}</button>
    </header>
    <nav className="tab-strip" role="tablist" aria-label="Controller pages">
      {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "tab active" : "tab"} onClick={() => { setTab(item.id); if (item.id === "notifications") loadNotifications(); }}>{t(item.label)}</button>)}
    </nav>
    {error && <div className="banner banner-error" role="alert">{error}<button className="banner-close" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="banner banner-success" role="status">{notice}<button className="banner-close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
    {updateReady && <div className="update-banner" role="status"><strong>Update ready</strong><span>{updateReady.releaseName || "A verified Windows update is ready."}</span><button className="button button-filled" disabled={updateBusy} onClick={async () => { setUpdateBusy(true); try { await window.controller.installUpdate(); } catch (e) { setError(errorText(e)); setUpdateBusy(false); } }}>Restart to install update</button><button className="banner-close" onClick={() => setUpdateReady(null)} aria-label="Dismiss update reminder">Later</button></div>}
    <div className="page-content">{tab === "dashboard" && <Dashboard snapshot={snapshot} thermostat={thermostat} runtime={runtime} target={currentTarget} targetDraft={targetDraft} setTargetDraft={setTargetDraft} busy={busy} action={action} setOffConfirm={setOffConfirm} t={t} eventRows={eventRows} />}{tab === "notifications" && <Notifications snapshot={notifications} onLoad={loadNotifications} onAction={async (id, verb) => { try { setNotifications(await window.controller.notificationAction(id, verb)); } catch (e) { setError(errorText(e)); } }} t={t} />}{tab === "settings" && <Settings config={config} setConfig={setConfig} onSave={async () => { try { setConfig(await window.controller.saveConfig(config)); setNotice(t({ en: "Preferences saved on this Windows profile.", yue: "偏好已經儲存喺呢部 Windows 電腦。" })); } catch (e) { setError(errorText(e)); } }} onUpdateCheck={async () => { try { await window.controller.configureUpdater(config.updateFeedUrl); const result = await window.controller.checkForUpdate(); setNotice(result.status === "disabled" ? "Update feed is not configured." : `Update check: ${result.status}.`); } catch (e) { setError(errorText(e)); } }} t={t} regexOpen={regexOpen} setRegexOpen={setRegexOpen} regexMode={regexMode} setRegexMode={setRegexMode} regexPattern={regexPattern} setRegexPattern={setRegexPattern} regexFlags={regexFlags} setRegexFlags={setRegexFlags} regexError={regexError} setRegexError={setRegexError} />}</div>
    {offConfirm && <div className="modal-scrim" role="presentation"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="off-title"><h2 id="off-title">Turn the real thermostat off?</h2><p>This sends <code>POST /api/thermostat/off</code> to Home Assistant through the hosted defender. It changes a real device; no simulated state is used.</p><div className="dialog-actions"><button className="button button-tonal" onClick={() => setOffConfirm(false)}>Cancel</button><button className="button button-danger" disabled={busy} onClick={() => { setOffConfirm(false); void action(() => window.controller.command("thermostatOff"), { en: "Thermostat OFF command sent.", yue: "已經發出關閉溫控器指令。" }); }}>Turn off real thermostat</button></div></section></div>}
    {paletteOpen && <CommandPalette query={paletteQuery} setQuery={setPaletteQuery} onClose={() => setPaletteOpen(false)} onNavigate={(destination) => { setTab(destination); setPaletteOpen(false); if (destination === "notifications") loadNotifications(); }} t={t} />}
  </main>;
}

function Dashboard({ snapshot, thermostat, runtime, target, targetDraft, setTargetDraft, busy, action, setOffConfirm, t, eventRows }: { snapshot: DefenderSnapshot | null; thermostat: DefenderSnapshot["homeAssistantThermostat"]; runtime: DefenderSnapshot["acRuntime"]; target: number; targetDraft: number | null; setTargetDraft: (value: number | null) => void; busy: boolean; action: (run: () => Promise<DefenderSnapshot>, message?: Copy) => Promise<void>; setOffConfirm: (value: boolean) => void; t: (value: Copy) => string; eventRows: DefenderSnapshot["events"] }) {
  const step = (amount: number) => setTargetDraft(Math.round((target + amount) * 10) / 10);
  return <section className="dashboard-grid" aria-label={t(labels.dashboard)}>
    <article className="card hero-card"><div className="eyebrow">LIVE WALL UNIT</div><div className="hero-row"><div className="temperature">{displayNumber(thermostat?.currentTemperatureCelsius, "°")}<small>room °C</small></div><dl className="telemetry"><div><dt>Setpoint</dt><dd>{displayNumber(thermostat?.setPointCelsius, " °C")}</dd></div><div><dt>Mode</dt><dd>{thermostat?.hvacMode ?? "—"}</dd></div><div><dt>Action</dt><dd className={thermostat?.hvacAction === "cooling" ? "cooling" : ""}>{thermostat?.hvacAction ?? "—"}</dd></div><div><dt>Fan</dt><dd>{thermostat?.fanMode ?? "—"}</dd></div></dl></div><p className="next-action">{snapshot?.nextAction || "No next action reported by the defender."}</p></article>
    <article className="card"><div className="eyebrow">TEMP I WANT</div><div className="target-control"><button className="stepper" disabled={busy} onClick={() => step(-0.5)} aria-label="Lower target">−</button><output>{target.toFixed(1)}<small>°C</small></output><button className="stepper" disabled={busy} onClick={() => step(0.5)} aria-label="Raise target">+</button></div><button className="button button-filled" disabled={busy || targetDraft === null} onClick={() => void action(() => window.controller.target(target), { en: "Target saved on the live defender.", yue: "目標溫度已經儲存去真實 defender。" })}>{t(labels.apply)}</button><div className="button-row"><button className="button button-tonal" disabled={busy} onClick={() => void action(() => window.controller.command("forceTarget"), { en: "Step-toward-target command sent.", yue: "已經發出靠近目標嘅指令。" })}>{t(labels.forceTarget)}</button><button className="button button-tonal" disabled={busy} onClick={() => void action(() => window.controller.command("forceBoost"), { en: "Cooling boost command sent.", yue: "已經發出加強冷氣指令。" })}>{t(labels.forceBoost)}</button></div></article>
    <article className="card"><div className="eyebrow">DEFENDER SWITCH</div><button className={snapshot?.defenderEnabled ? "switch switch-on" : "switch"} disabled={busy} onClick={() => void action(() => window.controller.defender(!snapshot?.defenderEnabled), { en: "Defender switch updated.", yue: "Defender 開關已更新。" })}>{snapshot?.defenderEnabled ? `🛡 ${t(labels.defending)}` : `⏸ ${t(labels.stoodDown)}`}</button><button className="button button-danger" disabled={busy} onClick={() => setOffConfirm(true)}>{t(labels.off)}</button><p className="field-help">Commands are sent to Home Assistant by the hosted defender. A failed request remains visible as an error.</p></article>
    <article className="card"><div className="eyebrow">AC RUNTIME — COOLING</div><div className="stats"><Stat label="TODAY" value={displayHours(runtime?.todayHours)} /><Stat label="THIS MONTH" value={displayHours(runtime?.monthHours)} /><Stat label="LIFETIME" value={displayHours(runtime?.lifetimeHours)} /></div>{runtime?.estimatedCostEnabled && <p className="supporting">Estimated today: ${typeof runtime.estimatedCostTodayDollars === "number" ? runtime.estimatedCostTodayDollars.toFixed(2) : "—"}</p>}</article>
    <article className="card card-wide"><div className="eyebrow">RECENT ACTIVITY</div>{(eventRows ?? []).length ? <ul className="event-list">{(eventRows ?? []).map((event, index) => <li key={`${event.timestamp}-${index}`}><time>{event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], { hour12: false }) : "—"}</time><span className={`event-level event-${event.level || "info"}`}>{event.level || "info"}</span><span>{event.message || "No message"}</span></li>)}</ul> : <p className="empty-state">The defender has not reported activity yet.</p>}</article>
  </section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }

function Notifications({ snapshot, onLoad, onAction, t }: { snapshot: NotificationSnapshot | null; onLoad: () => Promise<void>; onAction: (id: string, action: "read" | "dismiss" | "restore") => Promise<void>; t: (value: Copy) => string }) {
  const items = Array.isArray(snapshot?.notifications) ? snapshot.notifications : [];
  return <section className="stack-page"><div className="page-heading"><div><h2>{t(labels.notifications)}</h2><p className="supporting">Reviewable server history; dismissing never deletes the record.</p></div><button className="button button-tonal" onClick={() => void onLoad()}>{t(labels.refresh)}</button></div><div className="card"><div className="eyebrow">{snapshot?.unreadCount ?? 0} UNREAD · {snapshot?.activeCount ?? items.length} ACTIVE</div>{items.length ? <ul className="notification-list">{items.map((item: NotificationItem, index: number) => <li key={item.id || index} className={item.read ? "notification read" : "notification"}><div><strong>{item.title || item.level || "Notification"}</strong><p>{item.message || "No message"}</p><time>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}</time></div><div className="button-row">{item.id && !item.read && <button className="button button-tonal" onClick={() => void onAction(item.id!, "read")}>Mark read</button>}{item.id && !item.dismissed && <button className="button button-tonal" onClick={() => void onAction(item.id!, "dismiss")}>Dismiss</button>}{item.id && item.dismissed && <button className="button button-tonal" onClick={() => void onAction(item.id!, "restore")}>Restore</button>}</div></li>)}</ul> : <p className="empty-state">No active notifications were returned by the defender.</p>}</div></section>;
}

function Settings({ config, setConfig, onSave, onUpdateCheck, t, regexOpen, setRegexOpen, regexMode, setRegexMode, regexPattern, setRegexPattern, regexFlags, setRegexFlags, regexError, setRegexError }: { config: ControllerConfig; setConfig: (value: ControllerConfig) => void; onSave: () => Promise<void>; onUpdateCheck: () => Promise<void>; t: (value: Copy) => string; regexOpen: boolean; setRegexOpen: (value: boolean) => void; regexMode: boolean; setRegexMode: (value: boolean) => void; regexPattern: string; setRegexPattern: (value: string) => void; regexFlags: string; setRegexFlags: (value: string) => void; regexError: string | null; setRegexError: (value: string | null) => void }) {
  function update<K extends keyof ControllerConfig>(key: K, value: ControllerConfig[K]) { setConfig({ ...config, [key]: value }); }
  function validatePattern(value = regexPattern, flags = regexFlags) { try { if (value) new RegExp(value, flags); setRegexError(null); } catch (e) { setRegexError(errorText(e)); } }
  return <section className="stack-page"><div className="page-heading"><div><h2>{t(labels.settings)}</h2><p className="supporting">Preferences belong to this Windows controller, not to defender logic.</p></div><button className="button button-filled" onClick={() => void onSave()}>{t(labels.save)}</button></div><div className="settings-grid"><article className="card"><div className="eyebrow">CONNECTION</div><label>Defender address<input value={config.baseUrl} onChange={(e) => update("baseUrl", e.target.value)} /></label><p className="field-help">Default: <code>http://192.168.50.242:8888</code>. The address is editable for another hosted deployment.</p><label>Account<input value={config.username} onChange={(e) => update("username", e.target.value)} autoComplete="username" /></label><label className="check-row"><input type="checkbox" checked={config.remember} onChange={(e) => update("remember", e.target.checked)} /> Remember the password using encrypted Windows storage</label></article><article className="card"><div className="eyebrow">LANGUAGE & TONE</div><label>Language mode<select value={config.language} onChange={(e) => update("language", e.target.value as Language)}><option value="en">English</option><option value="yue">Playful Hong Kong Cantonese</option><option value="bilingual">English + Cantonese</option></select></label><label>English funny level <output className="range-output">{config.funnyEnglish}</output><input type="range" min="1" max="5" value={config.funnyEnglish} onChange={(e) => update("funnyEnglish", Number(e.target.value))} /></label><label>Cantonese funny level <output className="range-output">{config.funnyCantonese}</output><input type="range" min="1" max="5" value={config.funnyCantonese} onChange={(e) => update("funnyCantonese", Number(e.target.value))} /></label><p className="field-help">Funny level changes voice only. Temperatures, errors, commands, and safety facts stay exact.</p></article><article className="card"><div className="eyebrow">APPEARANCE</div><label>Theme<select value={config.theme} onChange={(e) => update("theme", e.target.value as "dark" | "light")}><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Density<select value={config.density} onChange={(e) => update("density", e.target.value as "compact" | "comfortable")}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><p className="field-help">The controller paints its own Material-inspired surface; it never changes the hosted defender's theme.</p></article><article className="card"><div className="eyebrow">SIGNED UPDATE FEED</div><label>HTTPS feed URL (optional)<input value={config.updateFeedUrl} onChange={(e) => update("updateFeedUrl", e.target.value)} placeholder="https://updates.example.invalid/ac-defender/" /></label><p className="field-help">On Windows, Squirrel verifies the signed RELEASES feed and downloads in the background. This controller never fabricates an installer or executes an unverified file. The restart prompt appears only after Electron reports a verified update.</p><button className="button button-tonal" onClick={() => void onUpdateCheck()}>Check for updates</button></article><article className="card"><div className="eyebrow">SEARCH / REGEX BUILDER</div><div className="search-row"><input aria-label="Search settings" placeholder="Search this settings surface" /><button className="icon-button" onClick={() => setRegexOpen(!regexOpen)} aria-expanded={regexOpen} aria-label="Open regex builder">.*</button></div>{regexOpen && <div className="regex-popover"><label><span>Regex mode</span><input type="checkbox" checked={regexMode} onChange={(e) => setRegexMode(e.target.checked)} /> Enable pattern matching</label><label>Pattern<input value={regexPattern} onChange={(e) => { setRegexPattern(e.target.value); validatePattern(e.target.value); }} placeholder="temperature|theme" /></label><label>Flags<input value={regexFlags} onChange={(e) => { setRegexFlags(e.target.value); validatePattern(regexPattern, e.target.value); }} /></label>{regexError ? <p className="regex-error">{regexError}</p> : <p className="field-help">Plain text remains the default. {regexMode ? "Pattern is ready for this search surface." : "Enable regex only when you need it."}</p>}</div>}</article></div></section>;
}

function CommandPalette({ query, setQuery, onClose, onNavigate, t }: { query: string; setQuery: (value: string) => void; onClose: () => void; onNavigate: (destination: Tab) => void; t: (value: Copy) => string }) {
  const commands: { name: Copy; hint: Copy; destination: Tab }[] = [{ name: labels.dashboard, hint: { en: "Live wall telemetry and real commands", yue: "真實牆機遙測同指令" }, destination: "dashboard" }, { name: labels.notifications, hint: { en: "Review server notification history", yue: "睇返伺服器通知紀錄" }, destination: "notifications" }, { name: labels.settings, hint: { en: "Connection, language, tone, appearance", yue: "連線、語言、語氣、外觀" }, destination: "settings" }];
  const lower = query.trim().toLowerCase();
  const matches = commands.filter((item) => !lower || `${item.name.en} ${item.name.yue} ${item.hint.en}`.toLowerCase().includes(lower));
  return <div className="modal-scrim" role="presentation"><section className="palette" role="dialog" aria-modal="true" aria-labelledby="palette-title"><div className="palette-head"><h2 id="palette-title">{t(labels.commandPalette)}</h2><kbd>Ctrl+Shift+F</kbd><button className="icon-button" onClick={onClose} aria-label="Close command palette">×</button></div><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search commands and settings…" aria-label="Search commands" /><div className="palette-results">{matches.map((item) => <button key={item.destination} className="palette-row" onClick={() => onNavigate(item.destination)}><strong>{t(item.name)}</strong><span>{t(item.hint)}</span></button>)}{!matches.length && <p className="empty-state">No command matches this query.</p>}</div><p className="field-help">Select a destination to open its tab; focus returns to the palette on Escape.</p></section></div>;
}

export default App;
