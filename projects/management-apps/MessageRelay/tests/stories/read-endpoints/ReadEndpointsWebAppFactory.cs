// Integration host for read-endpoint story tests. Uses IAsyncLifetime to write
// port files asynchronously before the test host is built. Three .port files:
//   chief-of-staff.port  (valid agent — must appear in agents/status/channels)
//   ceo.port             (system name — must be excluded from all lists)
//   relay.port           (system name — must be excluded from all lists)
//
// Cleanup: directory deleted in Dispose(bool) which WebApplicationFactory calls
// from both IDisposable.Dispose() and IAsyncDisposable.DisposeAsync().

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class ReadEndpointsWebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    internal readonly string DiscoveryDir =
        Path.Combine(Path.GetTempPath(), $"relay-read-test-{Guid.NewGuid():N}");

    async ValueTask IAsyncLifetime.InitializeAsync()
    {
        Directory.CreateDirectory(DiscoveryDir);
        await WritePortFileAsync(Path.Combine(DiscoveryDir, "chief-of-staff.port"), 9000).ConfigureAwait(false);
        await WritePortFileAsync(Path.Combine(DiscoveryDir, "ceo.port"), 9001).ConfigureAwait(false);
        await WritePortFileAsync(Path.Combine(DiscoveryDir, "relay.port"), 9002).ConfigureAwait(false);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
        builder.UseSetting("RELAY_DISCOVERY_DIR", DiscoveryDir);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && Directory.Exists(DiscoveryDir))
        {
            try
            {
                Directory.Delete(DiscoveryDir, recursive: true);
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        base.Dispose(disposing);
    }

    private static async Task WritePortFileAsync(string path, int port)
    {
        byte[] bytes = System.Text.Encoding.UTF8.GetBytes($"{{\"port\":{port}}}");
        await using FileStream fs = new(
            path,
            FileMode.Create,
            FileAccess.Write,
            FileShare.None,
            bufferSize: 4096,
            useAsync: true);
        await fs.WriteAsync(bytes, CancellationToken.None).ConfigureAwait(false);
    }
}
