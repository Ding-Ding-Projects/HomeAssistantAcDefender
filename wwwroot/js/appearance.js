(() => {
    "use strict";

    const STORAGE_KEY = "ac-defender-appearance";
    const DEFAULTS = Object.freeze({
        theme: "dark",
        density: "comfortable",
        accent: "#3ddc97",
        accentAlpha: 1,
        fontFamily: "Segoe UI",
        fontScale: 1,
        elementAccents: Object.freeze({})
    });
    const FONT_STACKS = Object.freeze({
        "Segoe UI": "'Segoe UI', 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif",
        "Arial": "Arial, 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif",
        "Cascadia Code": "'Cascadia Code', 'Noto Sans Mono CJK TC', Consolas, monospace",
        "Consolas": "Consolas, 'Noto Sans Mono CJK TC', monospace",
        "system-ui": "system-ui, 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif"
    });
    const subscriptions = new Map();
    let nextSubscriptionId = 1;

    const isHex = value => typeof value === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value);
    const finiteNumber = value => typeof value === "number" && Number.isFinite(value);
    const readProperty = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];
    const TARGETS = Object.freeze(["header", "rail", "main"]);

    function clampAlpha(value) {
        return finiteNumber(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : DEFAULTS.accentAlpha;
    }

    function hexToRgba(hex, alpha = 1) {
        const normalized = isHex(hex) ? hex.slice(1) : DEFAULTS.accent.slice(1);
        const red = parseInt(normalized.slice(0, 2), 16);
        const green = parseInt(normalized.slice(2, 4), 16);
        const blue = parseInt(normalized.slice(4, 6), 16);
        const embeddedAlpha = normalized.length === 8 ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;
        const finalAlpha = Math.round(Math.min(1, Math.max(0, embeddedAlpha * clampAlpha(alpha))) * 1000) / 1000;
        return `rgba(${red}, ${green}, ${blue}, ${finalAlpha})`;
    }

    function normalizeElementAccents(value) {
        const result = {};
        const source = value && typeof value === "object" ? value : {};
        TARGETS.forEach(target => {
            const candidate = source[target] ?? source[target[0].toUpperCase() + target.slice(1)];
            if (isHex(candidate)) result[target] = candidate.toLowerCase();
        });
        return result;
    }

    function normalize(value) {
        const theme = readProperty(value, "theme", "Theme");
        const density = readProperty(value, "density", "Density");
        const accent = readProperty(value, "accent", "Accent");
        const accentAlpha = readProperty(value, "accentAlpha", "AccentAlpha");
        const fontFamily = readProperty(value, "fontFamily", "FontFamily");
        const fontScaleValue = readProperty(value, "fontScale", "FontScale");
        return {
            theme: theme === "light" || theme === "dark" ? theme : DEFAULTS.theme,
            density: ["compact", "comfortable", "spacious"].includes(density) ? density : DEFAULTS.density,
            accent: isHex(accent) ? accent.slice(0, 7).toLowerCase() : DEFAULTS.accent,
            accentAlpha: clampAlpha(accentAlpha),
            fontFamily: Object.prototype.hasOwnProperty.call(FONT_STACKS, fontFamily) ? fontFamily : DEFAULTS.fontFamily,
            fontScale: finiteNumber(Number(fontScaleValue)) ? Math.min(1.35, Math.max(0.85, Number(fontScaleValue))) : DEFAULTS.fontScale,
            elementAccents: normalizeElementAccents(readProperty(value, "elementAccents", "ElementAccents"))
        };
    }

    function roots() {
        return Array.from(document.querySelectorAll(".ops-root"));
    }

    function apply(value) {
        const settings = normalize(value);
        const root = document.documentElement;
        root.dataset.acTheme = settings.theme;
        root.dataset.acDensity = settings.density;
        root.style.setProperty("--ac-ui-font-family", FONT_STACKS[settings.fontFamily]);
        root.style.setProperty("--ac-ui-font-scale", String(settings.fontScale));
        root.style.setProperty("--ac-ui-accent", hexToRgba(settings.accent, settings.accentAlpha));

        const hasCustomAccent = settings.accent !== DEFAULTS.accent || settings.accentAlpha < 1;
        const hasElementAccent = Object.keys(settings.elementAccents).length > 0;

        roots().forEach(element => {
            element.classList.toggle("theme-light", settings.theme === "light");
            element.classList.toggle("theme-dark", settings.theme === "dark");
            element.dataset.acAppearance = hasCustomAccent || hasElementAccent ? "custom" : "default";
            element.dataset.acDensity = settings.density;
            if (!hasCustomAccent) {
                element.style.removeProperty("--accent");
                element.style.removeProperty("--accent-soft");
            } else {
                const accent = hexToRgba(settings.accent, settings.accentAlpha);
                element.style.setProperty("--accent", accent);
                element.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 12%, transparent)`);
            }
        });

        TARGETS.forEach(target => {
            document.querySelectorAll(`.ops-${target}`).forEach(element => {
                const override = settings.elementAccents[target];
                if (override) {
                    const accent = hexToRgba(override, settings.accentAlpha);
                    element.style.setProperty("--accent", accent);
                    element.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 12%, transparent)`);
                } else {
                    element.style.removeProperty("--accent");
                    element.style.removeProperty("--accent-soft");
                }
            });
        });

        window.dispatchEvent(new CustomEvent("ac-defender-appearance-changed", { detail: settings }));
        return settings;
    }

    function read() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            const legacyTheme = window.localStorage.getItem("ac-defender-theme");
            const settings = raw ? JSON.parse(raw) : {
                ...DEFAULTS,
                theme: legacyTheme === "light" || legacyTheme === "dark" ? legacyTheme : DEFAULTS.theme
            };
            return apply(settings);
        } catch {
            return apply(DEFAULTS);
        }
    }

    function save(value) {
        const settings = apply(value);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, ...settings }));
        } catch {
            // The shell still updates for this render even when storage is unavailable.
        }
        return settings;
    }

    function reset() {
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Private browsing can reject storage; applying defaults remains useful.
        }
        return apply(DEFAULTS);
    }

    function subscribe(dotNetReference) {
        const id = nextSubscriptionId++;
        const handler = event => dotNetReference.invokeMethodAsync("OnAppearanceChanged", event.detail).catch(() => undefined);
        subscriptions.set(id, handler);
        window.addEventListener("ac-defender-appearance-changed", handler);
        return id;
    }

    function unsubscribe(id) {
        const handler = subscriptions.get(id);
        if (!handler) return;
        window.removeEventListener("ac-defender-appearance-changed", handler);
        subscriptions.delete(id);
    }

    window.acAppearance = Object.freeze({ read, save, reset, subscribe, unsubscribe, normalize, hexToRgba, defaults: DEFAULTS });
})();
