namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Browser-originated description of the element that opened the application context menu.
/// Only presentation metadata crosses this boundary; no Home Assistant state or credentials do.
/// </summary>
public sealed class AppContextMenuRequest
{
    public string Kind { get; set; } = "surface";

    public string TargetId { get; set; } = "app-shell";

    public string Label { get; set; } = "AC Defender";

    public string? Href { get; set; }

    public double X { get; set; }

    public double Y { get; set; }

    public string Source { get; set; } = "pointer";
}

/// <summary>One truthful action shown in the local, searchable context menu.</summary>
public sealed record AppContextMenuAction(
    string Id,
    string Label,
    string? Shortcut = null,
    bool Enabled = true,
    string? DisabledReason = null);

/// <summary>
/// Produces context-sensitive menu actions without coupling the menu to defender logic.
/// Keeping this policy pure makes protected tab behaviour independently testable.
/// </summary>
public static class AppContextMenuPolicy
{
    public static IReadOnlyList<AppContextMenuAction> Build(
        AppContextMenuRequest target,
        bool isPinned,
        bool isActive)
    {
        var kind = NormalizeKind(target.Kind);
        var actions = new List<AppContextMenuAction>();

        if (kind == "tab")
        {
            actions.Add(new("activate-tab", "Activate tab", "Enter"));
            actions.Add(new("toggle-pin", isPinned ? "Unpin tab" : "Pin tab", "Alt+P"));
            actions.Add(new("edit-tab-appearance", "Edit tab appearance…", "Shift+Alt+A"));
            actions.Add(new(
                "close-tab",
                "Close tab",
                Enabled: !isPinned && !isActive && !string.Equals(target.Href, "/", StringComparison.Ordinal),
                DisabledReason: isPinned
                    ? "Pinned tabs are protected. Unpin this tab before closing it."
                    : isActive
                        ? "The active tab stays open so the current page and unsaved work remain protected."
                        : string.Equals(target.Href, "/", StringComparison.Ordinal)
                            ? "The command tab stays available as the navigation fallback."
                            : null));
        }
        else if (kind == "group")
        {
            actions.Add(new("focus-group", "Search tabs in this group"));
            actions.Add(new("edit-group-appearance", "Edit group appearance…", "Shift+Alt+A"));
            actions.Add(new("remove-group", "Remove group assignment"));
        }
        else
        {
            actions.Add(new("edit-appearance", "Edit appearance…", "Shift+Alt+A"));
            actions.Add(new("copy-label", "Copy accessible label"));
            if (!string.IsNullOrWhiteSpace(target.Href))
            {
                actions.Add(new("open-new-tab", "Open link in new browser tab"));
            }
        }

        return actions;
    }

    public static IReadOnlyList<AppContextMenuAction> Filter(
        IEnumerable<AppContextMenuAction> actions,
        string? query,
        string? mode,
        string? flags)
        => actions
            .Where(action => RegexSearchMatcher.Matches(
                query,
                mode,
                flags,
                action.Label,
                action.Shortcut,
                action.DisabledReason))
            .ToArray();

    public static string NormalizeKind(string? kind) => kind?.Trim().ToLowerInvariant() switch
    {
        "tab" => "tab",
        "group" => "group",
        "appearance" => "appearance",
        "interactive" => "interactive",
        _ => "surface"
    };
}
