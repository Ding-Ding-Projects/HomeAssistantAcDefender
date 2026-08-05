(function () {
    "use strict";

    const state = {
        dotNet: null,
        root: null,
        longPressTimer: 0,
        longPressTarget: null,
        longPressOrigin: null,
        suppressClickTarget: null,
        suppressClickUntil: 0,
        attached: false
    };

    const explicitSelector = "[data-context-kind]";
    const semanticSelector = [
        "button", "a", "input", "select", "textarea", "summary", "label",
        "[role]", "section", "article", "header", "nav", "main", "aside", "footer", "fieldset"
    ].join(",");

    function clean(value, fallback) {
        const normalized = String(value || "").replace(/\s+/g, " ").trim();
        return (normalized || fallback).slice(0, 160);
    }

    function targetKey(element, kind) {
        const explicit = element.dataset.contextId || element.id;
        if (explicit) return clean(explicit, `${kind}-target`);

        const route = window.location.pathname || "/";
        const tag = element.tagName.toLowerCase();
        const classes = Array.from(element.classList || []).slice(0, 3).join(".");
        const parent = element.parentElement;
        const ordinal = parent ? Array.prototype.indexOf.call(parent.children, element) + 1 : 1;
        return clean(`${route}:${tag}${classes ? "." + classes : ""}:${ordinal}`, `${kind}-target`);
    }

    function labelFor(element) {
        const labelledBy = element.getAttribute("aria-labelledby");
        const referenced = labelledBy
            ? labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ")
            : "";
        return clean(
            element.dataset.contextLabel
            || element.getAttribute("aria-label")
            || referenced
            || element.getAttribute("title")
            || element.getAttribute("placeholder")
            || element.innerText
            || element.textContent
            || element.tagName.toLowerCase(),
            "Unnamed interface element");
    }

    function resolveElement(start) {
        if (!(start instanceof Element) || !state.root) return null;
        if (start.closest("#app-context-menu")) return null;
        if (!state.root.contains(start)) return null;

        let candidate = start;
        while (candidate && state.root.contains(candidate)) {
            if (candidate.matches(explicitSelector) || candidate.matches(semanticSelector)) return candidate;
            if (candidate === state.root) break;
            candidate = candidate.parentElement;
        }

        return state.root;
    }

    function describe(element, clientX, clientY, source) {
        const explicitKind = element.dataset.contextKind;
        const kind = clean(explicitKind || (element.matches("button,a,input,select,textarea,summary,label,[role]") ? "interactive" : "surface"), "surface").toLowerCase();
        const anchor = element.matches("a[href]") ? element : element.closest("a[href]");
        const menuWidth = Math.min(328, Math.max(240, window.innerWidth - 16));
        const menuHeight = Math.min(430, Math.max(240, window.innerHeight - 16));
        const x = Math.max(8, Math.min(Number(clientX) || 8, window.innerWidth - menuWidth - 8));
        const y = Math.max(8, Math.min(Number(clientY) || 8, window.innerHeight - menuHeight - 8));
        return {
            kind,
            targetId: targetKey(element, kind),
            label: labelFor(element),
            href: element.dataset.contextHref || anchor?.getAttribute("href") || null,
            x,
            y,
            source: clean(source, "pointer")
        };
    }

    function showFor(element, clientX, clientY, source) {
        if (!state.dotNet || !element) return;
        state.dotNet.invokeMethodAsync("ShowContextMenu", describe(element, clientX, clientY, source));
    }

    function onContextMenu(event) {
        const element = resolveElement(event.target);
        if (!element) return;
        event.preventDefault();
        const fromPendingLongPress = state.longPressTarget && element.closest("[data-app-tab]");
        if (fromPendingLongPress) {
            state.suppressClickTarget = state.longPressTarget;
            state.suppressClickUntil = Date.now() + 900;
            cancelLongPress();
        }
        showFor(element, event.clientX, event.clientY, fromPendingLongPress ? "long-press" : "pointer");
    }

    function cancelLongPress() {
        if (state.longPressTimer) window.clearTimeout(state.longPressTimer);
        state.longPressTimer = 0;
        state.longPressTarget = null;
        state.longPressOrigin = null;
    }

    function onPointerDown(event) {
        if (event.button !== 0 || (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
        const tab = event.target instanceof Element ? event.target.closest("[data-app-tab]") : null;
        if (!tab || !state.root?.contains(tab)) return;

        cancelLongPress();
        state.longPressTarget = tab;
        state.longPressOrigin = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        state.longPressTimer = window.setTimeout(() => {
            const target = state.longPressTarget;
            if (!target) return;
            state.suppressClickTarget = target;
            state.suppressClickUntil = Date.now() + 900;
            showFor(target, event.clientX, event.clientY, "long-press");
            if (navigator.vibrate) navigator.vibrate(18);
            cancelLongPress();
        }, 620);
    }

    function onPointerMove(event) {
        const origin = state.longPressOrigin;
        if (!origin || origin.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) cancelLongPress();
    }

    function onPointerEnd() {
        cancelLongPress();
    }

    function onClick(event) {
        if (Date.now() > state.suppressClickUntil || !state.suppressClickTarget) return;
        if (event.target instanceof Node && state.suppressClickTarget.contains(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        state.suppressClickTarget = null;
        state.suppressClickUntil = 0;
    }

    function keyboardPoint(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.max(8, Math.min(rect.left + 18, window.innerWidth - 24)),
            y: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 24))
        };
    }

    function onKeyDown(event) {
        if (event.key === "Escape") {
            state.dotNet?.invokeMethodAsync("DismissContextMenu");
            return;
        }

        const element = resolveElement(event.target instanceof Element ? event.target : document.activeElement);
        if (!element) return;

        if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
            event.preventDefault();
            const point = keyboardPoint(element);
            showFor(element, point.x, point.y, "keyboard");
            return;
        }

        if (event.key.toLowerCase() === "a" && event.shiftKey && event.altKey) {
            event.preventDefault();
            state.dotNet?.invokeMethodAsync("RunContextMenuShortcut", describe(element, 8, 8, "keyboard"));
        }
    }

    function onOutsidePointer(event) {
        if (!document.getElementById("app-context-menu")) return;
        if (!(event.target instanceof Element) || event.target.closest("#app-context-menu")) return;
        state.dotNet?.invokeMethodAsync("DismissContextMenu");
    }

    function addListeners() {
        document.addEventListener("contextmenu", onContextMenu, true);
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("pointermove", onPointerMove, true);
        document.addEventListener("pointerup", onPointerEnd, true);
        document.addEventListener("pointercancel", onPointerEnd, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("pointerdown", onOutsidePointer, false);
    }

    function removeListeners() {
        document.removeEventListener("contextmenu", onContextMenu, true);
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerup", onPointerEnd, true);
        document.removeEventListener("pointercancel", onPointerEnd, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("pointerdown", onOutsidePointer, false);
    }

    window.acContextMenus = {
        attach(dotNetReference) {
            this.detach();
            state.dotNet = dotNetReference;
            state.root = document.getElementById("ac-defender-app-root");
            if (!state.root) return false;
            addListeners();
            state.attached = true;
            return true;
        },

        detach() {
            cancelLongPress();
            if (state.attached) removeListeners();
            state.dotNet = null;
            state.root = null;
            state.attached = false;
        },

        focusSearch() {
            window.setTimeout(() => document.getElementById("app-context-menu-search")?.focus(), 0);
        },

        copyText(value) {
            return navigator.clipboard.writeText(String(value || ""));
        },

        openLink(href) {
            const url = new URL(String(href || ""), window.location.href);
            if (url.origin !== window.location.origin) return false;
            window.open(url.href, "_blank", "noopener,noreferrer");
            return true;
        },

        rememberAppearanceTarget(target) {
            localStorage.setItem("ac-defender-context-appearance-target", JSON.stringify(target));
        },

        openTabTools() {
            const tools = document.querySelector("details.ops-app-tab-tools");
            if (!tools) return false;
            tools.open = true;
            tools.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            return true;
        }
    };
})();
