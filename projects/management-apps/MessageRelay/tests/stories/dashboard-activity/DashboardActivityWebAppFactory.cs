using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MessageRelay.StoryTests.DashboardActivity;

public sealed class DashboardActivityWebAppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
        builder.UseSetting(
            "RELAY_DISCOVERY_DIR",
            Path.Combine(Path.GetTempPath(), $"relay-dash-act-{Guid.NewGuid():N}"));
    }
}
