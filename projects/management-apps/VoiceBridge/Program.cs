using BackendShared;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.AddBackendDefaults();

WebApplication app = builder.Build();
app.MapDefaultEndpoints();

// Endpoint registrations live in Features/<FeatureName>/<FeatureName>Endpoint.cs
// as static extension methods on IEndpointRouteBuilder. Wire them here, one
// line per feature: app.MapComposeFeature(); app.MapTranscribeFeature(); etc.
// See CLAUDE.md for the vertical-slice convention.

app.Run();
