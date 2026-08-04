namespace HomeAssistantAcDefender.Models;

/// <summary>
/// A notification emitted by the real defender pipeline. The record is deliberately separate from
/// thermostat state so the centre can retain reviewable notices after the in-memory event tail rolls off.
/// </summary>
public sealed record NotificationRecord(
    Guid Id,
    DateTimeOffset Timestamp,
    string Level,
    string Message,
    bool Read,
    bool Dismissed,
    DateTimeOffset? ReadAt,
    DateTimeOffset? DismissedAt,
    IReadOnlyList<string>? Actions = null);

public sealed record NotificationHistorySnapshot(
    IReadOnlyList<NotificationRecord> Items,
    int UnreadCount,
    int ActiveCount,
    IReadOnlyDictionary<string, int>? ActionCounts = null);
