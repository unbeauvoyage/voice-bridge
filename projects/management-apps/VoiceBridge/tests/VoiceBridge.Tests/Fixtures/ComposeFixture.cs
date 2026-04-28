using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace VoiceBridge.Tests.Fixtures;

/// <summary>
/// Per-class xunit fixture that boots the test-only AppHost in-process and
/// exposes a configured <see cref="HttpClient"/> bound to the
/// voice-bridge-dotnet resource.
/// <para/>
/// CEO directive Q5(C): the fixture forwards RELAY_URL / WHISPER_URL /
/// CONTENT_SERVICE_URL into the AppHost's IConfiguration. Today (RED → GREEN
/// against TS peers) those default to the TS-stack canonical ports
/// (relay-ts :8767, whisper :8766, content-service-ts :8770). When the .NET
/// peers ship, a single env-var flip points them at the .NET ports — no test
/// code change required.
/// </summary>
public sealed class ComposeFixture : IAsyncLifetime
{
    private DistributedApplication? application;

    public string RelayUrl { get; }
        = Environment.GetEnvironmentVariable("VBTEST_RELAY_URL") ?? "http://127.0.0.1:8767";

    public string WhisperUrl { get; }
        = Environment.GetEnvironmentVariable("VBTEST_WHISPER_URL") ?? "http://127.0.0.1:8766";

    public string ContentServiceUrl { get; }
        = Environment.GetEnvironmentVariable("VBTEST_CONTENT_SERVICE_URL") ?? "http://127.0.0.1:8770";

    public DistributedApplication Application =>
        application ?? throw new InvalidOperationException(
            "ComposeFixture has not finished InitializeAsync — Application is unavailable.");

    public HttpClient CreateClient() =>
        Application.CreateHttpClient("voice-bridge-dotnet");

    public async ValueTask InitializeAsync()
    {
        IDistributedApplicationTestingBuilder builder =
            await DistributedApplicationTestingBuilder.CreateAsync<Projects.VoiceBridge_Tests_AppHost>();

        builder.Configuration["RelayUrl"] = RelayUrl;
        builder.Configuration["WhisperUrl"] = WhisperUrl;
        builder.Configuration["ContentServiceUrl"] = ContentServiceUrl;

        application = await builder.BuildAsync();
        await application.StartAsync();

        ResourceNotificationService notifications =
            application.Services.GetRequiredService<ResourceNotificationService>();

        await notifications.WaitForResourceAsync(
            "voice-bridge-dotnet",
            KnownResourceStates.Running,
            cancellationToken: new CancellationTokenSource(TimeSpan.FromSeconds(60)).Token);
    }

    public async ValueTask DisposeAsync()
    {
        if (application is not null)
        {
            await application.StopAsync();
            await application.DisposeAsync();
        }
    }
}
