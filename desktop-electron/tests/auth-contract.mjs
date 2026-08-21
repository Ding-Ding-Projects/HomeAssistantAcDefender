import assert from "node:assert/strict";
import http from "node:http";
import { authenticate } from "../electron/auth-client.cjs";

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
      if (scenario === "missing-cookie") {
        response.writeHead(200, { "Content-Type": "text/html" });
      } else {
        response.writeHead(200, {
          "Content-Type": "text/html",
          "Set-Cookie": "GETSESSION=get-cookie; Path=/; HttpOnly"
        });
      }
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
      if (observations.statusCookie !== "GETSESSION=get-cookie; AUTHSESSION=post-cookie; ROTATED=rotated-cookie") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "not authenticated" }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "STATUS=status-cookie; Path=/" });
      response.end(JSON.stringify({ connectionState: "connected", defenderEnabled: true }));
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

const happy = await startServer("happy");
try {
  let session;
  const status = await authenticate({
    baseUrl: happy.baseUrl,
    username: USERNAME,
    password: PASSWORD,
    remember: true,
    onAuthenticated: (value) => { session = value; }
  });
  assert.equal(status.connectionState, "connected");
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
  assert.equal(happy.observations.statusCookie, "GETSESSION=get-cookie; AUTHSESSION=post-cookie; ROTATED=rotated-cookie");
  assert.equal(session.cookie, "GETSESSION=get-cookie; AUTHSESSION=post-cookie; ROTATED=rotated-cookie; STATUS=status-cookie");
  assert.equal(Object.hasOwn(status, "cookie"), false);
  assert.equal(Object.hasOwn(status, "password"), false);
  assert.equal(Object.hasOwn(status, "__RequestVerificationToken"), false);
  assert.equal(Object.hasOwn(session, "password"), false);
  assert.equal(Object.hasOwn(session, "antiforgery"), false);
} finally {
  await stopServer(happy.server);
}

const missingCookie = await startServer("missing-cookie");
try {
  await assert.rejects(
    authenticate({ baseUrl: missingCookie.baseUrl, username: USERNAME, password: PASSWORD }),
    /session cookie/
  );
  assert.equal(missingCookie.observations.postCount, 0);
} finally {
  await stopServer(missingCookie.server);
}

const wrongForm = await startServer("wrong-form");
try {
  await assert.rejects(
    authenticate({ baseUrl: wrongForm.baseUrl, username: USERNAME, password: PASSWORD }),
    /login form/
  );
  assert.equal(wrongForm.observations.postCount, 0);
} finally {
  await stopServer(wrongForm.server);
}

const missingToken = await startServer("missing-token");
try {
  await assert.rejects(
    authenticate({ baseUrl: missingToken.baseUrl, username: USERNAME, password: PASSWORD }),
    /antiforgery token/
  );
  assert.equal(missingToken.observations.postCount, 0);
} finally {
  await stopServer(missingToken.server);
}

const postFailure = await startServer("post-failure");
try {
  await assert.rejects(
    authenticate({ baseUrl: postFailure.baseUrl, username: USERNAME, password: PASSWORD }),
    /Login returned HTTP 401/
  );
  assert.equal(postFailure.observations.statusCount, 0);
} finally {
  await stopServer(postFailure.server);
}

console.log("auth-contract: scoped login form, GET cookie, session merge, authenticated status, and negative cases verified");
