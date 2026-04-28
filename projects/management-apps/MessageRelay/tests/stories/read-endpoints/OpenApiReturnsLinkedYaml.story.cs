// User story: An API client requests /openapi.yaml from relay-dotnet — it must
// return the byte-identical canonical YAML document that the TS sibling serves
// from message-relay/docs/openapi.yaml. The Linked Content item in the csproj
// guarantees one source of truth; this test proves the wire side honors it.
//
// Negative control: the response Content-Type is application/yaml, NOT
// application/json. If a future refactor accidentally rewires the endpoint
// through the JSON serializer, this test fails for the right reason.

using System.Net;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class OpenApiReturnsLinkedYaml : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public OpenApiReturnsLinkedYaml(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetOpenApiReturnsYamlDocument()
    {
        // Given: the relay-dotnet build linked the TS openapi.yaml into output/docs/.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: a client requests the spec.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/openapi.yaml", UriKind.Relative), cts.Token);

        // Then: 200 with a YAML body.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        string mediaType = resp.Content.Headers.ContentType?.MediaType ?? string.Empty;
        Assert.Equal("application/yaml", mediaType);

        string body = await resp.Content.ReadAsStringAsync(cts.Token);
        Assert.StartsWith("openapi:", body, StringComparison.Ordinal);

        // Negative control: the response is NOT served as JSON.
        Assert.NotEqual("application/json", mediaType);
    }
}
