// Blazor's <AntiforgeryToken /> emits a hidden __RequestVerificationToken input.
// Keep the name lookup tolerant of framework casing while never crossing form boundaries.
const ANTIFORGERY_NAME = /(?:requestverificationtoken|antiforgery)/i;

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("Enter a valid http:// or https:// defender address."); }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP and HTTPS defender addresses are supported.");
  if (parsed.username || parsed.password) throw new Error("Do not put credentials in the defender address.");
  return parsed.toString().replace(/\/+$/, "");
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
  const candidates = [];
  for (const match of html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi)) {
    const formHtml = match[0];
    const hidden = hiddenInputs(formHtml);
    if (hidden.get("_handler") === "login" && hidden.get("action") === "login") {
      candidates.push({ formHtml, hidden });
    }
  }
  if (candidates.length !== 1) throw new Error("The defender login form was missing or ambiguous.");
  const selected = candidates[0];
  const antiforgeryName = [...selected.hidden.keys()].find((name) => ANTIFORGERY_NAME.test(name));
  if (!antiforgeryName || selected.hidden.get(antiforgeryName) === "") {
    throw new Error("The defender login form did not provide an antiforgery token.");
  }
  return {
    hidden: {
      _handler: selected.hidden.get("_handler"),
      action: selected.hidden.get("action"),
      [antiforgeryName]: selected.hidden.get(antiforgeryName)
    }
  };
}

function responseCookies(response) {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  const joined = response.headers.get("set-cookie");
  return joined ? joined.split(/,(?=[^;,]+=)/g) : [];
}

function mergeCookies(existing, response) {
  const jar = new Map(String(existing || "").split("; ").filter(Boolean).map((item) => {
    const index = item.indexOf("=");
    return index > 0 ? [item.slice(0, index), item.slice(index + 1)] : [item, ""];
  }));
  for (const value of responseCookies(response)) {
    const pair = String(value).split(";", 1)[0];
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function isSuccessfulRedirectOrResponse(response) {
  return Boolean(response) && response.status >= 200 && response.status < 400;
}

async function authenticate({ baseUrl, username, password, remember, fetchImpl = globalThis.fetch, onAuthenticated }) {
  if (typeof fetchImpl !== "function") throw new Error("This runtime cannot connect to the defender.");
  const normalized = normalizeBaseUrl(baseUrl);
  const cleanUsername = String(username || "").trim();
  if (!cleanUsername || !password) throw new Error("Username and password are required.");

  let loginPage;
  try {
    loginPage = await fetchImpl(`${normalized}/login`, { redirect: "manual", headers: { Accept: "text/html" } });
  } catch (error) {
    throw new Error(`Could not reach defender: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!loginPage || !isSuccessfulRedirectOrResponse(loginPage) || loginPage.status >= 400) {
    throw new Error(`Login page returned HTTP ${loginPage?.status ?? "unknown"}.`);
  }
  const loginHtml = await loginPage.text();
  const selected = selectLoginForm(loginHtml);
  let cookie = mergeCookies("", loginPage);
  if (!cookie) throw new Error("The defender login page did not provide a session cookie.");

  const fields = new URLSearchParams(selected.hidden);
  fields.set("username", cleanUsername);
  fields.set("password", password);
  if (remember) fields.set("keepSignedIn", "true");
  let loginResponse;
  try {
    loginResponse = await fetchImpl(`${normalized}/login`, {
      method: "POST",
      body: fields,
      redirect: "manual",
      headers: {
        Accept: "text/html",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie
      }
    });
  } catch (error) {
    throw new Error(`Could not submit defender login: ${error instanceof Error ? error.message : String(error)}`);
  }
  cookie = mergeCookies(cookie, loginResponse);
  if (!isSuccessfulRedirectOrResponse(loginResponse)) {
    throw new Error(`Login returned HTTP ${loginResponse?.status ?? "unknown"}.`);
  }
  if (!cookie) throw new Error("The defender login did not establish a session cookie.");

  let statusResponse;
  try {
    statusResponse = await fetchImpl(`${normalized}/api/status`, {
      headers: { Accept: "application/json", Cookie: cookie },
      redirect: "manual"
    });
  } catch (error) {
    throw new Error(`Sign-in failed or API is unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!statusResponse || !statusResponse.ok) {
    throw new Error(`Sign-in failed or API returned HTTP ${statusResponse?.status ?? "unknown"}.`);
  }
  cookie = mergeCookies(cookie, statusResponse);
  let status;
  try {
    status = await statusResponse.json();
  } catch {
    throw new Error("Sign-in succeeded but the status response was not valid JSON.");
  }
  if (typeof onAuthenticated === "function") onAuthenticated({ baseUrl: normalized, username: cleanUsername, cookie });
  return status;
}

module.exports = { authenticate, mergeCookies, normalizeBaseUrl, selectLoginForm };
