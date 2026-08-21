import assert from "node:assert/strict";
import http from "node:http";
import authClient from "../electron/auth-client.cjs";

const {
  authenticate, CookieJar, boundedRequest, cookieHeader, credentialIdentity,
  createConnectionState, createLoginAttemptCoordinator, completeLoginAttempt, invalidateConnectionState, invalidateIfCurrent, requestEffectIfCurrent, MAX_BASE_URL_LENGTH,
  MAX_PASSWORD_LENGTH, MAX_REQUEST_PAYLOAD_BYTES, MAX_STATUS_EVENTS, MAX_SETTINGS_OBJECT_KEYS, MAX_NOTIFICATION_ITEMS, MAX_NOTIFICATION_RECORDS,
  MAX_USERNAME_LENGTH, normalizeBaseUrl, normalizeUsername,
  persistCandidateSession, projectConfig, resolveLoginCredentials,
  resolveSubmittedPassword, validateApiResponse, validateEnabled, validateNotificationAction, validateNotificationQuery, validateTemperature, boundedErrorDetail, validateStatusSnapshot
} = authClient;

const USERNAME = "test-user";
const PASSWORD = "not-a-real-password";
const LOGIN_TOKEN = "login-antiforgery-token";

function loginMarkup({ includeLogin = true, includeToken = true } = {}) {
  const login = includeLogin ? `<form method="post" data-form="login">
    <input type="hidden" name="_handler" value="login">
    <input type="hidden" name="action" value="login">
    ${includeToken ? `<input type="hidden" name="__RequestVerificationToken" value="${LOGIN_TOKEN}">` : ""}
    <input name="username"><input name="password" type="password">
  </form>` : "";
  return `${login}
    <form method="post" data-form="googlestart">
      <input type="hidden" name="_handler" value="googlestart">
      <input type="hidden" name="action" value="googlestart">
      <input type="hidden" name="__RequestVerificationToken" value="google-form-token">
      <button>Google</button>
    </form>`;
}

async function startServer(scenario) {
  const observations = { postCount: 0, statusCount: 0, postCookie: "", statusCookie: "", fields: null };
  const server = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/login") {
      response.writeHead(200, scenario === "missing-cookie"
        ? { "Content-Type": "text/html" }
        : { "Content-Type": "text/html", "Set-Cookie": "GETSESSION=get-cookie; Path=/login; HttpOnly" });
      response.end(loginMarkup({ includeLogin: scenario !== "wrong-form", includeToken: scenario !== "missing-token" }));
      return;
    }
    if (request.method === "POST" && request.url === "/login") {
      observations.postCount += 1;
      observations.postCookie = request.headers.cookie || "";
      let raw = "";
      for await (const chunk of request) raw += chunk;
      observations.fields = new URLSearchParams(raw);
      if (scenario === "missing-cookie" || observations.postCookie !== "GETSESSION=get-cookie") {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end("bad session");
        return;
      }
      if (scenario === "post-failure") {
        response.writeHead(401, { "Content-Type": "text/plain" });
        response.end("rejected");
        return;
      }
      if (scenario === "invalid-credentials") {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(loginMarkup());
        return;
      }
      response.writeHead(302, {
        Location: "/",
        "Set-Cookie": ["AUTHSESSION=post-cookie; Path=/; HttpOnly", "ROTATED=rotated-cookie; Path=/"]
      });
      response.end();
      return;
    }
    if (request.method === "GET" && request.url === "/api/status") {
      observations.statusCount += 1;
      observations.statusCookie = request.headers.cookie || "";
      if (observations.statusCookie !== "AUTHSESSION=post-cookie; ROTATED=rotated-cookie") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "not authenticated" }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "STATUS=status-cookie; Path=/" });
      if (scenario === "invalid-json") response.end("not-json");
      else if (scenario === "invalid-shape") response.end(JSON.stringify({ targetTemperatureCelsius: 22, defenderEnabled: "yes", connectionState: "connected", homeAssistantThermostat: null, nextAction: null, lastError: null, acRuntime: null, events: [] }));
      else response.end(JSON.stringify({
        targetTemperatureCelsius: 22,
        defenderEnabled: true,
        connectionState: "connected",
        homeAssistantThermostat: null,
        nextAction: null,
        lastError: null,
        acRuntime: null,
        events: []
      }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, observations, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

assert.equal(normalizeBaseUrl("http://127.0.0.1:8888/"), "http://127.0.0.1:8888");
assert.equal(normalizeBaseUrl("http://localhost:8888"), "http://localhost:8888");
assert.equal(normalizeBaseUrl("http://[::1]:8888"), "http://[::1]:8888");
assert.equal(normalizeBaseUrl("https://defender.example.test/"), "https://defender.example.test");
assert.throws(() => normalizeBaseUrl("http://192.0.2.10:8888"), /HTTPS is required/);
assert.throws(() => normalizeBaseUrl("http://127.0.0.1.evil.test:8888"), /HTTPS is required/);
assert.throws(() => normalizeBaseUrl("https://user:password@defender.example.test"), /credentials/);
assert.throws(() => normalizeBaseUrl(`https://${"a".repeat(MAX_BASE_URL_LENGTH)}.test`), /Defender address is too long/);
assert.throws(() => normalizeUsername("u".repeat(MAX_USERNAME_LENGTH + 1)), /Username is too long/);

const jar = new CookieJar();
await jar.setCookie("LOGIN_ONLY=login; Path=/login", "http://127.0.0.1:8888/login");
await jar.setCookie("ROOT=root; Path=/", "http://127.0.0.1:8888/login");
await jar.setCookie("SECURE=secure; Secure; Path=/", "http://127.0.0.1:8888/login");
assert.equal(await cookieHeader(jar, "http://127.0.0.1:8888/login"), "LOGIN_ONLY=login; ROOT=root");
assert.equal(await cookieHeader(jar, "http://127.0.0.1:8888/api/status"), "ROOT=root");
await jar.setCookie("ROOT=rotated; Path=/", "http://127.0.0.1:8888/api/status");
assert.equal(await cookieHeader(jar, "http://127.0.0.1:8888/api/status"), "ROOT=rotated");
await jar.setCookie("ROOT=gone; Max-Age=0; Path=/", "http://127.0.0.1:8888/api/status");
assert.equal(await cookieHeader(jar, "http://127.0.0.1:8888/api/status"), "");
await jar.setCookie("DOMAIN=domain; Domain=defender.example.test; Path=/", "http://defender.example.test/login");
assert.match(await cookieHeader(jar, "http://defender.example.test/api/status"), /DOMAIN=domain/);

const projected = projectConfig({ username: USERNAME, password: PASSWORD, remember: true, credentialBaseUrl: "http://127.0.0.1:8888", credentialUsername: USERNAME, baseUrl: "http://127.0.0.1:8888" });
assert.equal(projected.password, "");
assert.equal(projected.remember, true);
const expectedIdentity = credentialIdentity("https://defender.example.test", USERNAME);
assert.equal(resolveSubmittedPassword("", PASSWORD, expectedIdentity, expectedIdentity), PASSWORD);
assert.equal(resolveSubmittedPassword("new-entry", PASSWORD, null, expectedIdentity), "new-entry");
assert.throws(() => resolveSubmittedPassword("", PASSWORD, expectedIdentity, credentialIdentity("https://other.example.test", USERNAME)), /address and account/);
assert.throws(() => resolveSubmittedPassword("", PASSWORD, expectedIdentity, credentialIdentity("https://defender.example.test", "other-user")), /address and account/);
assert.throws(() => resolveSubmittedPassword("", PASSWORD, null, expectedIdentity), /address and account/);
let mismatchFetchCalls = 0;
const mismatchedFetch = () => { mismatchFetchCalls += 1; };
assert.throws(() => {
  const credentials = resolveLoginCredentials({ baseUrl: "https://other.example.test", username: USERNAME, password: "", rememberedPassword: PASSWORD, storedIdentity: expectedIdentity });
  mismatchedFetch(credentials);
}, /address and account/);
assert.equal(mismatchFetchCalls, 0);
assert.deepEqual(validateNotificationQuery({ limit: 500, includeDismissed: true }), { limit: 500, includeDismissed: true });
assert.throws(() => validateNotificationQuery({ limit: 501 }), /out of range/);
assert.throws(() => validateNotificationQuery({ limit: "100" }), /out of range/);
assert.throws(() => validateNotificationQuery({ includeDismissed: "yes" }), /boolean/);
assert.deepEqual(validateNotificationAction("00000000-0000-4000-8000-000000000001", "dismiss"), { id: "00000000-0000-4000-8000-000000000001", action: "dismiss" });
assert.throws(() => validateNotificationAction("../../etc", "dismiss"), /id is invalid/);
assert.throws(() => validateNotificationAction("00000000-0000-4000-8000-000000000001", "dismiss?x=1"), /action is invalid/);
assert.equal(validateTemperature(22), 22);
assert.throws(() => validateTemperature(Number.NaN), /out of range/);
assert.throws(() => validateTemperature(101), /out of range/);
assert.equal(validateEnabled(false), false);
assert.throws(() => validateEnabled("false"), /boolean/);
assert.equal(boundedErrorDetail("x".repeat(256)).length, 256);
assert.equal(boundedErrorDetail("x".repeat(257)), "");
assert.equal(boundedErrorDetail({ error: "not text" }), "");
assert.throws(() => validateStatusSnapshot(null), /invalid snapshot/);
assert.throws(() => validateStatusSnapshot({}), /omitted targetTemperatureCelsius/);
const validSnapshot = {
  targetTemperatureCelsius: 22,
  defenderEnabled: true,
  connectionState: "connected",
  homeAssistantThermostat: { currentTemperatureCelsius: 24, setPointCelsius: 22, hvacMode: "cool", hvacAction: "cooling", fanMode: "auto", updatedAt: "2026-08-21T00:00:00Z" },
  nextAction: null,
  lastError: null,
  acRuntime: { todayHours: 1, monthHours: 2, lifetimeHours: 3, estimatedCostEnabled: true, estimatedCostTodayDollars: 1, estimatedCostMonthDollars: 2, estimatedCostLifetimeDollars: 3 },
  events: []
};
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, defenderEnabled: "yes" }), /invalid defenderEnabled field/);
assert.deepEqual(validateStatusSnapshot({ ...validSnapshot, forwardCompatible: { enabled: true } }).events, []);
const settingsFixture = Object.fromEntries(Array.from({ length: 281 }, (_value, index) => [`setting${index}`, index]));
assert.deepEqual(validateStatusSnapshot({ ...validSnapshot, settings: settingsFixture }).settings, settingsFixture);
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, settings: Object.fromEntries(Array.from({ length: MAX_SETTINGS_OBJECT_KEYS + 1 }, (_value, index) => [`setting${index}`, index])) }), /too many fields/);
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, events: Array.from({ length: MAX_STATUS_EVENTS + 1 }, () => ({})) }), /invalid events field|oversized collection/);
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, events: [{ message: "x".repeat(2049) }] }), /oversized string/);
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, acRuntime: { todayHours: -1 } }), /invalid todayHours/);
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, homeAssistantThermostat: { currentTemperatureCelsius: 101 } }), /invalid currentTemperatureCelsius/);
assert.throws(() => validateStatusSnapshot({ ...validSnapshot, forwardCompatible: { a: { b: { c: { d: { e: { f: true } } } } } } }), /nested too deeply/);
assert.deepEqual(validateApiResponse("/api/status", validSnapshot), validSnapshot);
assert.throws(() => validateApiResponse("/api/status", {}), /omitted targetTemperatureCelsius/);
const notificationFixture = {
  items: [{ id: "00000000-0000-0000-0000-000000000001", timestamp: "2026-08-21T00:00:00Z", level: "info", message: "Ready", read: false, dismissed: false, readAt: null, dismissedAt: null, actions: ["read", "dismiss"] }],
  unreadCount: 1,
  activeCount: 1,
  actionCounts: { read: 1, dismiss: 1 }
};
assert.deepEqual(validateApiResponse("/api/notifications", notificationFixture), notificationFixture);
assert.deepEqual(validateApiResponse("/api/notifications", { ...notificationFixture, items: Array.from({ length: MAX_NOTIFICATION_ITEMS }, () => notificationFixture.items[0]), unreadCount: MAX_NOTIFICATION_RECORDS, activeCount: MAX_NOTIFICATION_RECORDS, actionCounts: { read: MAX_NOTIFICATION_RECORDS } }).unreadCount, MAX_NOTIFICATION_RECORDS);
assert.throws(() => validateApiResponse("/api/notifications", { ...notificationFixture, items: Array.from({ length: MAX_NOTIFICATION_ITEMS + 1 }, () => notificationFixture.items[0]) }), /invalid items collection|oversized collection/);
assert.throws(() => validateApiResponse("/api/notifications", { ...notificationFixture, unreadCount: MAX_NOTIFICATION_RECORDS + 1 }), /invalid unreadCount/);
assert.throws(() => validateApiResponse("/api/notifications", { ...notificationFixture, actionCounts: { read: MAX_NOTIFICATION_RECORDS + 1 } }), /invalid actionCounts/);
assert.throws(() => validateApiResponse("/api/notifications", { ...notificationFixture, items: [{ ...notificationFixture.items[0], title: "legacy title" }] }), /omitted notification|invalid/);
assert.throws(() => validateApiResponse("/api/notifications", { ...notificationFixture, actionCounts: { read: -1 } }), /invalid actionCounts/);

const disconnected = createConnectionState("https://defender.example.test");
const invalidated = invalidateConnectionState(disconnected, "https://other.example.test");
assert.equal(invalidated.username, "");
assert.equal(await cookieHeader(invalidated.jar, "https://other.example.test/api/status"), "");
const oldConnection = createConnectionState("https://same.example.test");
const newerConnection = createConnectionState("https://same.example.test");
let staleEffects = 0;
assert.equal(requestEffectIfCurrent(oldConnection, newerConnection, () => { staleEffects += 1; }), false);
assert.equal(staleEffects, 0);
assert.equal(requestEffectIfCurrent(newerConnection, newerConnection, () => { staleEffects += 1; }), true);
assert.equal(staleEffects, 1);
let newerInvalidated = false;
assert.equal(requestEffectIfCurrent(oldConnection, newerConnection, () => { newerInvalidated = true; }), false);
assert.equal(newerInvalidated, false);
let rendererValue = null;
let activeSession = disconnected;
const activationHistory = [];
const candidate = { status: validSnapshot, session: { baseUrl: "https://defender.example.test", username: USERNAME, jar: new CookieJar() } };
await assert.rejects(
  persistCandidateSession(candidate, async () => { throw new Error("persistence unavailable"); }, (session) => { activationHistory.push(session); activeSession = session || invalidateConnectionState(activeSession); rendererValue = session?.jar || null; }),
  /persistence unavailable/
);
assert.equal(activeSession.username, "");
assert.equal(rendererValue, null);
assert.deepEqual(activationHistory, [null]);

const coordinator = createLoginAttemptCoordinator();
const attemptA = coordinator.begin();
const candidateA = { status: validSnapshot, session: { baseUrl: "https://old.example.test", username: "old-user", jar: new CookieJar() } };
const attemptB = coordinator.begin();
const candidateB = { status: validSnapshot, session: { baseUrl: "https://new.example.test", username: "new-user", jar: new CookieJar() } };
let persistCalls = [];
let activeGenerationSession = null;
await assert.rejects(
  completeLoginAttempt(coordinator, attemptA, candidateA, async () => { persistCalls.push("old"); }, (session) => { activeGenerationSession = session; }),
  /superseded/
);
assert.deepEqual(persistCalls, []);
await completeLoginAttempt(coordinator, attemptB, candidateB, async () => { persistCalls.push("new"); }, (session) => { activeGenerationSession = session; });
assert.deepEqual(persistCalls, ["new"]);
assert.equal(activeGenerationSession.username, "new-user");
let invalidationCalls = 0;
assert.equal(invalidateIfCurrent(coordinator, attemptA, () => { invalidationCalls += 1; }), false);
assert.equal(invalidationCalls, 0);
const disconnectCoordinator = createLoginAttemptCoordinator();
const pendingAttempt = disconnectCoordinator.begin();
disconnectCoordinator.begin();
assert.equal(invalidateIfCurrent(disconnectCoordinator, pendingAttempt, () => { throw new Error("disconnect must not invalidate newer state"); }), false);

await assert.rejects(
  boundedRequest(() => { throw new Error("fetch must not be called for an oversized payload"); }, "https://defender.example.test/api/status", { body: "x".repeat(MAX_REQUEST_PAYLOAD_BYTES + 1) }),
  /Request payload is too large/
);
await assert.rejects(
  authenticate({ baseUrl: "http://127.0.0.1:8888", username: USERNAME, password: "p".repeat(MAX_PASSWORD_LENGTH + 1), fetchImpl: () => { throw new Error("fetch must not be called for an oversized password"); } }),
  /Password is too long/
);

const happy = await startServer("happy");
try {
  const result = await authenticate({ baseUrl: happy.baseUrl, username: USERNAME, password: PASSWORD, remember: true });
  assert.equal(result.status.connectionState, "connected");
  assert.equal(happy.observations.postCount, 1);
  assert.equal(happy.observations.statusCount, 1);
  assert.equal(happy.observations.postCookie, "GETSESSION=get-cookie");
  assert.equal(happy.observations.fields.get("_handler"), "login");
  assert.equal(happy.observations.fields.get("action"), "login");
  assert.equal(happy.observations.fields.get("__RequestVerificationToken"), LOGIN_TOKEN);
  assert.equal(happy.observations.fields.get("username"), USERNAME);
  assert.equal(happy.observations.fields.get("password"), PASSWORD);
  assert.equal(happy.observations.fields.get("keepSignedIn"), "true");
  assert.equal(happy.observations.fields.has("google-form-token"), false);
  assert.equal(happy.observations.statusCookie, "AUTHSESSION=post-cookie; ROTATED=rotated-cookie");
  assert.equal(await cookieHeader(result.session.jar, `${happy.baseUrl}/login`), "GETSESSION=get-cookie; AUTHSESSION=post-cookie; ROTATED=rotated-cookie; STATUS=status-cookie");
  assert.equal(await cookieHeader(result.session.jar, `${happy.baseUrl}/api/status`), "AUTHSESSION=post-cookie; ROTATED=rotated-cookie; STATUS=status-cookie");
  assert.equal(result.session.username, USERNAME);
  assert.equal(Object.hasOwn(result.status, "cookie"), false);
  assert.equal(Object.hasOwn(result.status, "password"), false);
  assert.equal(Object.hasOwn(result.session, "cookie"), false);
  assert.equal(Object.hasOwn(result.session, "password"), false);
} finally {
  await stopServer(happy.server);
}

for (const scenario of ["missing-cookie", "wrong-form", "missing-token", "post-failure", "invalid-json", "invalid-shape"]) {
  const fixture = await startServer(scenario);
  try {
    await assert.rejects(
      authenticate({ baseUrl: fixture.baseUrl, username: USERNAME, password: PASSWORD }),
      scenario === "post-failure" ? /Login returned HTTP 401/ : scenario === "invalid-json" ? /not valid JSON/ : scenario === "invalid-shape" ? /invalid defenderEnabled field/ : /(?:session cookie|login form|antiforgery token)/
    );
    if (scenario === "missing-cookie" || scenario === "wrong-form" || scenario === "missing-token") assert.equal(fixture.observations.postCount, 0);
    if (["post-failure", "invalid-json", "invalid-shape"].includes(scenario)) assert.equal(fixture.observations.statusCount, scenario === "post-failure" ? 0 : 1);
  } finally {
    await stopServer(fixture.server);
  }
}

const invalidCredentials = await startServer("invalid-credentials");
try {
  await assert.rejects(
    authenticate({ baseUrl: invalidCredentials.baseUrl, username: USERNAME, password: PASSWORD }),
    (error) => error instanceof Error && error.message === "Incorrect username or password."
  );
  assert.equal(invalidCredentials.observations.statusCount, 0);
} finally {
  await stopServer(invalidCredentials.server);
}

let observedAbort = false;
await assert.rejects(
  boundedRequest((_url, options) => new Promise(() => options.signal.addEventListener("abort", () => { observedAbort = true })), "https://defender.example.test/api/status", {}, { timeoutMs: 10 }),
  /Request timed out after 10 ms/
);
assert.equal(observedAbort, true);

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode("1234"));
    controller.enqueue(new TextEncoder().encode("5678"));
    controller.close();
  }
});
await assert.rejects(
  boundedRequest(async () => new Response(stream, { status: 200 }), "https://defender.example.test/api/status", {}, { maxBodyBytes: 5 }),
  /Response body exceeds the 5-byte limit/
);
await assert.rejects(
  boundedRequest(async () => ({ headers: { get: (name) => name === "content-length" ? "99" : null }, text: async () => "small" }), "https://defender.example.test/api/status", {}, { maxBodyBytes: 5 }),
  /Response body exceeds the 5-byte limit/
);

console.log("auth-contract: loopback transport, bounded auth/API requests, cookie deletion, candidate sessions, safe config projection, status validation, and invalid-login behavior verified");
