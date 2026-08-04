using System.Text;
using System.Text.Json;
using HomeAssistantAcDefender.Models;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Builds local, portable exports for the notification centre. The service never reads beyond the
/// already-filtered records supplied by the page and never sends the export to a network endpoint.
/// </summary>
public sealed class NotificationExportService
{
    public const string Schema = "ac-defender.notification-history.v1";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

    public byte[] ToJson(
        IReadOnlyList<NotificationRecord> records,
        NotificationExportFilters filters,
        DateTimeOffset? exportedAt = null)
    {
        ArgumentNullException.ThrowIfNull(records);
        ArgumentNullException.ThrowIfNull(filters);

        var document = new NotificationExportDocument(
            Schema,
            exportedAt ?? DateTimeOffset.UtcNow,
            filters,
            records.Count,
            records);
        return JsonSerializer.SerializeToUtf8Bytes(document, JsonOptions);
    }

    public byte[] ToMarkdown(
        IReadOnlyList<NotificationRecord> records,
        NotificationExportFilters filters,
        DateTimeOffset? exportedAt = null)
    {
        ArgumentNullException.ThrowIfNull(records);
        ArgumentNullException.ThrowIfNull(filters);

        var at = (exportedAt ?? DateTimeOffset.UtcNow).ToUniversalTime().ToString("O");
        var builder = new StringBuilder();
        builder.AppendLine("# AC Defender notification history");
        builder.AppendLine();
        builder.AppendLine($"- Schema: `{Schema}`");
        builder.AppendLine($"- Exported at (UTC): `{EscapeCode(at)}`");
        builder.AppendLine($"- Search: `{EscapeCode(filters.Search)}`");
        builder.AppendLine($"- Search mode: `{EscapeCode(filters.SearchMode)}`");
        builder.AppendLine($"- Search flags: `{EscapeCode(filters.SearchFlags)}`");
        builder.AppendLine($"- Level filter: `{EscapeCode(filters.Level)}`");
        builder.AppendLine($"- Include dismissed: `{filters.IncludeDismissed.ToString().ToLowerInvariant()}`");
        builder.AppendLine($"- Records exported: `{records.Count}`");
        builder.AppendLine();

        if (records.Count == 0)
        {
            builder.AppendLine("No notifications matched the current filters.");
            return Encoding.UTF8.GetBytes(builder.ToString());
        }

        builder.AppendLine("| Timestamp (UTC) | Level | Read | Dismissed | Message |");
        builder.AppendLine("| --- | --- | --- | --- | --- |");
        foreach (var record in records)
        {
            builder.Append('|').Append(' ')
                .Append(EscapeCell(record.Timestamp.ToUniversalTime().ToString("O"))).Append(" | ")
                .Append(EscapeCell(record.Level)).Append(" | ")
                .Append(record.Read ? "yes" : "no").Append(" | ")
                .Append(record.Dismissed ? "yes" : "no").Append(" | ")
                .Append(EscapeCell(record.Message)).AppendLine(" |");
        }

        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private static string EscapeCell(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("|", "\\|", StringComparison.Ordinal)
            .Replace("\r", " ", StringComparison.Ordinal)
            .Replace("\n", "<br>", StringComparison.Ordinal);

    private static string EscapeCode(string value) => value.Replace("`", "\\`", StringComparison.Ordinal);
}

public sealed record NotificationExportFilters(
    string Search,
    string SearchMode,
    string SearchFlags,
    string Level,
    bool IncludeDismissed);

public sealed record NotificationExportDocument(
    string Schema,
    DateTimeOffset ExportedAt,
    NotificationExportFilters Filters,
    int Count,
    IReadOnlyList<NotificationRecord> Notifications);
