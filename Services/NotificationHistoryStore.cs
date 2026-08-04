using System.Text.Json;
using HomeAssistantAcDefender.Models;
using HomeAssistantAcDefender.Options;
using Microsoft.Extensions.Options;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Durable, append-only notification journal for defender activity.
///
/// The journal lives beside the existing defender state file on the persisted data volume. A
/// notification is never required for an actuator operation to succeed: a disk problem is logged and
/// the live event still reaches the in-memory snapshot. Read/dismiss changes are journal entries too,
/// so a restart cannot make a previously reviewed notification look new again.
/// </summary>
public sealed class NotificationHistoryStore
{
    private const int MaximumMessageLength = 4_000;
    private const int MaximumReadLimit = 500;
    private const int MaximumInMemoryRecords = 20_000;
    private static readonly HashSet<string> KnownLevels = new(StringComparer.OrdinalIgnoreCase)
    {
        "info", "success", "warning", "error"
    };

    private readonly object gate = new();
    private readonly ILogger<NotificationHistoryStore> logger;
    private readonly string journalPath;
    private readonly Dictionary<Guid, NotificationState> records = [];
    private readonly JsonSerializerOptions jsonOptions = new(JsonSerializerDefaults.Web);

    public NotificationHistoryStore(
        IOptions<DefenderOptions> options,
        IWebHostEnvironment environment,
        ILogger<NotificationHistoryStore> logger)
    {
        this.logger = logger;
        var statePath = ResolvePath(options.Value.StateFilePath, environment.ContentRootPath);
        journalPath = Path.Combine(Path.GetDirectoryName(statePath) ?? environment.ContentRootPath, "notification-history.jsonl");
        LoadJournal();
    }

    public string JournalPath => journalPath;

    /// <summary>Records a non-blocking defender notice without ever throwing into the control path.</summary>
    public NotificationRecord Append(string level, string message, DateTimeOffset? timestamp = null)
    {
        var record = new NotificationRecord(
            Guid.NewGuid(),
            timestamp ?? DateTimeOffset.UtcNow,
            NormalizeLevel(level),
            NormalizeMessage(message),
            false,
            false,
            null,
            null);

        lock (gate)
        {
            var entry = JournalEntry.Created(record);
            if (!TryAppendJournal(entry))
            {
                // Keep the current process useful when the data volume is temporarily read-only;
                // the event is still visible through the live snapshot and can be retried next time.
                records[record.Id] = NotificationState.From(record);
                TrimInMemoryRecords();
                return record;
            }

            records[record.Id] = NotificationState.From(record);
            TrimInMemoryRecords();
            return record;
        }
    }

    public NotificationHistorySnapshot GetSnapshot(
        int limit = 100,
        bool includeDismissed = false,
        string? level = null)
    {
        lock (gate)
        {
            var normalizedLevel = string.IsNullOrWhiteSpace(level) ? null : NormalizeLevel(level);
            var active = records.Values
                .Where(item => includeDismissed || !item.Dismissed)
                .Where(item => normalizedLevel is null || string.Equals(item.Level, normalizedLevel, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(item => item.Timestamp)
                .ThenByDescending(item => item.Id)
                .Take(Math.Clamp(limit, 1, MaximumReadLimit))
                .Select(item => item.ToRecord())
                .ToArray();

            var allActive = records.Values.Count(item => !item.Dismissed);
            var unread = records.Values.Count(item => !item.Read && !item.Dismissed);
            return new NotificationHistorySnapshot(active, unread, allActive);
        }
    }

    public bool MarkRead(Guid id)
    {
        lock (gate)
        {
            if (!records.TryGetValue(id, out var record) || record.Read)
            {
                return records.ContainsKey(id);
            }

            var at = DateTimeOffset.UtcNow;
            if (!TryAppendJournal(JournalEntry.StateChange(id, "read", at)))
            {
                return false;
            }

            record.Read = true;
            record.ReadAt = at;
            return true;
        }
    }

    public bool Dismiss(Guid id)
    {
        lock (gate)
        {
            if (!records.TryGetValue(id, out var record) || record.Dismissed)
            {
                return records.ContainsKey(id);
            }

            var at = DateTimeOffset.UtcNow;
            if (!TryAppendJournal(JournalEntry.StateChange(id, "dismissed", at)))
            {
                return false;
            }

            record.Dismissed = true;
            record.DismissedAt = at;
            return true;
        }
    }

    public bool Restore(Guid id)
    {
        lock (gate)
        {
            if (!records.TryGetValue(id, out var record) || !record.Dismissed)
            {
                return records.ContainsKey(id);
            }

            var at = DateTimeOffset.UtcNow;
            if (!TryAppendJournal(JournalEntry.StateChange(id, "restored", at)))
            {
                return false;
            }

            record.Dismissed = false;
            record.DismissedAt = null;
            return true;
        }
    }

    private void LoadJournal()
    {
        lock (gate)
        {
            try
            {
                if (!File.Exists(journalPath))
                {
                    return;
                }

                foreach (var line in File.ReadLines(journalPath))
                {
                    if (string.IsNullOrWhiteSpace(line))
                    {
                        continue;
                    }

                    try
                    {
                        var entry = JsonSerializer.Deserialize<JournalEntry>(line, jsonOptions);
                        if (entry is not null)
                        {
                            Apply(entry);
                        }
                    }
                    catch (JsonException ex)
                    {
                        // A torn final line must not hide the valid history before it.
                        logger.LogWarning(ex, "Ignoring malformed notification journal line in {JournalPath}", journalPath);
                    }
                }

                TrimInMemoryRecords();
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not load notification journal {JournalPath}", journalPath);
            }
        }
    }

    private bool TryAppendJournal(JournalEntry entry)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(journalPath) ?? ".");
            var line = JsonSerializer.Serialize(entry, jsonOptions) + Environment.NewLine;
            File.AppendAllText(journalPath, line);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not append notification journal {JournalPath}", journalPath);
            return false;
        }
    }

    private void Apply(JournalEntry entry)
    {
        if (entry.Id == Guid.Empty)
        {
            return;
        }

        switch (entry.Kind?.ToLowerInvariant())
        {
            case "created" when !string.IsNullOrWhiteSpace(entry.Message):
                records[entry.Id] = new NotificationState
                {
                    Id = entry.Id,
                    Timestamp = entry.Timestamp,
                    Level = NormalizeLevel(entry.Level),
                    Message = NormalizeMessage(entry.Message),
                };
                break;
            case "read" when records.TryGetValue(entry.Id, out var read):
                read.Read = true;
                read.ReadAt = entry.Timestamp;
                break;
            case "dismissed" when records.TryGetValue(entry.Id, out var dismissed):
                dismissed.Dismissed = true;
                dismissed.DismissedAt = entry.Timestamp;
                break;
            case "restored" when records.TryGetValue(entry.Id, out var restored):
                restored.Dismissed = false;
                restored.DismissedAt = null;
                break;
        }
    }

    private void TrimInMemoryRecords()
    {
        if (records.Count <= MaximumInMemoryRecords)
        {
            return;
        }

        foreach (var key in records.Values
                     .OrderBy(item => item.Timestamp)
                     .Take(records.Count - MaximumInMemoryRecords)
                     .Select(item => item.Id)
                     .ToArray())
        {
            records.Remove(key);
        }
    }

    private static string NormalizeLevel(string? level) =>
        !string.IsNullOrWhiteSpace(level) && KnownLevels.Contains(level)
            ? level.Trim().ToLowerInvariant()
            : "info";

    private static string NormalizeMessage(string? message)
    {
        var normalized = (message ?? "").Trim();
        return normalized.Length <= MaximumMessageLength ? normalized : normalized[..MaximumMessageLength];
    }

    private static string ResolvePath(string path, string contentRoot)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return Path.Combine(contentRoot, "App_Data", "defender-state.json");
        }

        return Path.IsPathRooted(path) ? path : Path.GetFullPath(Path.Combine(contentRoot, path));
    }

    private sealed class NotificationState
    {
        public Guid Id { get; init; }

        public DateTimeOffset Timestamp { get; init; }

        public string Level { get; init; } = "info";

        public string Message { get; init; } = "";

        public bool Read { get; set; }

        public bool Dismissed { get; set; }

        public DateTimeOffset? ReadAt { get; set; }

        public DateTimeOffset? DismissedAt { get; set; }

        public static NotificationState From(NotificationRecord record) => new()
        {
            Id = record.Id,
            Timestamp = record.Timestamp,
            Level = record.Level,
            Message = record.Message,
            Read = record.Read,
            Dismissed = record.Dismissed,
            ReadAt = record.ReadAt,
            DismissedAt = record.DismissedAt,
        };

        public NotificationRecord ToRecord() => new(Id, Timestamp, Level, Message, Read, Dismissed, ReadAt, DismissedAt);
    }

    private sealed class JournalEntry
    {
        public Guid Id { get; init; }

        public string Kind { get; init; } = "";

        public DateTimeOffset Timestamp { get; init; }

        public string Level { get; init; } = "info";

        public string Message { get; init; } = "";

        public static JournalEntry Created(NotificationRecord record) => new()
        {
            Id = record.Id,
            Kind = "created",
            Timestamp = record.Timestamp,
            Level = record.Level,
            Message = record.Message,
        };

        public static JournalEntry StateChange(Guid id, string kind, DateTimeOffset timestamp) => new()
        {
            Id = id,
            Kind = kind,
            Timestamp = timestamp,
        };
    }
}
