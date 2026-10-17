using System.Reflection;
using HomeAssistantAcDefender.Components.Pages;
using HomeAssistantAcDefender.Components.Shared;
using Microsoft.JSInterop;

public static class LocalToolsLifecycleTests
{
    public static async Task PrerenderSkipsInteropAndInteractiveDisposalIsBounded()
    {
        foreach (var type in new[] { typeof(LocalTools), typeof(LogoPreferences) })
        {
            var instance = (IAsyncDisposable)Activator.CreateInstance(type)!;
            var runtime = new RecordingRuntime();
            type.GetProperty("JS", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(instance, runtime);
            await instance.DisposeAsync();
            if (runtime.Calls != 0) throw new Exception($"{type.Name}: prerender disposal attempted interop.");

            type.GetField("_initialized", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(instance, true);
            await instance.DisposeAsync();
            await instance.DisposeAsync();
            if (runtime.Calls != 1) throw new Exception($"{type.Name}: initialized disposal was not exactly once.");

            type.GetField("_initialized", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(instance, true);
            runtime.Failure = new JSDisconnectedException("Test circuit disconnected.");
            await instance.DisposeAsync();

            type.GetField("_initialized", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(instance, true);
            runtime.Failure = new InvalidOperationException("Unexpected runtime failure.");
            try { await instance.DisposeAsync(); }
            catch (InvalidOperationException) { continue; }
            throw new Exception($"{type.Name}: unexpected runtime failure was swallowed.");
        }
    }

    private sealed class RecordingRuntime : IJSRuntime
    {
        public int Calls { get; private set; }
        public Exception? Failure { get; set; }
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, object?[]? args)
            => InvokeAsync<TValue>(identifier, CancellationToken.None, args);
        public ValueTask<TValue> InvokeAsync<TValue>(string identifier, CancellationToken cancellationToken, object?[]? args)
        {
            if (identifier != "localTools.dispose") throw new Exception("Unexpected interop identifier.");
            Calls++;
            if (Failure is not null) return ValueTask.FromException<TValue>(Failure);
            return ValueTask.FromResult(default(TValue)!);
        }
    }
}
