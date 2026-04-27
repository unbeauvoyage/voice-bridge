/**
 * otel.ts — OpenTelemetry SDK initialization for voice-bridge2 server.
 *
 * Must be imported BEFORE any other module in server/index.ts.
 *
 * Prefers DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL (injected by Aspire DCP for any
 * launch profile) over OTEL_EXPORTER_OTLP_ENDPOINT (AppHost override). DCP injects
 * the correct endpoint for the active profile (http or https); the AppHost override
 * is a fallback for out-of-Aspire runs. When the endpoint is https, TLS cert
 * verification is disabled — Aspire DCP uses self-signed certs in local dev.
 *
 * Protocol: OTLP/HTTP + JSON.
 * SimpleSpanProcessor is used so spans flush immediately — Bun's event loop
 * doesn't reliably drain BatchSpanProcessor before SIGTERM.
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { trace, type Tracer } from '@opentelemetry/api'

const otlpRaw =
  process.env['DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL'] ??
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
  ''
const endpoint = otlpRaw.length > 0 ? otlpRaw.replace(/\/+$/, '') : null

let sdk: NodeSDK | null = null

if (endpoint !== null) {
  if (endpoint.startsWith('https://')) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
  }
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] ?? 'voice-bridge-server',
    [ATTR_SERVICE_VERSION]: '1.0.0'
  })

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
  const metricExporter = new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` })

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new SimpleSpanProcessor(traceExporter)],
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000
    }),
    instrumentations: []
  })

  sdk.start()

  process.on('SIGTERM', () => {
    void sdk?.shutdown().then(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    void sdk?.shutdown().then(() => process.exit(0))
  })
}

/** Returns the tracer for voice-bridge2 server spans. No-op tracer when OTel is not configured. */
export function getTracer(): Tracer {
  return trace.getTracer('voice-bridge-server')
}

export { sdk }
