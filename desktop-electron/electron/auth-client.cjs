const { CookieJar } = require("tough-cookie");

// Blazor's <AntiforgeryToken /> emits a hidden __RequestVerificationToken input.
// Keep the name lookup tolerant of framework casing while never crossing form boundaries.
const ANTIFORGERY_NAME = /(?:requestverificationtoken|antiforgery)/i;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BODY_LIMIT_BYTES = 512 * 1024;
const MAX_BASE_URL_LENGTH = 2_048;
const MAX_USERNAME_LENGTH = 256;
const MAX_PASSWORD_LENGTH = 1_024;
const MAX_REQUEST_PAYLOAD_BYTES = 256 * 1024;
const MAX_STATUS_STRING_LENGTH = 2_048;
const MAX_STATUS_EVENTS = 200;
// Mirrors NotificationHistoryStore.MaximumReadLimit and MaximumInMemoryRecords.
const MAX_NOTIFICATION_ITEMS = 500;
const MAX_NOTIFICATION_RECORDS = 20_000;
const MAX_ERROR_DETAIL_LENGTH = 256;
const NOTIFICATION_ACTIONS = new Set(["read", "dismiss", "restore"]);
const MAX_STATUS_DEPTH = 5;
const MAX_STATUS_COLLECTION = 256;
const MAX_STATUS_OBJECT_KEYS = 128;
// The real DefenderSnapshot.Settings currently serializes 281 properties; keep headroom local to that field.
const MAX_SETTINGS_OBJECT_KEYS = 512;

function requireText(value, label, limit, { allowEmpty = true } = {}) {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.length > limit) throw new Error(`${label} is too long.`);
  if (!allowEmpty && value.trim() === "") throw new Error(`${label} is required.`);
  return value;
}

function normalizeUsername(value) {
  return requireText(value, "Username", MAX_USERNAME_LENGTH, { allowEmpty: false }).trim();
}

function normalizeBaseUrl(value) {
  const raw = requireText(value, "Defender address", MAX_BASE_URL_LENGTH, { allowEmpty: false }).trim().replace(/\/+$/, "");
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("Enter a valid http:// or https:// defender address."); }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP and HTTPS defender addresses are supported.");
  if (parsed.username || parsed.password) throw new Error("Do not put credentials in the defender address.");
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipv4Parts = hostname.split(".");
  const isLoopback = hostname === "localhost"
    || hostname === "::1"
    || (ipv4Parts.length === 4 && Number(ipv4Parts[0]) === 127 && ipv4Parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255));
  if (parsed.protocol === "http:" && !isLoopback) {
    throw new Error("HTTPS is required for non-loopback defender addresses.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function credentialIdentity(baseUrl, username) {
  return { baseUrl: normalizeBaseUrl(baseUrl), username: normalizeUsername(username) };
}

function resolveSubmittedPassword(submitted, remembered, storedIdentity, expectedIdentity) {
  const supplied = requireText(submitted, "Password", MAX_PASSWORD_LENGTH);
  if (supplied) return supplied;
  if (!remembered || !storedIdentity || !expectedIdentity
      || storedIdentity.baseUrl !== expectedIdentity.baseUrl
      || storedIdentity.username !== expectedIdentity.username) {
    throw new Error("Enter the defender password for this address and account.");
  }
  return requireText(remembered, "Password", MAX_PASSWORD_LENGTH, { allowEmpty: false });
}

function resolveLoginCredentials({ baseUrl, username, password, rememberedPassword, storedIdentity }) {
  const identity = credentialIdentity(baseUrl, username);
  return { ...identity, password: resolveSubmittedPassword(password, rememberedPassword, storedIdentity, identity) };
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function readAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : undefined;
}

function hiddenInputs(formHtml) {
  const fields = new Map();
  for (const match of formHtml.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const type = (readAttribute(tag, "type") || "text").toLowerCase();
    const name = readAttribute(tag, "name");
    const value = readAttribute(tag, "value");
    if (type === "hidden" && name && value !== undefined) fields.set(name, value);
  }
  return fields;
}

function selectLoginForm(html) {
  requireText(html, "Login response", DEFAULT_BODY_LIMIT_BYTES);
  const candidates = [];
  for (const match of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi)) {
    const hidden = hiddenInputs(match[0]);
    if (hidden.get("_handler") === "login" && hidden.get("action") === "login") candidates.push(hidden);
  }
  if (candidates.length !== 1) throw new Error("The defender login form was missing or ambiguous.");
  const selected = candidates[0];
  const antiforgeryName = [...selected.keys()].find((name) => ANTIFORGERY_NAME.test(name));
  if (!antiforgeryName || selected.get(antiforgeryName) === "") {
    throw new Error("The defender login form did not provide an antiforgery token.");
  }
  return { hidden: {
    _handler: selected.get("_handler"),
    action: selected.get("action"),
    [antiforgeryName]: selected.get(antiforgeryName)
  } };
}

function responseCookies(response) {
  if (!response?.headers) return [];
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie() || [];
  const joined = response.headers.get("set-cookie");
  return joined ? joined.split(/,(?=[^;,]+=)/g) : [];
}

async function applyResponseCookies(jar, response, url) {
  for (const value of responseCookies(response)) {
    try { await jar.setCookie(value, url); }
    catch { throw new Error("The defender returned an invalid session cookie."); }
  }
}

async function cookieHeader(jar, url) {
  const secure = new URL(url).protocol === "https:";
  const cookies = await jar.getCookies(url);
  return cookies.filter((cookie) => secure || !cookie.secure).map((cookie) => cookie.cookieString()).join("; ");
}

function payloadBytes(body) {
  if (body === undefined || body === null) return 0;
  if (typeof body === "string") return Buffer.byteLength(body, "utf8");
  if (body instanceof URLSearchParams) return Buffer.byteLength(body.toString(), "utf8");
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  throw new Error("Request payload format is unsupported.");
}

function validatePayload(body, limit) {
  const bytes = payloadBytes(body);
  if (bytes > limit) throw new Error("Request payload is too large.");
}

function validateNotificationQuery(query = {}) {
  if (!isPlainObject(query)) throw new Error("Notification query must be an object.");
  const limit = query.limit === undefined ? 30 : query.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_NOTIFICATION_ITEMS) throw new Error("Notification limit is out of range.");
  const includeDismissed = query.includeDismissed === undefined ? false : query.includeDismissed;
  if (typeof includeDismissed !== "boolean") throw new Error("includeDismissed must be boolean.");
  return { limit, includeDismissed };
}

function validateNotificationAction(id, action) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("Notification id is invalid.");
  if (typeof action !== "string" || !NOTIFICATION_ACTIONS.has(action)) throw new Error("Notification action is invalid.");
  return { id, action };
}

function validateTemperature(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < -100 || value > 100) throw new Error("Temperature is out of range.");
  return value;
}

function validateEnabled(value) {
  if (typeof value !== "boolean") throw new Error("Defender enabled must be boolean.");
  return value;
}

function boundedErrorDetail(value) {
  return typeof value === "string" && value.length <= MAX_ERROR_DETAIL_LENGTH ? value : "";
}

function createDeadline(signal, timeoutMs) {
  const controller = new AbortController();
  const timeout = Math.max(1, Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS);
  let timedOut = false;
  let callerRejected = false;
  let removeCallerListener = () => {};
  let rejectCaller;
  const callerPromise = new Promise((_resolve, reject) => { rejectCaller = reject; });
  const timeoutError = new Error(`Request timed out after ${timeout} ms.`);
  const timeoutPromise = new Promise((_resolve, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(timeoutError);
      reject(timeoutError);
    }, timeout);
    removeCallerListener = () => clearTimeout(timer);
  });
  if (signal) {
    const abort = () => {
      callerRejected = true;
      const reason = signal.reason || new Error("Request aborted.");
      controller.abort(reason);
      rejectCaller(reason);
    };
    if (signal.aborted) abort();
    else {
      signal.addEventListener("abort", abort, { once: true });
      const previousRemove = removeCallerListener;
      removeCallerListener = () => {
        previousRemove();
        signal.removeEventListener("abort", abort);
      };
    }
  }
  return {
    controller,
    wait: (promise) => Promise.race([promise, callerPromise, timeoutPromise]),
    cleanup: removeCallerListener,
    timedOut: () => timedOut,
    callerRejected: () => callerRejected,
    timeoutError
  };
}

async function readBoundedBody(response, maxBodyBytes, wait) {
  const limit = Math.max(1, Number.isFinite(Number(maxBodyBytes)) ? Number(maxBodyBytes) : DEFAULT_BODY_LIMIT_BYTES);
  if (response?.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const part = await wait(reader.read());
        if (part.done) break;
        const chunk = part.value instanceof Uint8Array ? part.value : new Uint8Array(part.value);
        total += chunk.byteLength;
        if (total > limit) {
          void Promise.resolve(reader.cancel()).catch(() => {});
          throw new Error(`Response body exceeds the ${limit}-byte limit.`);
        }
        chunks.push(Buffer.from(chunk));
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks, total).toString("utf8");
  }
  if (typeof response?.text !== "function") throw new Error("Response body was unavailable.");
  const contentLength = response.headers?.get?.("content-length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > limit) {
    throw new Error(`Response body exceeds the ${limit}-byte limit.`);
  }
  const text = await wait(response.text());
  if (Buffer.byteLength(text, "utf8") > limit) throw new Error(`Response body exceeds the ${limit}-byte limit.`);
  return text;
}

async function boundedRequest(fetchImpl, url, options = {}, limits = {}) {
  if (typeof fetchImpl !== "function") throw new Error("This runtime cannot connect to the defender.");
  validatePayload(options.body, limits.maxRequestPayloadBytes ?? MAX_REQUEST_PAYLOAD_BYTES);
  const deadline = createDeadline(options.signal, limits.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await deadline.wait(fetchImpl(url, { ...options, signal: deadline.controller.signal }));
    const body = await readBoundedBody(response, limits.maxBodyBytes ?? DEFAULT_BODY_LIMIT_BYTES, deadline.wait);
    return { response, body };
  } catch (error) {
    if (deadline.timedOut()) throw deadline.timeoutError;
    if (deadline.callerRejected()) throw error;
    throw error;
  } finally {
    deadline.cleanup();
  }
}

function isSuccessfulRedirectOrResponse(response) {
  return Boolean(response) && response.status >= 200 && response.status < 400;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateBoundedValue(value, label, depth = 0, seen = new Set(), collectionLimit = MAX_STATUS_COLLECTION, objectKeyLimit = MAX_STATUS_OBJECT_KEYS) {
  if (depth > MAX_STATUS_DEPTH) throw new Error(`The ${label} response was nested too deeply.`);
  if (typeof value === "string") {
    if (value.length > MAX_STATUS_STRING_LENGTH) throw new Error(`The ${label} response contained an oversized string.`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) throw new Error(`The ${label} response contained a circular value.`);
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > collectionLimit) throw new Error(`The ${label} response contained an oversized collection.`);
    for (const item of value) validateBoundedValue(item, label, depth + 1, seen, collectionLimit);
  } else {
    const keys = Object.keys(value);
    if (keys.length > objectKeyLimit) throw new Error(`The ${label} response contained too many fields.`);
    for (const key of keys) validateBoundedValue(value[key], label, depth + 1, seen, collectionLimit, depth === 0 && key === "settings" ? MAX_SETTINGS_OBJECT_KEYS : MAX_STATUS_OBJECT_KEYS);
  }
  seen.delete(value);
}

function optionalString(value, field) {
  if (value !== null && typeof value !== "string") throw new Error(`Sign-in succeeded but /api/status returned an invalid ${field} field.`);
}

function optionalNumber(value, field, min = -Number.MAX_VALUE, max = Number.MAX_VALUE) {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)) {
    throw new Error(`Sign-in succeeded but /api/status returned an invalid ${field} field.`);
  }
}

function validateThermostat(value) {
  if (value === null) return;
  if (!isPlainObject(value)) throw new Error("Sign-in succeeded but /api/status returned an invalid homeAssistantThermostat field.");
  optionalNumber(value.currentTemperatureCelsius, "currentTemperatureCelsius", -100, 100);
  optionalNumber(value.setPointCelsius, "setPointCelsius", -100, 100);
  optionalString(value.hvacMode, "hvacMode");
  optionalString(value.hvacAction, "hvacAction");
  optionalString(value.fanMode, "fanMode");
  optionalString(value.updatedAt, "updatedAt");
}

function validateRuntime(value) {
  if (value === null) return;
  if (!isPlainObject(value)) throw new Error("Sign-in succeeded but /api/status returned an invalid acRuntime field.");
  optionalNumber(value.todayHours, "todayHours", 0, 10_000_000);
  optionalNumber(value.monthHours, "monthHours", 0, 10_000_000);
  optionalNumber(value.lifetimeHours, "lifetimeHours", 0, 10_000_000);
  if (value.estimatedCostEnabled !== undefined && typeof value.estimatedCostEnabled !== "boolean") throw new Error("Sign-in succeeded but /api/status returned an invalid estimatedCostEnabled field.");
  optionalNumber(value.estimatedCostTodayDollars, "estimatedCostTodayDollars", 0, 1_000_000_000);
  optionalNumber(value.estimatedCostMonthDollars, "estimatedCostMonthDollars", 0, 1_000_000_000);
  optionalNumber(value.estimatedCostLifetimeDollars, "estimatedCostLifetimeDollars", 0, 1_000_000_000);
}

function validateEvents(value) {
  if (!Array.isArray(value) || value.length > MAX_STATUS_EVENTS) throw new Error("Sign-in succeeded but /api/status returned an invalid events field.");
  for (const event of value) {
    if (!isPlainObject(event)) throw new Error("Sign-in succeeded but /api/status returned an invalid event.");
    optionalString(event.timestamp, "event.timestamp");
    optionalString(event.level, "event.level");
    optionalString(event.message, "event.message");
  }
}

function validateStatusSnapshot(value) {
  if (!isPlainObject(value)) throw new Error("Sign-in succeeded but /api/status returned an invalid snapshot.");
  validateBoundedValue(value, "status");
  // The named fields are the renderer contract. Unknown top-level fields remain forward-compatible,
  // but they still pass the bounded depth, string, collection, and object-key checks above.
  const required = ["targetTemperatureCelsius", "defenderEnabled", "connectionState", "homeAssistantThermostat", "nextAction", "lastError", "acRuntime", "events"];
  for (const field of required) if (!Object.hasOwn(value, field)) throw new Error(`Sign-in succeeded but /api/status omitted ${field}.`);
  optionalNumber(value.targetTemperatureCelsius, "targetTemperatureCelsius", -100, 100);
  if (typeof value.defenderEnabled !== "boolean") throw new Error("Sign-in succeeded but /api/status returned an invalid defenderEnabled field.");
  optionalString(value.connectionState, "connectionState");
  validateThermostat(value.homeAssistantThermostat);
  optionalString(value.nextAction, "nextAction");
  optionalString(value.lastError, "lastError");
  validateRuntime(value.acRuntime);
  validateEvents(value.events);
  return value;
}

function validateNotificationSnapshot(value) {
  if (!isPlainObject(value)) throw new Error("The notifications response was not an object.");
  validateBoundedValue(value, "notifications", 0, new Set(), MAX_NOTIFICATION_ITEMS);
  for (const field of ["items", "unreadCount", "activeCount", "actionCounts"]) if (!Object.hasOwn(value, field)) throw new Error(`The notifications response omitted ${field}.`);
  if (!Array.isArray(value.items) || value.items.length > MAX_NOTIFICATION_ITEMS) throw new Error("The notifications response contained an invalid items collection.");
  for (const item of value.items) {
    if (!isPlainObject(item)) throw new Error("The notifications response contained an invalid notification.");
    const allowedFields = new Set(["id", "timestamp", "level", "message", "read", "dismissed", "readAt", "dismissedAt", "actions"]);
    if (Object.keys(item).some((field) => !allowedFields.has(field))) throw new Error("The notifications response contained an invalid notification field.");
    for (const field of ["id", "timestamp", "level", "message", "read", "dismissed", "readAt", "dismissedAt", "actions"]) if (!Object.hasOwn(item, field)) throw new Error(`The notifications response omitted notification.${field}.`);
    for (const field of ["id", "timestamp", "level", "message", "readAt", "dismissedAt"]) optionalString(item[field], `notification.${field}`);
    for (const field of ["read", "dismissed"]) if (typeof item[field] !== "boolean") throw new Error(`The notifications response contained an invalid notification.${field} field.`);
    if (item.actions !== null && (!Array.isArray(item.actions) || item.actions.length > 32 || item.actions.some((action) => typeof action !== "string" || action.length > 128))) throw new Error("The notifications response contained an invalid notification.actions field.");
  }
  if (typeof value.unreadCount !== "number" || !Number.isInteger(value.unreadCount) || value.unreadCount < 0 || value.unreadCount > MAX_NOTIFICATION_RECORDS) throw new Error("The notifications response contained an invalid unreadCount field.");
  if (typeof value.activeCount !== "number" || !Number.isInteger(value.activeCount) || value.activeCount < 0 || value.activeCount > MAX_NOTIFICATION_RECORDS) throw new Error("The notifications response contained an invalid activeCount field.");
  if (value.actionCounts !== null) {
    if (!isPlainObject(value.actionCounts)) throw new Error("The notifications response contained an invalid actionCounts field.");
    for (const [action, count] of Object.entries(value.actionCounts)) {
      if (action.length > 128 || typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > MAX_NOTIFICATION_RECORDS) throw new Error("The notifications response contained an invalid actionCounts field.");
    }
  }
  return value;
}

const STATUS_ROUTES = new Set([
  "/api/status", "/api/target", "/api/defender", "/api/settings",
  "/api/thermostat/refresh", "/api/thermostat/force-target", "/api/thermostat/force-boost", "/api/thermostat/off"
]);

function validateApiResponse(pathname, body) {
  if (STATUS_ROUTES.has(pathname)) return validateStatusSnapshot(body);
  if (pathname.startsWith("/api/notifications")) return validateNotificationSnapshot(body);
  return body;
}

function createConnectionState(baseUrl = "") {
  return { baseUrl: String(baseUrl || ""), username: "", jar: new CookieJar() };
}

function invalidateConnectionState(current, baseUrl = "") {
  void current;
  return createConnectionState(baseUrl);
}

function requestEffectIfCurrent(active, current, effect) {
  if (active !== current) return false;
  effect();
  return true;
}

function createLoginAttemptCoordinator() {
  let generation = 0;
  return {
    begin: () => ++generation,
    isCurrent: (attempt) => attempt === generation,
    supersededError: () => new Error("Sign-in was superseded by a newer attempt.")
  };
}

function invalidateIfCurrent(coordinator, attempt, invalidate) {
  if (!coordinator.isCurrent(attempt)) return false;
  invalidate();
  return true;
}

async function completeLoginAttempt(coordinator, attempt, candidate, persist, activate) {
  if (!coordinator.isCurrent(attempt)) throw coordinator.supersededError();
  return persistCandidateSession(
    candidate,
    async (value) => {
      if (!coordinator.isCurrent(attempt)) throw coordinator.supersededError();
      await persist(value);
      if (!coordinator.isCurrent(attempt)) throw coordinator.supersededError();
    },
    (session) => {
      if (!coordinator.isCurrent(attempt)) throw coordinator.supersededError();
      activate(session);
    }
  );
}

async function persistCandidateSession(candidate, persist, activate) {
  try {
    await persist(candidate);
  } catch (error) {
    activate(null);
    throw error;
  }
  activate(candidate.session);
  return candidate.status;
}

async function authenticate({ baseUrl, username, password, remember, fetchImpl = globalThis.fetch, signal, timeoutMs = DEFAULT_TIMEOUT_MS, maxBodyBytes = DEFAULT_BODY_LIMIT_BYTES, maxRequestPayloadBytes = MAX_REQUEST_PAYLOAD_BYTES }) {
  if (typeof fetchImpl !== "function") throw new Error("This runtime cannot connect to the defender.");
  const normalized = normalizeBaseUrl(baseUrl);
  const cleanUsername = normalizeUsername(username);
  const cleanPassword = requireText(password, "Password", MAX_PASSWORD_LENGTH, { allowEmpty: false });
  const jar = new CookieJar();
  const request = async (url, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has("Cookie")) {
      const header = await cookieHeader(jar, url);
      if (header) headers.set("Cookie", header);
    }
    const result = await boundedRequest(fetchImpl, url, { ...options, headers, signal }, { timeoutMs, maxBodyBytes, maxRequestPayloadBytes });
    await applyResponseCookies(jar, result.response, url);
    return result;
  };

  let loginPageResult;
  try { loginPageResult = await request(`${normalized}/login`, { redirect: "manual", headers: { Accept: "text/html" } }); }
  catch (error) { throw new Error(`Could not reach defender: ${error instanceof Error ? error.message : String(error)}`); }
  const loginPage = loginPageResult.response;
  if (!isSuccessfulRedirectOrResponse(loginPage) || loginPage.status >= 400) throw new Error(`Login page returned HTTP ${loginPage?.status ?? "unknown"}.`);
  const selected = selectLoginForm(loginPageResult.body);
  if (!(await cookieHeader(jar, `${normalized}/login`))) throw new Error("The defender login page did not provide a session cookie.");

  const fields = new URLSearchParams(selected.hidden);
  fields.set("username", cleanUsername);
  fields.set("password", cleanPassword);
  if (remember) fields.set("keepSignedIn", "true");
  let loginResult;
  try {
    loginResult = await request(`${normalized}/login`, {
      method: "POST", body: fields, redirect: "manual",
      headers: { Accept: "text/html", "Content-Type": "application/x-www-form-urlencoded" }
    });
  } catch (error) { throw new Error(`Could not submit defender login: ${error instanceof Error ? error.message : String(error)}`); }
  const loginResponse = loginResult.response;
  if (loginResponse.status === 200) throw new Error("Incorrect username or password.");
  if (!isSuccessfulRedirectOrResponse(loginResponse)) throw new Error(`Login returned HTTP ${loginResponse?.status ?? "unknown"}.`);
  if (!(await cookieHeader(jar, `${normalized}/api/status`))) throw new Error("The defender login did not establish a session cookie.");

  let statusResult;
  try { statusResult = await request(`${normalized}/api/status`, { headers: { Accept: "application/json" }, redirect: "manual" }); }
  catch (error) { throw new Error(`Sign-in failed or API is unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  const statusResponse = statusResult.response;
  if (!statusResponse || !statusResponse.ok) throw new Error(`Sign-in failed or API returned HTTP ${statusResponse?.status ?? "unknown"}.`);
  let parsedStatus;
  try { parsedStatus = JSON.parse(statusResult.body); }
  catch { throw new Error("Sign-in succeeded but the status response was not valid JSON."); }
  const status = validateStatusSnapshot(parsedStatus);
  return { status, session: { baseUrl: normalized, username: cleanUsername, jar } };
}

module.exports = {
  CookieJar,
  MAX_BASE_URL_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_REQUEST_PAYLOAD_BYTES,
  MAX_STATUS_EVENTS,
  MAX_SETTINGS_OBJECT_KEYS,
  MAX_NOTIFICATION_ITEMS,
  MAX_NOTIFICATION_RECORDS,
  MAX_ERROR_DETAIL_LENGTH,
  boundedRequest,
  authenticate,
  applyResponseCookies,
  cookieHeader,
  credentialIdentity,
  createConnectionState,
  createCookieJar: () => new CookieJar(),
  createLoginAttemptCoordinator,
  completeLoginAttempt,
  invalidateConnectionState,
  invalidateIfCurrent,
  requestEffectIfCurrent,
  persistCandidateSession,
  normalizeBaseUrl,
  normalizeUsername,
  projectConfig: (config) => {
    const source = config && typeof config === "object" ? config : {};
    const { password: _password, credentialBaseUrl: _credentialBaseUrl, credentialUsername: _credentialUsername, ...safe } = source;
    return { ...safe, password: "", remember: Boolean(source.remember && source.credentialBaseUrl && source.credentialUsername) };
  },
  resolveSubmittedPassword,
  resolveLoginCredentials,
  selectLoginForm,
  validateApiResponse,
  validateEnabled,
  validateNotificationAction,
  validateNotificationQuery,
  validateTemperature,
  boundedErrorDetail,
  validateNotificationSnapshot,
  validateStatusSnapshot
};
