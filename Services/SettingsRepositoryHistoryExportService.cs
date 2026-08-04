using System.Text;
using System.Text.Json;
using HomeAssistantAcDefender.Models;

namespace HomeAssistantAcDefender.Services;

public sealed class SettingsRepositoryHistoryExportService
{
    public const string Schema = "ac-defender.settings-history.v1";

    public byte[] ToJson(
        IReadOnlyList<SettingsRepositoryCommit> commits,
        SettingsRepositoryHistoryExportFilters filters,
        DateTimeOffset? exportedAt = null)
    {
        var document = new
        {
            schema = Schema,
            exportedAt = (exportedAt ?? DateTimeOffset.UtcNow).ToUniversalTime(),
            count = commits.Count,
            filters,
            commits = commits.Select(commit => new
            {
                hash = commit.Hash,
                shortHash = commit.ShortHash,
                timestamp = commit.Timestamp,
                action = SettingsRepositoryHistoryFilters.ActionFor(commit),
                message = commit.Message
            })
        };

        return JsonSerializer.SerializeToUtf8Bytes(document, new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            WriteIndented = true
        });
    }

    public byte[] ToMarkdown(
        IReadOnlyList<SettingsRepositoryCommit> commits,
        SettingsRepositoryHistoryExportFilters filters,
        DateTimeOffset? exportedAt = null)
    {
        var when = (exportedAt ?? DateTimeOffset.UtcNow).ToUniversalTime();
        var builder = new StringBuilder();
        builder.AppendLine("# AC Defender settings history export");
        builder.AppendLine();
        builder.AppendLine($"- Schema: `{Schema}`");
        builder.AppendLine($"- Exported at (UTC): `{when:O}`");
        builder.AppendLine($"- Records: `{commits.Count}`");
        builder.AppendLine($"- Search: `{EscapeCode(filters.Search)}`");
        builder.AppendLine($"- Search mode: `{EscapeCode(filters.SearchMode)}`");
        builder.AppendLine($"- Search flags: `{EscapeCode(filters.SearchFlags)}`");
        builder.AppendLine($"- Date range (UTC): `{EscapeCode(filters.FromDate)}` → `{EscapeCode(filters.ToDate)}`");
        builder.AppendLine($"- Action filter: `{EscapeCode(string.Join(", ", filters.Actions ?? []))}`");
        builder.AppendLine();

        if (commits.Count == 0)
        {
            builder.AppendLine("No settings commits matched the current filters.");
            return Encoding.UTF8.GetBytes(builder.ToString());
        }

        builder.AppendLine("| Commit | Timestamp | Action | Message |");
        builder.AppendLine("| --- | --- | --- | --- |");
        foreach (var commit in commits)
        {
            builder.AppendLine($"| `{EscapeCode(commit.ShortHash)}` | `{EscapeCode(commit.Timestamp)}` | `{EscapeCode(SettingsRepositoryHistoryFilters.ActionFor(commit))}` | {EscapeTable(commit.Message)} |");
        }

        return Encoding.UTF8.GetBytes(builder.ToString());
    }

    private static string EscapeCode(string? value) => (value ?? "").Replace("`", "'", StringComparison.Ordinal);

    private static string EscapeTable(string? value) => (value ?? "")
        .Replace("|", "\\|", StringComparison.Ordinal)
        .Replace("\r", "", StringComparison.Ordinal)
        .Replace("\n", "<br>", StringComparison.Ordinal);
}

public sealed record SettingsRepositoryHistoryExportFilters(
    string Search,
    string SearchMode,
    string SearchFlags,
    string FromDate,
    string ToDate,
    IReadOnlyList<string> Actions);
