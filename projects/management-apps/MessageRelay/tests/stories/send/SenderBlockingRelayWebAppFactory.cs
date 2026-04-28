// Test factory that wires a temp discovery dir so story tests can control
// which sender names are "registered" (port file present) vs blocked (403).
// One instance per IClassFixture<> usage; the temp dir is cleaned up on dispose.

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MessageRelay.StoryTests.Send;

public sealed class SenderBlockingRelayWebAppFactory : WebApplicationFactory<Program>
{
    public string DiscoveryDir { get; } =
        Path.Combine(Path.GetTempPath(), $"relay-test-{Guid.NewGuid():N}");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        Directory.CreateDirectory(DiscoveryDir);
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
            catch (IOException) { /* best-effort cleanup */ }
            catch (UnauthorizedAccessException) { /* best-effort cleanup */ }
        }
        base.Dispose(disposing);
    }
}
