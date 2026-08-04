import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";

const files = ["package.json", "electron/main.cjs", "electron/preload.cjs", "src/App.tsx", "src/App.css", "public/shield.svg"];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));
const main = await readFile(new URL("../electron/main.cjs", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const required = ["/api/status", "/api/target", "/api/defender", "/api/thermostat/off", "AntiforgeryToken", "autoUpdater", "update-downloaded", "quitAndInstall"];
for (const marker of required) if (!main.includes(marker)) throw new Error(`Missing API/auth marker: ${marker}`);
for (const marker of ["Ctrl+Shift+F", "bilingual", "funnyEnglish", "funnyCantonese", "SEARCH / REGEX BUILDER", "Guided regex blocks", "Raw pattern", "Sample text", "captures:", "Copy /pattern/flags", "Use in search", "Notification search regex builder", "Command palette regex builder", "settings-base-url", "settings-funny-en", "settings-update-feed", "focus the exact control"]) if (!app.includes(marker)) throw new Error(`Missing controller feature: ${marker}`);
for (const marker of ["Restart to install update", "updateFeedUrl", "SIGNED UPDATE FEED"]) if (!app.includes(marker)) throw new Error(`Missing update/settings feature: ${marker}`);
if (packageJson.build?.win?.target?.[0]?.target !== "squirrel") throw new Error("Windows Squirrel packaging is required.");
if (main.includes("fake") || app.includes("fake HVAC")) throw new Error("Controller must not add fake HVAC state.");
console.log("static-check: controller files, auth token path, API routes, language/tone controls, regex builder, and Squirrel target are present");
