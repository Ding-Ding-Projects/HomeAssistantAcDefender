namespace HomeAssistantAcDefender.Services;

using System.Text.Json;

/// <summary>
/// Persisted presentation metadata for one browser-style app tab.  This never
/// carries defender state; it only remembers the user's navigation layout.
/// </summary>
public sealed record AppTabRecord(string Href, bool Pinned = false, string? Group = null);

/// <summary>
/// Small, UI-agnostic state holder for the persisted app navigation tabs.
/// The rail remains the complete navigation source; this state only remembers
/// pages the user has opened recently and keeps the active page in the set.
/// </summary>
public sealed class AppTabState
{
    private readonly HashSet<string> _allowed;
    private readonly List<string> _tabs = [];
    private readonly Dictionary<string, AppTabRecord> _metadata = new(StringComparer.OrdinalIgnoreCase);

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

    /// <summary>Tab order plus pin/group metadata for browser persistence.</summary>
    public IReadOnlyList<AppTabRecord> Records =>
        _tabs.Select(href => _metadata[href]).ToArray();

    public bool EnsureOpen(string href) => AddIfAllowed(href);

    public bool Contains(string href) =>
        _tabs.Contains(NormalizeHref(href), StringComparer.OrdinalIgnoreCase);

    public bool IsPinned(string href) =>
        _metadata.TryGetValue(NormalizeHref(href), out var record) && record.Pinned;

    public string? GroupFor(string href) =>
        _metadata.TryGetValue(NormalizeHref(href), out var record) ? record.Group : null;

    public IReadOnlyList<string> Groups =>
        _tabs.Select(href => _metadata[href].Group)
            .Where(group => !string.IsNullOrWhiteSpace(group))
            .Select(group => group!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    /// <summary>
    /// Replaces navigation metadata from localStorage. Invalid or disallowed
    /// records are ignored, while the root tab and current page are restored.
    /// </summary>
    public void Restore(IEnumerable<AppTabRecord>? savedRecords, string? currentHref = null)
    {
        _tabs.Clear();
        _metadata.Clear();

        foreach (var record in savedRecords ?? [])
        {
            var href = NormalizeHref(record.Href);
            if (!_allowed.Contains(href) || Contains(href))
            {
                continue;
            }

            _tabs.Add(href);
            _metadata[href] = new AppTabRecord(
                href,
                record.Pinned,
                NormalizeGroup(record.Group));
        }

        AddIfAllowed("/");
        EnsureOpen(currentHref ?? "/");
        NormalizePinnedOrder();
    }

    /// <summary>Pin or unpin a tab while retaining a stable protected region.</summary>
    public bool SetPinned(string href, bool pinned)
    {
        var normalized = NormalizeHref(href);
        if (!_metadata.TryGetValue(normalized, out var record) || record.Pinned == pinned)
        {
            return false;
        }

        _metadata[normalized] = record with { Pinned = pinned };
        NormalizePinnedOrder();
        return true;
    }

    /// <summary>Assigns a tab to a named group; blank clears its group.</summary>
    public bool SetGroup(string href, string? group)
    {
        var normalized = NormalizeHref(href);
        if (!_metadata.TryGetValue(normalized, out var record))
        {
            return false;
        }

        var normalizedGroup = NormalizeGroup(group);
        if (string.Equals(record.Group, normalizedGroup, StringComparison.Ordinal))
        {
            return false;
        }

        _metadata[normalized] = record with { Group = normalizedGroup };
        return true;
    }

    /// <summary>Serialize a compact, forward-compatible localStorage payload.</summary>
    public string Serialize() => JsonSerializer.Serialize(Records);

    /// <summary>
    /// Reads the current record format and the original string-array format.
    /// Browser storage is user-controlled, so malformed values fail closed.
    /// </summary>
    public static IReadOnlyList<AppTabRecord> ParsePersisted(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(raw);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            if (document.RootElement.EnumerateArray().FirstOrDefault().ValueKind == JsonValueKind.String)
            {
                return JsonSerializer.Deserialize<List<string>>(raw)?
                    .Select(href => new AppTabRecord(href))
                    .ToArray() ?? [];
            }

            return JsonSerializer.Deserialize<List<AppTabRecord>>(raw) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

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
        _metadata[normalized] = new AppTabRecord(normalized);
        return true;
    }

    private static string? NormalizeGroup(string? group)
    {
        var normalized = group?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? null : normalized[..Math.Min(normalized.Length, 48)];
    }

    private void NormalizePinnedOrder()
    {
        var pinned = _tabs.Where(href => _metadata[href].Pinned).ToArray();
        var unpinned = _tabs.Where(href => !_metadata[href].Pinned).ToArray();
        _tabs.Clear();
        _tabs.AddRange(pinned);
        _tabs.AddRange(unpinned);
    }
}
