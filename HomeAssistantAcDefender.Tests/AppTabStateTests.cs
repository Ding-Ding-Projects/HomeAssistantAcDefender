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

    public void PinningGroupsAndPersistenceRoundTripWithoutDefenderState()
    {
        var state = new AppTabState(
            ["/", "/defense", "/settings", "/logs"],
            ["/settings", "/logs", "/"],
            "/defense");

        if (!state.SetPinned("/logs", true) || !state.SetGroup("/logs", "Audit"))
        {
            throw new InvalidOperationException("An existing tab should accept pin and group metadata.");
        }

        AssertSequence(state.Tabs, ["/logs", "/settings", "/", "/defense"]);
        if (!state.IsPinned("/logs") || state.GroupFor("/logs") != "Audit")
        {
            throw new InvalidOperationException("Pin and group metadata should be readable from the tab state.");
        }

        var restored = new AppTabState(["/", "/defense", "/settings", "/logs"], null, "/");
        restored.Restore(AppTabState.ParsePersisted(state.Serialize()), "/defense");

        AssertSequence(restored.Tabs, ["/logs", "/settings", "/", "/defense"]);
        if (!restored.IsPinned("/logs") || restored.GroupFor("/logs") != "Audit")
        {
            throw new InvalidOperationException("Pin and group metadata should survive localStorage serialization.");
        }
    }

    public void LegacyStringArrayStorageStillLoads()
    {
        var records = AppTabState.ParsePersisted("[\"/settings\",\"/logs\"]");
        if (!records.Select(record => record.Href).SequenceEqual(["/settings", "/logs"]))
        {
            throw new InvalidOperationException("The pre-metadata tab storage format should remain readable.");
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
