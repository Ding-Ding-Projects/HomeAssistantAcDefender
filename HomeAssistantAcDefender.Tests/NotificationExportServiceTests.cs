using System.Text;
using System.Text.Json;
using HomeAssistantAcDefender.Models;
using HomeAssistantAcDefender.Services;

internal sealed class NotificationExportServiceTests
{
    public void JsonAndMarkdownExportsPreserveFiltersAndUtf8()
    {
        var records = new NotificationRecord[]
        {
            new(
                Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                DateTimeOffset.Parse("2026-08-04T12:00:00Z"),
                "warning",
                "警告 | wall touched\nreview it",
                Read: false,
                Dismissed: true,
                ReadAt: null,
                DismissedAt: DateTimeOffset.Parse("2026-08-04T12:01:00Z")),
            new(
                Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
                DateTimeOffset.Parse("2026-08-04T12:02:00Z"),
                "info",
                "A quiet hold remains active.",
                Read: true,
                Dismissed: false,
                ReadAt: DateTimeOffset.Parse("2026-08-04T12:03:00Z"),
                DismissedAt: null),
        };
        var filters = new NotificationExportFilters("警告", "regex", "im", "warning", IncludeDismissed: true);
        var exportedAt = DateTimeOffset.Parse("2026-08-04T12:04:00Z");
        var service = new NotificationExportService();

        var json = Encoding.UTF8.GetString(service.ToJson(records, filters, exportedAt));
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert(root.GetProperty("schema").GetString() == NotificationExportService.Schema,
            "JSON export should carry the versioned notification-history schema.");
        Assert(root.GetProperty("exportedAt").GetDateTimeOffset() == exportedAt,
            "JSON export should carry the supplied UTC export timestamp.");
        Assert(root.GetProperty("count").GetInt32() == records.Length,
            "JSON export count should equal the filtered records supplied by the page.");
        Assert(root.GetProperty("filters").GetProperty("search").GetString() == "警告",
            "JSON export should preserve Unicode search metadata.");
        Assert(root.GetProperty("filters").GetProperty("searchMode").GetString() == "regex"
            && root.GetProperty("filters").GetProperty("searchFlags").GetString() == "im"
            && root.GetProperty("filters").GetProperty("level").GetString() == "warning"
            && root.GetProperty("filters").GetProperty("includeDismissed").GetBoolean(),
            "JSON export should preserve every active filter.");
        Assert(root.GetProperty("notifications")[0].GetProperty("message").GetString() == records[0].Message,
            "JSON export should preserve the complete Unicode notification message.");

        var markdown = Encoding.UTF8.GetString(service.ToMarkdown(records, filters, exportedAt));
        Assert(markdown.Contains("Schema: `" + NotificationExportService.Schema + "`", StringComparison.Ordinal),
            "Markdown export should identify its schema.");
        Assert(markdown.Contains("Search mode: `regex`", StringComparison.Ordinal)
            && markdown.Contains("Search flags: `im`", StringComparison.Ordinal)
            && markdown.Contains("Include dismissed: `true`", StringComparison.Ordinal),
            "Markdown export should preserve filter metadata.");
        Assert(markdown.Contains("警告 \\| wall touched<br>review it", StringComparison.Ordinal),
            "Markdown export should keep Unicode and escape table delimiters/newlines.");
    }

    public void EmptyExportIsExplicitAndUiUsesLocalBridge()
    {
        var service = new NotificationExportService();
        var filters = new NotificationExportFilters("", "plain", "im", "", IncludeDismissed: false);
        var markdown = Encoding.UTF8.GetString(service.ToMarkdown([], filters,
            DateTimeOffset.Parse("2026-08-04T12:04:00Z")));
        Assert(markdown.Contains("No notifications matched the current filters.", StringComparison.Ordinal),
            "An empty export should state that no notifications matched instead of looking corrupted.");

        var root = FindRepositoryRoot();
        var page = File.ReadAllText(Path.Combine(root, "Components", "Pages", "Notifications.razor"));
        var app = File.ReadAllText(Path.Combine(root, "Components", "App.razor"));
        var bridge = File.ReadAllText(Path.Combine(root, "wwwroot", "js", "notification-export.js"));
        var serviceSource = File.ReadAllText(Path.Combine(root, "Services", "NotificationExportService.cs"));
        Assert(page.Contains("Export JSON", StringComparison.Ordinal)
            && page.Contains("Export Markdown", StringComparison.Ordinal)
            && page.Contains("FilteredNotifications", StringComparison.Ordinal),
            "Notification page should expose both exports and build them from its filtered view.");
        Assert(app.Contains("js/notification-export.js", StringComparison.Ordinal),
            "The app shell should load the local notification export bridge.");
        Assert(bridge.Contains("downloadBase64", StringComparison.Ordinal)
            && bridge.Contains("URL.createObjectURL", StringComparison.Ordinal)
            && bridge.Contains("URL.revokeObjectURL", StringComparison.Ordinal),
            "Export bridge should download locally and release its object URL.");
        Assert(serviceSource.Contains("SerializeToUtf8Bytes", StringComparison.Ordinal)
            && serviceSource.Contains("Encoding.UTF8", StringComparison.Ordinal)
            && serviceSource.Contains(NotificationExportService.Schema, StringComparison.Ordinal),
            "Export service should declare UTF-8 JSON/Markdown output and a versioned schema.");
    }

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null && !File.Exists(Path.Combine(current.FullName, "HomeAssistantAcDefender.csproj")))
        {
            current = current.Parent;
        }

        return current?.FullName
            ?? throw new InvalidOperationException("Could not locate the repository root for notification export checks.");
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
