// Test factory that sets RELAY_SECRET so the auth middleware is active.
// Used by MissingSecretRejected and WrongSecretRejected story tests.

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MessageRelay.StoryTests.Send;

public sealed class SecuredRelayWebAppFactory : WebApplicationFactory<Program>
{
    public const string TestSecret = "test-relay-secret-abc123";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        builder.UseEnvironment("Testing");
        builder.UseSetting("RELAY_SECRET", TestSecret);
    }
}
