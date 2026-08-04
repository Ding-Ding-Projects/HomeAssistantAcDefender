namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Small, UI-agnostic state holder for the persisted app navigation tabs.
/// The rail remains the complete navigation source; this state only remembers
/// pages the user has opened recently and keeps the active page in the set.
/// </summary>
public sealed class AppTabState
{
    private readonly HashSet<string> _allowed;
    private readonly List<string> _tabs = [];

    public AppTabState(IEnumerable<string> allowedHrefs, IEnumerable<string>? savedHrefs, string currentHref)
    {
        _allowed = new HashSet<string>(
            allowedHrefs.Select(NormalizeHref).Where(static href => href.Length > 0),
            StringComparer.OrdinalIgnoreCase);

        if (_allowed.Count == 0)
        {
            _allowed.Add("/");
        }

        foreach (var href in savedHrefs ?? [])
        {
            AddIfAllowed(href);
        }

        AddIfAllowed("/");
        EnsureOpen(currentHref);
    }

    public IReadOnlyList<string> Tabs => _tabs;

    public bool EnsureOpen(string href) => AddIfAllowed(href);

    public bool Contains(string href) =>
        _tabs.Contains(NormalizeHref(href), StringComparer.OrdinalIgnoreCase);

    public static string NormalizeHref(string? href)
    {
        if (string.IsNullOrWhiteSpace(href))
        {
            return "/";
        }

        var path = href.Trim();
        var queryIndex = path.IndexOfAny(['?', '#']);
        if (queryIndex >= 0)
        {
            path = path[..queryIndex];
        }

        if (!path.StartsWith('/'))
        {
            path = "/" + path;
        }

        path = path.TrimEnd('/');
        return path.Length == 0 ? "/" : path.ToLowerInvariant();
    }

    private bool AddIfAllowed(string href)
    {
        var normalized = NormalizeHref(href);
        if (!_allowed.Contains(normalized) || Contains(normalized))
        {
            return false;
        }

        _tabs.Add(normalized);
        return true;
    }
}
