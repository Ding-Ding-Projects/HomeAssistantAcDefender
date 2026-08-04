using System.Globalization;
using System.Text;
using System.Text.Json;
using HomeAssistantAcDefender.Models;
using HomeAssistantAcDefender.Services;

internal sealed class SettingsRepositoryHistoryFilterTests
{
    public void ActionCountsDatesPresetsAndRegexCompose()
    {
        var root = new SettingsRepositoryCommit(
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "aaaaaaaa",
            "2026-08-01T00:00:00+00:00",
            "Initial settings snapshot",
            "");
        var update = new SettingsRepositoryCommit(
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "bbbbbbbb",
            "2026-08-04T12:00:00+00:00",
            "Manual settings repository snapshot",
            root.Hash);
        var restore = new SettingsRepositoryCommit(
            "cccccccccccccccccccccccccccccccccccccccc",
            "cccccccc",
            "2026-08-05T12:00:00+00:00",
            "Restore AC Defender settings from aaaaaaaa",
            update.Hash);
        var undo = new SettingsRepositoryCommit(
            "dddddddddddddddddddddddddddddddddddddddd",
            "dddddddd",
            "2026-08-06T12:00:00+00:00",
            "Revert \"Manual settings repository snapshot\"",
            restore.Hash);
        var commits = new[] { undo, restore, update, root };

        var counts = SettingsRepositoryHistoryFilters.ActionCounts(commits, "2026-08-04", "2026-08-05");
        Assert(counts[SettingsRepositoryHistoryFilters.Updated] == 1
            && counts[SettingsRepositoryHistoryFilters.Restored] == 1,
            "Date-bounded action counts should derive updated and restored commits from Git history.");
        Assert(!counts.ContainsKey(SettingsRepositoryHistoryFilters.Created)
            && !counts.ContainsKey(SettingsRepositoryHistoryFilters.Undone),
            "Date-bounded action counts should exclude commits outside the inclusive range.");

        var restored = SettingsRepositoryHistoryFilters.Filter(
            commits,
            "restored",
            "regex",
            "i",
            [SettingsRepositoryHistoryFilters.Restored],
            "2026-08-04",
            "2026-08-05");
        Assert(restored.Count == 1 && restored[0].Hash == restore.Hash,
            "Action, date, and regex filters should compose against the same commit set.");

        var boundary = SettingsRepositoryHistoryFilters.Filter(commits, "", "plain", "im", [], "2026-08-05", "2026-08-05");
        Assert(boundary.Count == 1 && boundary[0].Hash == restore.Hash,
            "The typed end date should be inclusive through the end of its UTC day.");

        var localDate = new DateOnly(2026, 8, 4).ToString("d", CultureInfo.CurrentCulture);
        Assert(SettingsRepositoryHistoryFilters.TryParseDate(localDate, out var parsed) && parsed == new DateOnly(2026, 8, 4),
            "Typed history dates should accept the current culture's complete short date format.");
        Assert(SettingsRepositoryHistoryFilters.DateRangeError("2026-08-05", "2026-08-04") is not null,
            "A reversed date range should be rejected instead of silently swapping bounds.");
        Assert(SettingsRepositoryHistoryFilters.Filter(commits, "", "plain", "im", [], "2026-08-05", "2026-08-04").Count == 0,
            "An invalid date range should produce an honest empty result.");

        var preset = SettingsRepositoryHistoryFilters.ResolvePreset("7d", new DateOnly(2026, 8, 4));
        Assert(preset.From == "2026-07-29" && preset.To == "2026-08-04",
            "The 7-day preset should include today and the six preceding UTC dates.");
    }

    public void ExportsAndPageContractPreserveFilteredHistory()
    {
        var commit = new SettingsRepositoryCommit(
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            "eeeeeeee",
            "2026-08-04T12:00:00+00:00",
            "更新 settings | keep this line\nand this one",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        var filters = new SettingsRepositoryHistoryExportFilters(
            "更新",
            "plain",
            "im",
            "2026-08-04",
            "2026-08-04",
            [SettingsRepositoryHistoryFilters.Updated]);
        var exportedAt = DateTimeOffset.Parse("2026-08-04T13:00:00Z");
        var service = new SettingsRepositoryHistoryExportService();

        var json = Encoding.UTF8.GetString(service.ToJson([commit], filters, exportedAt));
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert(root.GetProperty("schema").GetString() == SettingsRepositoryHistoryExportService.Schema,
            "Settings history JSON should declare its versioned schema.");
        Assert(root.GetProperty("count").GetInt32() == 1
            && root.GetProperty("filters").GetProperty("fromDate").GetString() == "2026-08-04"
            && root.GetProperty("filters").GetProperty("actions")[0].GetString() == "updated",
            "Settings history JSON should preserve count and every active filter.");
        Assert(root.GetProperty("commits")[0].GetProperty("message").GetString() == commit.Message,
            "Settings history JSON should preserve complete Unicode messages and line breaks.");

        var markdown = Encoding.UTF8.GetString(service.ToMarkdown([commit], filters, exportedAt));
        Assert(markdown.Contains("Schema: `" + SettingsRepositoryHistoryExportService.Schema + "`", StringComparison.Ordinal)
            && markdown.Contains("更新 settings \\| keep this line<br>and this one", StringComparison.Ordinal),
            "Settings history Markdown should identify its schema and safely escape Unicode table content.");

        var empty = Encoding.UTF8.GetString(service.ToMarkdown([], filters, exportedAt));
        Assert(empty.Contains("No settings commits matched the current filters.", StringComparison.Ordinal),
            "An empty settings-history export should state that no commits matched.");

        var rootPath = FindRepositoryRoot();
        var page = File.ReadAllText(Path.Combine(rootPath, "Components", "Pages", "SettingsRepository.razor"));
        var docs = File.ReadAllText(Path.Combine(rootPath, "docs", "wiki", "Settings-history-filters.md"));
        Assert(page.Contains("Filter by history action", StringComparison.Ordinal)
            && page.Contains("Last 90 days", StringComparison.Ordinal)
            && page.Contains("EXPORT JSON", StringComparison.Ordinal)
            && page.Contains("EXPORT MARKDOWN", StringComparison.Ordinal)
            && page.Contains("SettingsRepositoryHistoryFilters.Filter", StringComparison.Ordinal),
            "Settings repository page should expose derived action filters, date presets, and filtered exports.");
        Assert(docs.Contains("Failure modes and security", StringComparison.Ordinal)
            && docs.Contains("Suggested articles", StringComparison.Ordinal),
            "Settings history documentation should record security and suggested next steps.");
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "HomeAssistantAcDefender.csproj")))
        {
            current = current.Parent;
        }

        return current?.FullName
            ?? throw new InvalidOperationException("Could not locate the repository root for settings history checks.");
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
