using HomeAssistantAcDefender.Services;

internal sealed class AppTabSearchServiceTests
{
    private static readonly AppTabSearchService.SearchItem[] Items =
    [
        new("/", "Command", false, null),
        new("/defense", "Defense", true, "Operations"),
        new("/settings", "Standing Orders", false, "Operations"),
        new("/logs", "Field Reports", false, "Audit"),
        new("/wiki", "Site Wiki", false, null)
    ];

    public void FourSearchScopesStayIndependentAndRegexIsBounded()
    {
        var strip = AppTabSearchService.Search(Items, new("def", "plain", "im"));
        AssertNames(strip.Matches, ["Defense"]);

        var group = AppTabSearchService.Search(Items, new("orders", "plain", "im", "Operations"));
        AssertNames(group.Matches, ["Standing Orders"]);

        var master = AppTabSearchService.Search(Items, new("^Field", "regex", ""));
        AssertNames(master.Matches, ["Field Reports"]);

        var groups = AppTabSearchService.SearchGroups(["Operations", "Audit"], new("oper", "plain"), out var groupError);
        if (groupError is not null || !groups.SequenceEqual(["Operations"], StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Group-name search should match group labels independently from tab labels.");
        }

        var invalid = AppTabSearchService.Search(Items, new("[", "regex"));
        if (invalid.IsValid || invalid.Error is null || invalid.Matches.Count != 0)
        {
            throw new InvalidOperationException("Invalid regex must fail closed with an inline error and no matches.");
        }
    }

    public void BulkCloseProtectsPinnedAndActiveAndSupportsInverseMatch()
    {
        var containing = AppTabSearchService.PreviewBulkClose(
            Items,
            new("e", "plain"),
            AppTabSearchService.BulkCloseDirection.Containing,
            "/",
            includePinned: false);

        AssertNames(containing.Matches, ["Standing Orders", "Field Reports", "Site Wiki"]);
        AssertExcluded(containing, "Defense", "Pinned");

        var active = AppTabSearchService.PreviewBulkClose(
            Items,
            new("m", "plain"),
            AppTabSearchService.BulkCloseDirection.Containing,
            "/",
            includePinned: true);
        AssertExcluded(active, "Command", "Active");

        var inverse = AppTabSearchService.PreviewBulkClose(
            Items,
            new("wiki", "plain"),
            AppTabSearchService.BulkCloseDirection.NotContaining,
            "/",
            includePinned: true);

        AssertNames(inverse.Matches, ["Defense", "Standing Orders", "Field Reports"]);
        if (!inverse.CanConfirm)
        {
            throw new InvalidOperationException("Inverse matching should produce a confirmable preview when safe tabs match.");
        }

        var empty = AppTabSearchService.PreviewBulkClose(
            Items,
            new("", "plain"),
            AppTabSearchService.BulkCloseDirection.Containing,
            "/",
            includePinned: true);
        if (!empty.IsValid || !empty.IsEmptyQuery || empty.CanConfirm || empty.Matches.Count != 0)
        {
            throw new InvalidOperationException("Empty bulk-close queries must be explicit no-ops requiring no confirmation.");
        }
    }

    public void ClosingTabsKeepsAValidRouteSet()
    {
        var state = new AppTabState(["/", "/defense", "/settings"], ["/", "/defense", "/settings"], "/");
        if (!state.Close("/settings") || state.Contains("/settings") || !state.Contains("/"))
        {
            throw new InvalidOperationException("Closing a tab should remove only that route and preserve the command tab.");
        }

        var final = new AppTabState(["/"], ["/"], "/");
        if (!final.Close("/") || !final.Contains("/"))
        {
            throw new InvalidOperationException("Closing the final route should restore the safe command tab.");
        }
    }

    private static void AssertNames(IReadOnlyList<AppTabSearchService.SearchItem> actual, IReadOnlyList<string> expected)
    {
        var names = actual.Select(item => item.Label).ToArray();
        if (!names.SequenceEqual(expected, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Unexpected tab matches: {string.Join(", ", names)}.");
        }
    }

    private static void AssertExcluded(AppTabSearchService.BulkClosePreview preview, string label, string reasonPart)
    {
        var item = preview.Excluded.FirstOrDefault(entry => string.Equals(entry.Item.Label, label, StringComparison.OrdinalIgnoreCase));
        if (item is null || !item.Reason.Contains(reasonPart, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Expected {label} to be excluded with a {reasonPart} reason.");
        }
    }
}
