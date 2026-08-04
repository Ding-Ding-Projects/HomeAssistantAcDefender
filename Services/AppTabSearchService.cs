namespace HomeAssistantAcDefender.Services;

using System.Text.RegularExpressions;

/// <summary>
/// A bounded, UI-agnostic search and bulk-close engine for the shell's browser-style tabs.
/// It receives only route presentation metadata; it never reads defender state or page content.
/// </summary>
public static class AppTabSearchService
{
    public const int MaxQueryLength = 512;

    public sealed record SearchItem(string Href, string Label, bool Pinned, string? Group);

    public sealed record SearchOptions(
        string Query,
        string Mode = "plain",
        string Flags = "im",
        string? Group = null);

    public sealed record SearchResult(
        IReadOnlyList<SearchItem> Matches,
        bool IsValid,
        string? Error,
        bool IsEmptyQuery,
        string Mode,
        string Flags);

    public enum BulkCloseDirection
    {
        Containing,
        NotContaining
    }

    public sealed record ExcludedItem(SearchItem Item, string Reason);

    public sealed record BulkClosePreview(
        IReadOnlyList<SearchItem> Matches,
        IReadOnlyList<ExcludedItem> Excluded,
        bool IsValid,
        string? Error,
        bool IsEmptyQuery,
        string Mode,
        string Flags,
        BulkCloseDirection Direction)
    {
        public bool CanConfirm => IsValid && Matches.Count > 0;
    }

    /// <summary>Searches visible tab labels and optional group scope, using the real .NET regex engine.</summary>
    public static SearchResult Search(IEnumerable<SearchItem> items, SearchOptions options)
    {
        var normalized = NormalizeOptions(options);
        if (normalized.Query.Length == 0)
        {
            return new([], true, null, true, normalized.Mode, normalized.Flags);
        }

        if (normalized.Query.Length > MaxQueryLength)
        {
            return new([], false, $"Search is limited to {MaxQueryLength} characters.", false, normalized.Mode, normalized.Flags);
        }

        if (!TryBuildPredicate(normalized, out var predicate, out var error))
        {
            return new([], false, error, false, normalized.Mode, normalized.Flags);
        }

        var matches = items
            .Where(item => MatchesGroup(item, normalized.Group))
            .Where(item => predicate(item.Label))
            .ToArray();

        return new(matches, true, null, false, normalized.Mode, normalized.Flags);
    }

    /// <summary>Searches group labels only; this is intentionally separate from tab-label search.</summary>
    public static IReadOnlyList<string> SearchGroups(IEnumerable<string> groups, SearchOptions options, out string? error)
    {
        var result = Search(
            groups
                .Where(group => !string.IsNullOrWhiteSpace(group))
                .Select(group => new SearchItem($"group:{group}", group.Trim(), false, group.Trim())),
            options with { Group = null });

        error = result.Error;
        return result.Matches.Select(item => item.Label).ToArray();
    }

    /// <summary>
    /// Builds a reviewable close plan. Pinned tabs are protected by default and the active route is
    /// always excluded so a bulk close cannot strand the user outside the current page.
    /// </summary>
    public static BulkClosePreview PreviewBulkClose(
        IEnumerable<SearchItem> items,
        SearchOptions options,
        BulkCloseDirection direction,
        string? activeHref,
        bool includePinned)
    {
        var normalized = NormalizeOptions(options);
        if (normalized.Query.Length == 0)
        {
            return new([], [], true, null, true, normalized.Mode, normalized.Flags, direction);
        }

        if (normalized.Query.Length > MaxQueryLength)
        {
            return new([], [], false, $"Search is limited to {MaxQueryLength} characters.", false, normalized.Mode, normalized.Flags, direction);
        }

        if (!TryBuildPredicate(normalized, out var predicate, out var error))
        {
            return new([], [], false, error, false, normalized.Mode, normalized.Flags, direction);
        }

        var normalizedActive = AppTabState.NormalizeHref(activeHref);
        var candidateItems = items.ToArray();
        var matches = new List<SearchItem>();
        var excluded = new List<ExcludedItem>();
        foreach (var item in candidateItems)
        {
            if (!MatchesGroup(item, normalized.Group))
            {
                continue;
            }

            var contains = predicate(item.Label);
            var selected = direction == BulkCloseDirection.Containing ? contains : !contains;
            if (!selected)
            {
                continue;
            }

            if (string.Equals(AppTabState.NormalizeHref(item.Href), normalizedActive, StringComparison.OrdinalIgnoreCase))
            {
                excluded.Add(new(item, "Active tab is retained so the current page stays open."));
            }
            else if (string.Equals(AppTabState.NormalizeHref(item.Href), "/", StringComparison.Ordinal) && candidateItems.Length > 1)
            {
                excluded.Add(new(item, "Command tab is retained as the safe navigation home."));
            }
            else if (item.Pinned && !includePinned)
            {
                excluded.Add(new(item, "Pinned tab is protected unless Include pinned is selected."));
            }
            else
            {
                matches.Add(item);
            }
        }

        return new(matches, excluded, true, null, false, normalized.Mode, normalized.Flags, direction);
    }

    private static SearchOptions NormalizeOptions(SearchOptions options)
    {
        var mode = string.Equals(options.Mode, "regex", StringComparison.OrdinalIgnoreCase) ? "regex" : "plain";
        var flags = new string((options.Flags ?? "").Where(character => character is 'i' or 'm' or 's').Distinct().ToArray());
        return new((options.Query ?? "").Trim(), mode, flags, string.IsNullOrWhiteSpace(options.Group) ? null : options.Group.Trim());
    }

    private static bool MatchesGroup(SearchItem item, string? group) =>
        group is null || string.Equals(item.Group, group, StringComparison.OrdinalIgnoreCase);

    private static bool TryBuildPredicate(SearchOptions options, out Func<string, bool> predicate, out string? error)
    {
        if (!string.Equals(options.Mode, "regex", StringComparison.OrdinalIgnoreCase))
        {
            predicate = value => value.Contains(options.Query, StringComparison.OrdinalIgnoreCase);
            error = null;
            return true;
        }

        try
        {
            var regexOptions = RegexOptions.CultureInvariant;
            if (options.Flags.Contains('i')) regexOptions |= RegexOptions.IgnoreCase;
            if (options.Flags.Contains('m')) regexOptions |= RegexOptions.Multiline;
            if (options.Flags.Contains('s')) regexOptions |= RegexOptions.Singleline;
            var regex = new Regex(options.Query, regexOptions, TimeSpan.FromMilliseconds(100));
            predicate = value =>
            {
                try
                {
                    return regex.IsMatch(value);
                }
                catch (RegexMatchTimeoutException)
                {
                    return false;
                }
            };
            error = null;
            return true;
        }
        catch (ArgumentException ex)
        {
            predicate = static _ => false;
            error = $"Invalid regex: {ex.Message}";
            return false;
        }
    }
}
