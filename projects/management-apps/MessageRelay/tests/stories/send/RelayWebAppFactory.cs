// In-process integration host for MessageRelay story tests. Wraps
// WebApplicationFactory<Program> with the test environment set so DI defaults
// (TimeProvider.System, dashboard broadcaster) come from production wiring.
//
// One factory per IClassFixture<> usage = one server per test class.

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MessageRelay.StoryTests.Send;

public sealed class RelayWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
    }
}
