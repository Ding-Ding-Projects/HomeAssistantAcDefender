using HomeAssistantAcDefender.Options;
using Microsoft.Extensions.Options;

namespace HomeAssistantAcDefender.Services;

public sealed record SetupValidationResult(bool Success, string Code, string? EntityId = null);

/// <summary>Checks the configured integration using state reads only.</summary>
public sealed class SetupValidationService(HttpClient httpClient, IOptionsMonitor<HomeAssistantOptions> options,
    ILogger<HomeAssistantClient> logger, HomeAssistantTokenStore tokenStore)
{
    public async Task<SetupValidationResult> ValidateAsync(CancellationToken cancellationToken)
    {
        var client = new HomeAssistantClient(httpClient, options, logger, tokenStore);
        if (!client.IsConfigured) return new(false, "not-configured");
        if (string.IsNullOrWhiteSpace(options.CurrentValue.EntityId)
            || !options.CurrentValue.EntityId.StartsWith("climate.", StringComparison.Ordinal))
            return new(false, "entity-required");
        try
        {
            var reading = await client.GetDiningRoomClimateAsync(cancellationToken);
            return reading is null ? new(false, "unavailable") : new(true, "ready", reading.EntityId);
        }
        catch (OperationCanceledException) { return new(false, "interrupted"); }
        catch (Exception) { return new(false, "connection-failed"); }
    }
}

/// <summary>Bounds setup responses and prevents accidental command requests.</summary>
public sealed class SetupReadOnlyHandler : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.Method != HttpMethod.Get) throw new HttpRequestException("Setup permits state reads only.");
        var response = await base.SendAsync(request, cancellationToken);
        try
        {
            if ((int)response.StatusCode is >= 300 and < 400) throw new HttpRequestException("Setup does not follow redirects.");
            const int limit = 1024 * 1024;
            if (response.Content.Headers.ContentLength > limit) throw new HttpRequestException("Setup response exceeded the limit.");
            await using var input = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var output = new MemoryStream();
            var buffer = new byte[8192];
            int read;
            while ((read = await input.ReadAsync(buffer, cancellationToken)) > 0)
            {
                if (output.Length + read > limit) throw new HttpRequestException("Setup response exceeded the limit.");
                output.Write(buffer, 0, read);
            }
            var replacement = new ByteArrayContent(output.ToArray());
            foreach (var header in response.Content.Headers) replacement.Headers.TryAddWithoutValidation(header.Key, header.Value);
            response.Content.Dispose();
            response.Content = replacement;
            return response;
        }
        catch { response.Dispose(); throw; }
    }
}
