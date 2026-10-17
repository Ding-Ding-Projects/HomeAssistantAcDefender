using System.Net;
using HomeAssistantAcDefender.Services;

namespace HomeAssistantAcDefender.Tests;

public static class SetupReadOnlyHandlerTests
{
    public static async Task RunAsync()
    {
        var transport = new StubHandler(() => new(HttpStatusCode.OK) { Content = new StringContent("{}") });
        using var client = new HttpClient(new SetupReadOnlyHandler { InnerHandler = transport });
        using var response = await client.GetAsync("https://example.invalid/api/states/climate.test");
        if (await response.Content.ReadAsStringAsync() != "{}") throw new Exception("State content was changed.");
        try { await client.PostAsync("https://example.invalid/api/services/climate/set_temperature", new StringContent("{}")); throw new Exception("Write was allowed."); }
        catch (HttpRequestException) { }
        if (transport.Count != 1) throw new Exception("A write reached the transport.");
        using var redirectClient = new HttpClient(new SetupReadOnlyHandler { InnerHandler = new StubHandler(() => new(HttpStatusCode.Redirect)) });
        await Reject(redirectClient);
        using var largeClient = new HttpClient(new SetupReadOnlyHandler { InnerHandler = new StubHandler(() => new(HttpStatusCode.OK) { Content = new ByteArrayContent(new byte[1024 * 1024 + 1]) }) });
        await Reject(largeClient);
    }
    private static async Task Reject(HttpClient client)
    {
        try { await client.GetAsync("https://example.invalid/api/states/climate.test"); throw new Exception("Unsafe response was accepted."); }
        catch (HttpRequestException) { }
    }
    private sealed class StubHandler(Func<HttpResponseMessage> response) : HttpMessageHandler
    {
        public int Count { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        { Count++; return Task.FromResult(response()); }
    }
}
