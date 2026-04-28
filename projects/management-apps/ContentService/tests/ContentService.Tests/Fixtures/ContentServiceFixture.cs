using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ContentService.Tests.Fixtures;

/// <summary>
/// Per-class xunit fixture that boots the test-only AppHost in-process,
/// injects a per-fixture temporary <c>CONTENT_DIR</c>, and exposes
/// configured <see cref="HttpClient"/> instances bound to BOTH the
/// content-service-dotnet (this repo's project) and content-service-ts
/// (the canonical TS sibling) resources.
/// <para/>
/// Story tests within a class reuse the same ContentDir, which is what
/// makes the cross-stack flagship story possible (upload via one stack
/// → fetch via the other).
/// </summary>
public sealed class ContentServiceFixture : IAsyncLifetime
{
    public const string DotnetResource = "content-service-dotnet";
    public const string TsResource = "content-service-ts";

    private DistributedApplication? application;

    public string ContentDir { get; } = Path.Combine(
        Path.GetTempPath(),
        $"content-service-tests-{Guid.NewGuid():N}");

    public DistributedApplication Application =>
        application ?? throw new InvalidOperationException(
            "ContentServiceFixture has not finished InitializeAsync — Application is unavailable.");

    public HttpClient CreateDotnetClient() =>
        Application.CreateHttpClient(DotnetResource);

    public HttpClient CreateTsClient() =>
        Application.CreateHttpClient(TsResource);

    public async ValueTask InitializeAsync()
    {
        Directory.CreateDirectory(ContentDir);

        // Pass ContentDir via the AppHost's args[] — the .NET host's default
        // CommandLineConfigurationProvider maps `--Key Value` into
        // IConfiguration, so the AppHost reads it back as
        // `builder.Configuration["ContentDir"]`. Setting Configuration on
        // the returned IDistributedApplicationTestingBuilder is too late;
        // by then the AppHost's Program.cs has already executed inside
        // CreateAsync and crashed for missing config.
        IDistributedApplicationTestingBuilder builder =
            await DistributedApplicationTestingBuilder.CreateAsync<Projects.ContentService_Tests_AppHost>(
                ["--ContentDir", ContentDir]);

        application = await builder.BuildAsync();
        await application.StartAsync();

        ResourceNotificationService notifications =
            application.Services.GetRequiredService<ResourceNotificationService>();

        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(60));

        await notifications.WaitForResourceAsync(
            DotnetResource,
            KnownResourceStates.Running,
            cancellationToken: cts.Token);

        await notifications.WaitForResourceAsync(
            TsResource,
            KnownResourceStates.Running,
            cancellationToken: cts.Token);

        // The TS service binds and reports Running before its /health is
        // actually serving 200s under cold-start. Poll briefly so the
        // first cross-stack test doesn't race the TS Fastify startup.
        await WaitForHealthAsync(TsResource, cts.Token);
        await WaitForHealthAsync(DotnetResource, cts.Token);
    }

    public async ValueTask DisposeAsync()
    {
        if (application is not null)
        {
            await application.StopAsync();
            await application.DisposeAsync();
        }

        try
        {
            if (Directory.Exists(ContentDir))
            {
                Directory.Delete(ContentDir, recursive: true);
            }
        }
        catch (IOException)
        {
            // Cleanup best-effort — leaving stragglers in $TMPDIR is OK; the
            // OS reaps them on reboot.
        }
    }

    private async Task WaitForHealthAsync(string resource, CancellationToken cancellationToken)
    {
        using HttpClient client = Application.CreateHttpClient(resource);
        client.Timeout = TimeSpan.FromSeconds(2);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                using HttpResponseMessage response = await client.GetAsync(
                    new Uri("/health", UriKind.Relative),
                    cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch (HttpRequestException) { }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested) { }

            await Task.Delay(TimeSpan.FromMilliseconds(200), cancellationToken);
        }
    }
}
