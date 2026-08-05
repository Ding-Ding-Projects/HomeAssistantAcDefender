using HomeAssistantAcDefender.Services;

internal sealed class AppContextMenuPolicyTests
{
    public void TabActionsProtectPinnedActiveAndFallbackTabs()
    {
        var target = new AppContextMenuRequest
        {
            Kind = "tab",
            TargetId = "/defense",
            Href = "/defense",
            Label = "Defense"
        };

        AssertCloseState(AppContextMenuPolicy.Build(target, isPinned: true, isActive: false), false, "Pinned tabs");
        AssertCloseState(AppContextMenuPolicy.Build(target, isPinned: false, isActive: true), false, "active tab");
        AssertCloseState(AppContextMenuPolicy.Build(target, isPinned: false, isActive: false), true, null);

        target.TargetId = "/";
        target.Href = "/";
        AssertCloseState(AppContextMenuPolicy.Build(target, isPinned: false, isActive: false), false, "command tab");
    }

    public void EveryTargetGetsAppearanceAndLocalBoundedSearch()
    {
        var surface = new AppContextMenuRequest
        {
            Kind = "surface",
            TargetId = "main-content",
            Label = "Defense roster"
        };
        var surfaceActions = AppContextMenuPolicy.Build(surface, false, false);
        if (!surfaceActions.Any(action => action.Id == "edit-appearance" && action.Shortcut == "Shift+Alt+A"))
        {
            throw new InvalidOperationException("Every rendered surface must expose the real appearance-editor shortcut.");
        }

        var filtered = AppContextMenuPolicy.Filter(surfaceActions, "accessible label", "plain", "im");
        if (filtered.Count != 1 || filtered[0].Id != "copy-label")
        {
            throw new InvalidOperationException("Context-menu search must filter only its own visible actions.");
        }

        var regexFiltered = AppContextMenuPolicy.Filter(surfaceActions, "^Edit appearance", "regex", "i");
        if (regexFiltered.Count != 1 || regexFiltered[0].Id != "edit-appearance")
        {
            throw new InvalidOperationException("The menu's anchored regex builder must use the bounded .NET matcher.");
        }

        var adversarialActions = new[] { new AppContextMenuAction("probe", new string('a', 16_000) + "!") };
        _ = AppContextMenuPolicy.Filter(adversarialActions, "^(a+)+$", "regex", "");
    }

    public void BrowserContractCoversRightClickKeyboardAndLongPress()
    {
        var root = FindRepositoryRoot();
        var layout = File.ReadAllText(Path.Combine(root, "Components", "Layout", "MainLayout.razor"));
        var app = File.ReadAllText(Path.Combine(root, "Components", "App.razor"));
        var bridge = File.ReadAllText(Path.Combine(root, "wwwroot", "js", "context-menu.js"));
        var css = File.ReadAllText(Path.Combine(root, "wwwroot", "css", "site.css"));
        var docs = File.ReadAllText(Path.Combine(root, "docs", "wiki", "Context-menus.md"));

        AssertContains(layout, "Blazor context-menu contract",
            "id=\"ac-defender-app-root\"",
            "data-context-kind=\"tab\"",
            "id=\"app-context-menu\"",
            "<RegexSearchBuilder Id=\"app-context-menu-search-builder\"",
            "public async Task ShowContextMenu",
            "public Task DismissContextMenu",
            "Shift+F10",
            "press and hold");
        AssertContains(app, "context-menu script registration", "<script src=\"js/context-menu.js\"></script>");
        AssertContains(bridge, "headless browser interaction bridge",
            "document.addEventListener(\"contextmenu\"",
            "event.key === \"ContextMenu\"",
            "event.key === \"F10\" && event.shiftKey",
            "event.pointerType !== \"touch\"",
            "Math.hypot",
            "}, 620)",
            "suppressClickUntil",
            "state.root = document.getElementById(\"ac-defender-app-root\")");
        AssertContains(css, "opaque bounded context-menu surface",
            ".ops-context-menu {",
            "position: fixed",
            "max-height: min(78vh, 430px)",
            "overflow-y: auto",
            "background: var(--panel)",
            ".ops-app-tab { min-height: 44px",
            ".ops-app-tab__pin { min-width: 44px");
        AssertContains(docs, "context-menu documentation",
            "Right-click",
            "Shift+F10",
            "press and hold",
            "620 ms",
            "Suggested articles");
    }

    private static void AssertCloseState(
        IReadOnlyList<AppContextMenuAction> actions,
        bool enabled,
        string? reasonFragment)
    {
        var close = actions.Single(action => action.Id == "close-tab");
        if (close.Enabled != enabled
            || (reasonFragment is not null && !(close.DisabledReason?.Contains(reasonFragment, StringComparison.OrdinalIgnoreCase) ?? false)))
        {
            throw new InvalidOperationException($"Unexpected protected close state: enabled={close.Enabled}, reason={close.DisabledReason}.");
        }
    }

    private static void AssertContains(string source, string contract, params string[] fragments)
    {
        foreach (var fragment in fragments)
        {
            if (!source.Contains(fragment, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"{contract} is missing required fragment '{fragment}'.");
            }
        }
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "HomeAssistantAcDefender.csproj")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Could not locate the repository root for context-menu regression checks.");
    }
}
