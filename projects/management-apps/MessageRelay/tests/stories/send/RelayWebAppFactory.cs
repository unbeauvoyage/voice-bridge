// In-process integration host for MessageRelay story tests. Wraps
// WebApplicationFactory<Program> with the test environment set so DI defaults
// (TimeProvider.System, dashboard broadcaster) come from production wiring.
//
// Creates a temp discovery dir with a registered "test-sender.port" so the
// CeoBroadcastsToDashboard story (which uses from:"test-sender") passes the
// sender-registry guard introduced alongside the 401/403 feature.

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MessageRelay.StoryTests.Send;

public sealed class RelayWebAppFactory : WebApplicationFactory<Program>
{
    private readonly string discoveryDir =
        Path.Combine(Path.GetTempPath(), $"relay-test-{Guid.NewGuid():N}");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        Directory.CreateDirectory(discoveryDir);
        using (FileStream _ = new(
            Path.Combine(discoveryDir, "test-sender.port"),
            FileMode.Create, FileAccess.Write, FileShare.None, 4096, useAsync: true)) { }
        builder.UseEnvironment("Testing");
        builder.UseSetting("RELAY_DISCOVERY_DIR", discoveryDir);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && Directory.Exists(discoveryDir))
        {
            try
            {
                Directory.Delete(discoveryDir, recursive: true);
            }
            catch (IOException) { /* best-effort cleanup */ }
            catch (UnauthorizedAccessException) { /* best-effort cleanup */ }
        }
        base.Dispose(disposing);
    }
}
