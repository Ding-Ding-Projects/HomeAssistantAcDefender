using System.Reflection;
using System.Globalization;

namespace HomeAssistantAcDefender.Services;

public static class PresentationBuildInfo
{
    private static readonly Assembly Assembly = typeof(PresentationBuildInfo).Assembly;
    public static string Version => Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
        ?? Assembly.GetName().Version?.ToString() ?? "Unavailable";
    public static string? SourceRevision => Metadata("SourceRevision");
    public static string? TimestampUtc =>
        !string.IsNullOrWhiteSpace(SourceRevision)
        && DateTimeOffset.TryParse(Metadata("BuildTimestampUtc"), CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal, out var timestamp)
        ? timestamp.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture) : null;
    private static string? Metadata(string key) => Assembly.GetCustomAttributes<AssemblyMetadataAttribute>()
        .FirstOrDefault(attribute => attribute.Key == key)?.Value;
}
