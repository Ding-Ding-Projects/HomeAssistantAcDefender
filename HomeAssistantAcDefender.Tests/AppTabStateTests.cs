using HomeAssistantAcDefender.Services;

internal sealed class AppTabStateTests
{
    public void SavedTabsAreFilteredAndCurrentPageIsOpened()
    {
        var state = new AppTabState(
            ["/", "/defense", "/settings"],
            ["/settings/", "/not-a-page", "/settings"],
            "/defense?from=rail");

        AssertSequence(state.Tabs, ["/settings", "/", "/defense"]);
        if (!state.Contains("/defense"))
        {
            throw new InvalidOperationException("The current page must remain available as an app tab.");
        }
    }

    public void HrefsNormalizeWithoutChangingTabIdentity()
    {
        var state = new AppTabState(["/", "/energy"], null, "/");
        if (!state.EnsureOpen("/ENERGY#chart?range=today") || !state.Contains("/energy"))
        {
            throw new InvalidOperationException("Tab href normalization should ignore case, fragments, and query strings.");
        }

        if (state.EnsureOpen("/energy"))
        {
            throw new InvalidOperationException("Opening an already-open tab must not duplicate it.");
        }
    }

    private static void AssertSequence(IReadOnlyList<string> actual, IReadOnlyList<string> expected)
    {
        if (!actual.SequenceEqual(expected, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Unexpected app tab order: {string.Join(", ", actual)}.");
        }
    }
}
