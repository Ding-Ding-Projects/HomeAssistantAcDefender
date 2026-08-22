import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DefenderSnapshot, NotificationItem, NotificationSnapshot } from "./api";
import "./App.css";

type Language = "en" | "yue" | "bilingual";
type Tab = "dashboard" | "notifications" | "settings";
type Copy = { en: string; yue: string };

const UNSIGNED_UPDATE_WARNING = "Updates use HTTPS transport plus RELEASES/package hashes; artifacts are unsigned and may trigger an operating-system warning.";

const DEFAULT_CONFIG: ControllerConfig = {
  baseUrl: "http://127.0.0.1:8888", username: "", password: "", remember: false,
  language: "en", funnyEnglish: 2, funnyCantonese: 3, theme: "dark", density: "compact", accent: "#9de7c0", fontFamily: "Segoe UI Variable", fontScale: 1, updateFeedUrl: "",
  activeTab: "dashboard", tabOrder: ["dashboard", "notifications", "settings"], tabAppearance: {
    dashboard: { foreground: "#e6f1eb", background: "#16221e", fontSize: 14 },
    notifications: { foreground: "#e6f1eb", background: "#16221e", fontSize: 14 },
    settings: { foreground: "#e6f1eb", background: "#16221e", fontSize: 14 }
  }
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
  const [settingsFocus, setSettingsFocus] = useState<string | null>(null);
  const [appearanceTab, setAppearanceTab] = useState<Tab | null>(null);
  const [appearanceDraft, setAppearanceDraft] = useState({ foreground: "#e6f1eb", background: "#16221e", fontSize: 14 });
  const [draggedTab, setDraggedTab] = useState<Tab | null>(null);
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
  const [updateReady, setUpdateReady] = useState<{ releaseName?: string; releaseNotes?: string; unsignedWarning?: string } | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stopReady = window.controller.onUpdateReady((payload) => setUpdateReady(payload));
    const stopUpdateError = window.controller.onUpdateError((payload) => setError(payload.message || "The update feed reported an error."));
    window.controller.loadConfig().then((saved) => {
      setConfig((current) => ({ ...current, ...saved }));
      setTab(saved.activeTab || "dashboard");
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
      applySnapshot(next); setConfig((current) => ({ ...current, password: "" })); setPhase("live"); setNotice(t({ en: "Connected to the live defender.", yue: "已經連到真實運行緊嘅 defender。" }));
    } catch (e) { setConfig((current) => ({ ...current, password: "" })); setError(errorText(e)); setPhase("login"); }
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
  const appearanceStyle = { "--primary": config.accent, "--font-family": `"${config.fontFamily}", "Segoe UI", system-ui, sans-serif`, "--font-scale": String(config.fontScale) } as React.CSSProperties;
  const tabOrder = (config.tabOrder?.filter((value, index, all) => ["dashboard", "notifications", "settings"].includes(value) && all.indexOf(value) === index) || ["dashboard", "notifications", "settings"]) as Tab[];
  const tabLabels: Record<Tab, Copy> = { dashboard: labels.dashboard, notifications: labels.notifications, settings: labels.settings };
  const defaultTabAppearance = { foreground: "#e6f1eb", background: "#16221e", fontSize: 14 };
  function persistTabs(patch: Partial<ControllerConfig>) {
    setConfig({ ...config, ...patch });
    void window.controller.saveConfig(patch).catch((e) => setError(errorText(e)));
  }
  function selectTab(next: Tab) { setTab(next); setSettingsFocus(null); persistTabs({ activeTab: next }); if (next === "notifications") void loadNotifications(); }
  function reorderTabs(source: Tab, target: Tab) {
    if (source === target) return;
    const next = [...tabOrder];
    const sourceIndex = next.indexOf(source); const targetIndex = next.indexOf(target);
    if (sourceIndex < 0 || targetIndex < 0) return;
    next.splice(sourceIndex, 1); next.splice(targetIndex, 0, source); persistTabs({ tabOrder: next });
  }
  function openAppearance(id: Tab) { setAppearanceTab(id); setAppearanceDraft({ ...(config.tabAppearance?.[id] || defaultTabAppearance) }); }
  function saveAppearance() {
    if (!appearanceTab) return;
    const tabAppearance = { ...(config.tabAppearance || {}), [appearanceTab]: appearanceDraft };
    persistTabs({ tabAppearance }); setAppearanceTab(null);
  }
  function resetAppearance() { setAppearanceDraft({ ...defaultTabAppearance }); }

  if (phase !== "live") {
    return <main className={`login-shell ${themeClass}`} style={appearanceStyle}>
      <WindowTitleBar />
      <section className="login-card" aria-labelledby="login-title">
        <img src="./shield.svg" className="brand-mark" alt="AC Defender shield" />
        <h1 id="login-title">{t(labels.app)}</h1>
        <p className="supporting">{t(labels.subtitle)}</p>
        <label>Defender address<input value={config.baseUrl} onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })} placeholder="http://127.0.0.1:8888" /></label>
        <p className="field-help">The loopback default is editable. Enter the approved hosted address and use HTTPS for a non-local network.</p>
        <label>Username<input value={config.username} onChange={(e) => setConfig({ ...config, username: e.target.value })} autoComplete="username" /></label>
        <label>Password<input type="password" value={config.password} onChange={(e) => setConfig({ ...config, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && connect()} autoComplete="current-password" /></label>
        <label className="check-row"><input type="checkbox" checked={config.remember} onChange={(e) => setConfig({ ...config, remember: e.target.checked })} /> Remember securely on this computer</label>
        <div className="privacy-note">Credentials stay in the Electron main process; a remembered password is encrypted with Windows app storage when available. Nothing is logged by this controller.</div>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        <button className="button button-filled" onClick={connect} disabled={phase === "connecting"}>{phase === "connecting" ? t(labels.connecting) : t(labels.connect)}</button>
      </section>
    </main>;
  }

  return <main className={`app-shell ${themeClass}`} style={appearanceStyle}>
    <WindowTitleBar />
    <header className="top-app-bar">
      <div className="brand"><img src="./shield.svg" alt="" /><div><strong>{t(labels.app)}</strong><small>Windows controller · real API only</small></div></div>
      <span className={`status-chip ${online ? "chip-ok" : "chip-warn"}`}>{online ? "● ONLINE" : "○ OFFLINE"}</span>
      <span className={`status-chip ${snapshot?.defenderEnabled ? "chip-ok" : "chip-neutral"}`}>{snapshot?.defenderEnabled ? t(labels.defending) : t(labels.stoodDown)}</span>
      <span className="grow" />
      <button className="icon-button" title="Open command palette (Ctrl+Shift+F)" aria-label="Open command palette" onClick={() => setPaletteOpen(true)}>⌘</button>
      <button className="button button-tonal" onClick={() => refresh()} disabled={busy}>{t(labels.refresh)}</button>
    </header>
    <div className="tab-strip-shell">
      <nav className="tab-scroll" role="tablist" aria-label="Controller pages">
        {tabOrder.map((id) => { const appearance = config.tabAppearance?.[id] || defaultTabAppearance; return <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`tabpanel-${id}`} onClick={() => selectTab(id)} draggable onDragStart={() => setDraggedTab(id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedTab) reorderTabs(draggedTab, id); setDraggedTab(null); }} onContextMenu={(event) => { event.preventDefault(); openAppearance(id); }} onKeyDown={(event) => { if (event.ctrlKey && event.shiftKey && event.key === "ArrowLeft") { event.preventDefault(); const index = tabOrder.indexOf(id); if (index > 0) reorderTabs(id, tabOrder[index - 1]); } if (event.ctrlKey && event.shiftKey && event.key === "ArrowRight") { event.preventDefault(); const index = tabOrder.indexOf(id); if (index < tabOrder.length - 1) reorderTabs(id, tabOrder[index + 1]); } if (event.key === "F2") { event.preventDefault(); openAppearance(id); } }} className={tab === id ? "tab active" : "tab"} style={{ color: appearance.foreground, backgroundColor: appearance.background, fontSize: `${appearance.fontSize}px` }} title={`${t(tabLabels[id])} · right-click or F2 to edit appearance`}>{t(tabLabels[id])}</button>; })}
      </nav>
      <p className="tab-help">Drag to reorder · <kbd>Ctrl+Shift+←/→</kbd> move · <kbd>F2</kbd> edit appearance</p>
      {appearanceTab && <div className="tab-appearance-popover" role="dialog" aria-label={`Edit ${t(tabLabels[appearanceTab])} tab appearance`}><strong>Edit {t(tabLabels[appearanceTab])} appearance</strong><label>Text color<input type="color" value={appearanceDraft.foreground} onChange={(e) => setAppearanceDraft({ ...appearanceDraft, foreground: e.target.value })} /></label><label>Surface color<input type="color" value={appearanceDraft.background} onChange={(e) => setAppearanceDraft({ ...appearanceDraft, background: e.target.value })} /></label><label>Font size <output>{appearanceDraft.fontSize}px</output><input type="range" min="11" max="28" value={appearanceDraft.fontSize} onChange={(e) => setAppearanceDraft({ ...appearanceDraft, fontSize: Number(e.target.value) })} /></label><div className="button-row"><button className="button button-tonal" onClick={resetAppearance}>Reset</button><button className="button button-filled" onClick={saveAppearance}>Save</button><button className="button button-tonal" onClick={() => setAppearanceTab(null)}>Cancel</button></div></div>}
    </div>
    {error && <div className="banner banner-error" role="alert">{error}<button className="banner-close" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="banner banner-success" role="status">{notice}<button className="banner-close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
    {updateReady && <div className="update-banner" role="status"><strong>Unsigned update ready</strong><span>{updateReady.releaseName || "A downloaded Windows update is ready."} {updateReady.unsignedWarning || UNSIGNED_UPDATE_WARNING}</span><button className="button button-filled" disabled={updateBusy} onClick={async () => { setUpdateBusy(true); try { await window.controller.installUpdate(); } catch (e) { setError(errorText(e)); setUpdateBusy(false); } }}>Restart to install update</button><button className="banner-close" onClick={() => setUpdateReady(null)} aria-label="Dismiss update reminder">Later</button></div>}
     <section className="page-content" id={`tabpanel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>{tab === "dashboard" && <Dashboard snapshot={snapshot} thermostat={thermostat} runtime={runtime} target={currentTarget} targetDraft={targetDraft} setTargetDraft={setTargetDraft} busy={busy} action={action} setOffConfirm={setOffConfirm} t={t} eventRows={eventRows} />}{tab === "notifications" && <Notifications snapshot={notifications} onLoad={loadNotifications} onAction={async (id, verb) => { try { setNotifications(await window.controller.notificationAction(id, verb)); } catch (e) { setError(errorText(e)); } }} t={t} />}{tab === "settings" && <Settings focusTarget={settingsFocus} config={config} setConfig={setConfig} onSave={async () => { try { setConfig(await window.controller.saveConfig(config)); setNotice(t({ en: "Preferences saved on this Windows profile.", yue: "偏好已經儲存喺呢部 Windows 電腦。" })); } catch (e) { setError(errorText(e)); } }} onUpdateCheck={async () => { try { await window.controller.configureUpdater(config.updateFeedUrl); const result = await window.controller.checkForUpdate(); setNotice(result.status === "disabled" ? "Update feed is not configured." : `${result.unsignedWarning || UNSIGNED_UPDATE_WARNING} Update check: ${result.status}.`); } catch (e) { setError(errorText(e)); } }} t={t} regexOpen={regexOpen} setRegexOpen={setRegexOpen} regexMode={regexMode} setRegexMode={setRegexMode} regexPattern={regexPattern} setRegexPattern={setRegexPattern} regexFlags={regexFlags} setRegexFlags={setRegexFlags} regexError={regexError} setRegexError={setRegexError} />}</section>
    {offConfirm && <div className="modal-scrim" role="presentation"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="off-title"><h2 id="off-title">Turn the real thermostat off?</h2><p>This sends <code>POST /api/thermostat/off</code> to Home Assistant through the hosted defender. It changes a real device; no simulated state is used.</p><div className="dialog-actions"><button className="button button-tonal" onClick={() => setOffConfirm(false)}>Cancel</button><button className="button button-danger" disabled={busy} onClick={() => { setOffConfirm(false); void action(() => window.controller.command("thermostatOff"), { en: "Thermostat OFF command sent.", yue: "已經發出關閉溫控器指令。" }); }}>Turn off real thermostat</button></div></section></div>}
    {paletteOpen && <CommandPalette query={paletteQuery} setQuery={setPaletteQuery} onClose={() => setPaletteOpen(false)} onNavigate={(destination, focus) => { setTab(destination); setSettingsFocus(focus || null); setPaletteOpen(false); if (destination === "notifications") loadNotifications(); }} t={t} />}
  </main>;
}

function WindowTitleBar() {
  return <div className="window-titlebar" role="toolbar" aria-label="Window controls">
    <div className="window-titlebar__brand"><img src="./shield.svg" alt="" /><span>AC Defender Controller</span></div>
    <div className="window-titlebar__actions">
      <button type="button" className="window-control" onClick={() => void window.controller.windowControl("minimize")} aria-label="Minimize window">−</button>
      <button type="button" className="window-control" onClick={() => void window.controller.windowControl("maximize")} aria-label="Maximize or restore window">□</button>
      <button type="button" className="window-control window-control--close" onClick={() => void window.controller.windowControl("close")} aria-label="Close window">×</button>
    </div>
  </div>;
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

type RegexBuilderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pattern: string;
  flags: string;
  onPatternChange: (value: string) => void;
  onFlagsChange: (value: string) => void;
  onUse?: (pattern: string, flags: string) => void;
  mode?: boolean;
  onModeChange?: (mode: boolean) => void;
  title?: string;
};

function RegexBuilder({ open, onOpenChange, pattern, flags, onPatternChange, onFlagsChange, onUse, mode: controlledMode, onModeChange, title = "Regex builder" }: RegexBuilderProps) {
  const [sample, setSample] = useState("Room 24.5°C; target 22°C");
  const [internalMode, setInternalMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const validation = useMemo(() => {
    if (!pattern) return { regex: null as RegExp | null, error: null as string | null };
    try { return { regex: new RegExp(pattern, flags), error: null }; }
    catch (error) { return { regex: null, error: errorText(error) }; }
  }, [pattern, flags]);
  const matches = useMemo(() => {
    if (!validation.regex || !sample || sample.length > 10000) return [] as RegExpMatchArray[];
    try {
      const scanFlags = flags.includes("g") ? flags : `${flags}g`;
      return [...sample.matchAll(new RegExp(pattern, scanFlags))];
    } catch { return []; }
  }, [validation.regex, pattern, flags, sample]);
  const mode = controlledMode ?? internalMode;
  function append(snippet: string) { onPatternChange(`${pattern}${snippet}`.slice(0, 500)); }
  async function copyPattern() {
    if (!pattern || validation.error) return;
    try { await navigator.clipboard.writeText(`/${pattern}/${flags}`); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { setCopied(false); }
  }
  return <>
    <button className="icon-button builder-trigger" onClick={() => onOpenChange(!open)} aria-expanded={open} aria-label={`Open ${title}`}>.*</button>
    {open && <div className="regex-popover" role="dialog" aria-label={title}>
      <div className="regex-title"><strong>{title}</strong><label className="check-row"><input type="checkbox" checked={mode} onChange={(e) => { setInternalMode(e.target.checked); onModeChange?.(e.target.checked); }} /> Regex mode</label></div>
      <div className="regex-guides" aria-label="Guided regex blocks">{[["Literal", "literal"], ["Class", "[A-Z]"], ["Anchor", "^$"], ["Group", "( )"], ["Alt", "(?:a|b)"], ["Quantifier", "{1,3}"]].map(([label, snippet]) => <button key={label} type="button" className="guide-chip" onClick={() => append(snippet)}>{label}</button>)}</div>
      <label>Raw pattern<input value={pattern} maxLength={500} onChange={(e) => onPatternChange(e.target.value)} placeholder="temperature|target" /></label>
      <label>Flags<input value={flags} maxLength={8} onChange={(e) => onFlagsChange(e.target.value.replace(/[^dgimsuvy]/g, ""))} placeholder="gim" /></label>
      <label>Sample text<textarea value={sample} maxLength={10000} onChange={(e) => setSample(e.target.value)} rows={3} /></label>
      {validation.error ? <p className="regex-error" role="alert">Invalid pattern: {validation.error}</p> : <p className="regex-valid" role="status">{pattern ? `Valid ${mode ? "regex" : "regex preview"}; ${matches.length} match${matches.length === 1 ? "" : "es"}.` : "Enter a pattern to preview matches."}</p>}
      {matches.length > 0 && <ol className="regex-matches">{matches.slice(0, 50).map((match, index) => <li key={`${match.index}-${index}`}><code>{match[0]}</code>{match.slice(1).length > 0 && <span> captures: {match.slice(1).map((capture, captureIndex) => <code key={captureIndex}>{capture ?? "∅"}</code>)}</span>}</li>)}</ol>}
      <div className="regex-actions"><button type="button" className="button button-tonal" onClick={() => void copyPattern()} disabled={!pattern || !!validation.error}>{copied ? "Copied" : "Copy /pattern/flags"}</button>{onUse && <button type="button" className="button button-filled" onClick={() => { if (pattern && !validation.error) onUse(pattern, flags); }} disabled={!pattern || !!validation.error}>Use in search</button>}</div>
    </div>}
  </>;
}

function Notifications({ snapshot, onLoad, onAction, t }: { snapshot: NotificationSnapshot | null; onLoad: () => Promise<void>; onAction: (id: string, action: "read" | "dismiss" | "restore") => Promise<void>; t: (value: Copy) => string }) {
  const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
  const [query, setQuery] = useState("");
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("i");
  const [regexMode, setRegexMode] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [regex, setRegex] = useState<RegExp | null>(null);
  const filtered = items.filter((item) => {
    const haystack = `${item.level} ${item.message}`;
    if (regexMode && regex) return regex.test(haystack);
    return !query.trim() || haystack.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  function usePattern(next: string, nextFlags: string) { try { const cleanFlags = nextFlags.replace("g", ""); setRegex(new RegExp(next, cleanFlags)); setRegexMode(true); setPattern(next); setFlags(nextFlags); setQuery(next); } catch { setRegex(null); } }
  return <section className="stack-page"><div className="page-heading"><div><h2>{t(labels.notifications)}</h2><p className="supporting">Reviewable server history; dismissing never deletes the record.</p></div><button className="button button-tonal" onClick={() => void onLoad()}>{t(labels.refresh)}</button></div><div className="card"><div className="eyebrow">{snapshot?.unreadCount ?? 0} UNREAD · {snapshot?.activeCount ?? items.length} ACTIVE</div><div className="search-row"><input aria-label="Search notifications" value={query} onChange={(e) => { setQuery(e.target.value); setRegex(null); setRegexMode(false); }} placeholder="Search notification history" /><RegexBuilder open={builderOpen} onOpenChange={setBuilderOpen} pattern={pattern} flags={flags} mode={regexMode} onModeChange={(enabled) => { setRegexMode(enabled); if (!enabled) setRegex(null); }} onPatternChange={(value) => { setPattern(value); try { setRegex(regexMode && value ? new RegExp(value, flags.replace("g", "")) : null); } catch { setRegex(null); } }} onFlagsChange={(value) => { setFlags(value); try { setRegex(regexMode && pattern ? new RegExp(pattern, value.replace("g", "")) : null); } catch { setRegex(null); } }} onUse={usePattern} title="Notification search regex builder" /></div>{filtered.length ? <ul className="notification-list">{filtered.map((item: NotificationItem, index: number) => <li key={item.id || index} className={item.read ? "notification read" : "notification"}><div><strong>{item.level || "Notification"}</strong><p>{item.message}</p><time>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "—"}</time></div><div className="button-row">{!item.read && <button className="button button-tonal" onClick={() => void onAction(item.id, "read")}>Mark read</button>}{!item.dismissed && <button className="button button-tonal" onClick={() => void onAction(item.id, "dismiss")}>Dismiss</button>}{item.dismissed && <button className="button button-tonal" onClick={() => void onAction(item.id, "restore")}>Restore</button>}</div></li>)}</ul> : <p className="empty-state">No notifications match this search.</p>}</div></section>;
}

function Settings({ focusTarget, config, setConfig, onSave, onUpdateCheck, t, regexOpen, setRegexOpen, regexMode, setRegexMode, regexPattern, setRegexPattern, regexFlags, setRegexFlags, regexError, setRegexError }: { focusTarget?: string | null; config: ControllerConfig; setConfig: (value: ControllerConfig) => void; onSave: () => Promise<void>; onUpdateCheck: () => Promise<void>; t: (value: Copy) => string; regexOpen: boolean; setRegexOpen: (value: boolean) => void; regexMode: boolean; setRegexMode: (value: boolean) => void; regexPattern: string; setRegexPattern: (value: string) => void; regexFlags: string; setRegexFlags: (value: string) => void; regexError: string | null; setRegexError: (value: string | null) => void }) {
  const [settingsQuery, setSettingsQuery] = useState("");
  useEffect(() => { if (focusTarget) window.setTimeout(() => document.getElementById(focusTarget)?.focus(), 0); }, [focusTarget]);
  function update<K extends keyof ControllerConfig>(key: K, value: ControllerConfig[K]) { setConfig({ ...config, [key]: value }); }
  const settingNames = ["Defender address", "Account", "Remember password", "Language mode", "English funny level", "Cantonese funny level", "Theme", "Density", "HTTPS update feed URL", "Regex builder"];
  let matchingSettings = settingNames.filter((name) => !settingsQuery.trim() || name.toLocaleLowerCase().includes(settingsQuery.trim().toLocaleLowerCase()));
  if (regexMode && regexPattern) { try { const matcher = new RegExp(regexPattern, regexFlags.replace("g", "")); matchingSettings = settingNames.filter((name) => matcher.test(name)); } catch { matchingSettings = []; } }
  return <section className="stack-page">
    <div className="page-heading"><div><h2>{t(labels.settings)}</h2><p className="supporting">Preferences belong to this Windows controller, not to defender logic.</p></div><button className="button button-filled" onClick={() => void onSave()}>{t(labels.save)}</button></div>
    <div className="settings-grid">
      <article className="card"><div className="eyebrow">CONNECTION</div><label>Defender address<input id="settings-base-url" value={config.baseUrl} onChange={(e) => update("baseUrl", e.target.value)} /></label><p className="field-help">Default: <code>http://127.0.0.1:8888</code>. The address is editable for another hosted deployment.</p><label>Account<input id="settings-account" value={config.username} onChange={(e) => update("username", e.target.value)} autoComplete="username" /></label><label className="check-row"><input type="checkbox" checked={config.remember} onChange={(e) => update("remember", e.target.checked)} /> Remember the password using encrypted Windows storage</label></article>
      <article className="card"><div className="eyebrow">LANGUAGE & TONE</div><label>Language mode<select id="settings-language" value={config.language} onChange={(e) => update("language", e.target.value as Language)}><option value="en">English</option><option value="yue">Playful Hong Kong Cantonese</option><option value="bilingual">English + Cantonese</option></select></label><label>English funny level <output className="range-output">{config.funnyEnglish}</output><input id="settings-funny-en" type="range" min="1" max="5" value={config.funnyEnglish} onChange={(e) => update("funnyEnglish", Number(e.target.value))} /></label><label>Cantonese funny level <output className="range-output">{config.funnyCantonese}</output><input id="settings-funny-yue" type="range" min="1" max="5" value={config.funnyCantonese} onChange={(e) => update("funnyCantonese", Number(e.target.value))} /></label><p className="field-help">Funny level changes voice only. Temperatures, errors, commands, and safety facts stay exact.</p></article>
      <article className="card"><div className="eyebrow">APPEARANCE</div><label>Theme<select id="settings-theme" value={config.theme} onChange={(e) => update("theme", e.target.value as "dark" | "light")}><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Density<select id="settings-density" value={config.density} onChange={(e) => update("density", e.target.value as "compact" | "comfortable")}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label><label>Accent / seed color <span className="color-editor"><input id="settings-accent" type="color" value={config.accent} onChange={(e) => update("accent", e.target.value)} /><input aria-label="Accent color HEX" value={config.accent} pattern="^#[0-9a-fA-F]{6}$" onChange={(e) => { const value = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(value)) update("accent", value); }} onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(config.accent)) update("accent", "#9de7c0"); }} /></span></label><label>UI font family<select id="settings-font-family" value={config.fontFamily} onChange={(e) => update("fontFamily", e.target.value)}>{["Segoe UI Variable", "Segoe UI", "Arial", "Cascadia Code", "Consolas", "system-ui"].map((font) => <option key={font} value={font}>{font}</option>)}</select></label><label>UI size scale <output className="range-output">{Math.round(config.fontScale * 100)}%</output><input id="settings-font-scale" type="range" min="0.85" max="1.35" step="0.05" value={config.fontScale} onChange={(e) => update("fontScale", Number(e.target.value))} /></label><div className="appearance-preview" style={{ color: config.accent, fontFamily: config.fontFamily }}>Live preview · AC Defender Controller</div><p className="field-help">Theme, density, accent, font family, and scale apply live to this Windows controller and persist in its profile. They never change defender logic.</p></article>
      <article className="card"><div className="eyebrow">UNSIGNED HTTPS UPDATE FEED</div><label>HTTPS feed URL (optional)<input id="settings-update-feed" value={config.updateFeedUrl} onChange={(e) => update("updateFeedUrl", e.target.value)} placeholder="https://updates.example.invalid/ac-defender/" /></label><p className="field-help">{UNSIGNED_UPDATE_WARNING} The restart prompt appears only after Electron reports that the package download is ready.</p><button className="button button-tonal" onClick={() => void onUpdateCheck()}>Check for updates</button></article>
      <article className="card"><div className="eyebrow">SEARCH / REGEX BUILDER</div><div className="search-row"><input id="settings-search" aria-label="Search settings" value={settingsQuery} onChange={(e) => { setSettingsQuery(e.target.value); setRegexMode(false); }} placeholder="Search this settings surface" /><RegexBuilder open={regexOpen} onOpenChange={setRegexOpen} pattern={regexPattern} flags={regexFlags} mode={regexMode} onModeChange={setRegexMode} onPatternChange={(value) => { setRegexPattern(value); try { if (value) new RegExp(value, regexFlags); setRegexError(null); } catch (e) { setRegexError(errorText(e)); } }} onFlagsChange={(value) => { setRegexFlags(value); try { if (regexPattern) new RegExp(regexPattern, value); setRegexError(null); } catch (e) { setRegexError(errorText(e)); } }} onUse={(pattern) => { setRegexMode(true); setSettingsQuery(pattern); }} title="Settings search regex builder" /></div><p className="field-help">{matchingSettings.length} setting{matchingSettings.length === 1 ? "" : "s"} match. Plain text is default; the anchored builder supports guided blocks, captures, and copy.</p><div className="settings-matches">{matchingSettings.map((name) => <span key={name} className="match-chip">{name}</span>)}</div></article>
    </div>
  </section>;
}

function CommandPalette({ query, setQuery, onClose, onNavigate, t }: { query: string; setQuery: (value: string) => void; onClose: () => void; onNavigate: (destination: Tab, focus?: string) => void; t: (value: Copy) => string }) {
  const commands: { name: Copy; hint: Copy; destination: Tab; focus?: string }[] = [
    { name: labels.dashboard, hint: { en: "Live wall telemetry and real commands", yue: "真實牆機遙測同指令" }, destination: "dashboard" },
    { name: labels.notifications, hint: { en: "Review server notification history", yue: "睇返伺服器通知紀錄" }, destination: "notifications" },
    { name: labels.settings, hint: { en: "Connection, language, tone, appearance, update feed, regex builder", yue: "連線、語言、語氣、外觀、更新、regex 工具箱" }, destination: "settings" },
    { name: { en: "Defender address", yue: "Defender 網址" }, hint: { en: "Settings · Connection", yue: "設定 · 連線" }, destination: "settings", focus: "settings-base-url" },
    { name: { en: "Language mode", yue: "語言模式" }, hint: { en: "Settings · English / Cantonese / bilingual", yue: "設定 · 英文／廣東話／雙語" }, destination: "settings", focus: "settings-language" },
    { name: { en: "English funny level", yue: "英文搞笑程度" }, hint: { en: "Settings · independent level 1–5", yue: "設定 · 獨立 1–5 級" }, destination: "settings", focus: "settings-funny-en" },
    { name: { en: "Cantonese funny level", yue: "廣東話搞笑程度" }, hint: { en: "Settings · independent level 1–5", yue: "設定 · 獨立 1–5 級" }, destination: "settings", focus: "settings-funny-yue" },
    { name: { en: "Theme", yue: "主題" }, hint: { en: "Settings · light or dark", yue: "設定 · 光亮或深色" }, destination: "settings", focus: "settings-theme" },
    { name: { en: "Density", yue: "密度" }, hint: { en: "Settings · compact or comfortable", yue: "設定 · 緊湊或舒適" }, destination: "settings", focus: "settings-density" },
    { name: { en: "Accent color", yue: "主色" }, hint: { en: "Settings · live seed color", yue: "設定 · 即時主色" }, destination: "settings", focus: "settings-accent" },
    { name: { en: "UI font family", yue: "介面字體" }, hint: { en: "Settings · installed font fallback", yue: "設定 · 已安裝字體 fallback" }, destination: "settings", focus: "settings-font-family" },
    { name: { en: "UI size scale", yue: "介面字體比例" }, hint: { en: "Settings · 85% to 135%", yue: "設定 · 85% 至 135%" }, destination: "settings", focus: "settings-font-scale" },
    { name: { en: "Unsigned update feed", yue: "未簽名更新 feed" }, hint: { en: "Settings · HTTPS and package-hash integrity", yue: "設定 · HTTPS 同 package hash 完整性" }, destination: "settings", focus: "settings-update-feed" },
    { name: { en: "Settings search regex builder", yue: "設定搜尋 regex 工具箱" }, hint: { en: "Settings · guided blocks and captures", yue: "設定 · 引導方塊同 capture" }, destination: "settings", focus: "settings-search" }
  ];
  const [builderOpen, setBuilderOpen] = useState(false);
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("i");
  const [regexMode, setRegexMode] = useState(false);
  const [regex, setRegex] = useState<RegExp | null>(null);
  const lower = query.trim().toLowerCase();
  const matches = commands.filter((item) => {
    const haystack = `${item.name.en} ${item.name.yue} ${item.hint.en} ${item.hint.yue}`;
    if (regexMode && regex) return regex.test(haystack);
    return !lower || haystack.toLowerCase().includes(lower);
  });
  function usePattern(next: string, nextFlags: string) { try { const cleanFlags = nextFlags.replace("g", ""); setRegex(new RegExp(next, cleanFlags)); setRegexMode(true); setPattern(next); setFlags(nextFlags); setQuery(next); } catch { setRegex(null); } }
  return <div className="modal-scrim" role="presentation"><section className="palette" role="dialog" aria-modal="true" aria-labelledby="palette-title"><div className="palette-head"><h2 id="palette-title">{t(labels.commandPalette)}</h2><kbd>Ctrl+Shift+F</kbd><button className="icon-button" onClick={onClose} aria-label="Close command palette">×</button></div><div className="search-row"><input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setRegex(null); setRegexMode(false); }} placeholder="Search commands and settings…" aria-label="Search commands" /><RegexBuilder open={builderOpen} onOpenChange={setBuilderOpen} pattern={pattern} flags={flags} mode={regexMode} onModeChange={(enabled) => { setRegexMode(enabled); if (!enabled) setRegex(null); }} onPatternChange={(value) => { setPattern(value); try { setRegex(regexMode && value ? new RegExp(value, flags.replace("g", "")) : null); } catch { setRegex(null); } }} onFlagsChange={(value) => { setFlags(value); try { setRegex(regexMode && pattern ? new RegExp(pattern, value.replace("g", "")) : null); } catch { setRegex(null); } }} onUse={usePattern} title="Command palette regex builder" /></div><div className="palette-results">{matches.map((item) => <button key={`${item.destination}-${item.focus || "page"}`} className="palette-row" onClick={() => onNavigate(item.destination, item.focus)}><strong>{t(item.name)}</strong><span>{t(item.hint)}</span></button>)}{!matches.length && <p className="empty-state">No command matches this query.</p>}</div><p className="field-help">Select a destination to open its tab and focus the exact control; Escape closes the palette. Every destination includes its settings surface and live controls.</p></section></div>;
}

export default App;
