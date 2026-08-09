using System.Net;
using System.Text;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// A bounded Home Assistant service failure. It retains only an operation identity and HTTP status;
/// it never reads request headers, request payloads, or an upstream response body.
/// </summary>
public sealed class HomeAssistantServiceException : HttpRequestException
{
    private HomeAssistantServiceException(string operation, HttpStatusCode statusCode)
        : base(FormatMessage(operation, statusCode), inner: null, statusCode)
    {
        Operation = operation;
    }

    /// <summary>The bounded Home Assistant operation identity, for example <c>climate.set_temperature</c>.</summary>
    public string Operation { get; }

    internal static HomeAssistantServiceException FromResponse(
        string domain,
        string service,
        HttpResponseMessage response)
    {
        var operation = $"{SanitizeOperationSegment(domain)}.{SanitizeOperationSegment(service)}";
        return new HomeAssistantServiceException(operation, response.StatusCode);
    }

    private static string SanitizeOperationSegment(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "service";
        }

        var builder = new StringBuilder(Math.Min(value.Length, 48));
        foreach (var character in value.Trim())
        {
            if (char.IsAsciiLetterOrDigit(character) || character is '_' or '-' or '.')
            {
                builder.Append(character);
            }

            if (builder.Length == 48)
            {
                break;
            }
        }

        return builder.Length == 0 ? "service" : builder.ToString();
    }

    private static string FormatMessage(string operation, HttpStatusCode statusCode) =>
        $"Home Assistant returned HTTP {(int)statusCode} for {operation}.";
}
