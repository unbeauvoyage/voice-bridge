/**
 * otel.ts — OpenTelemetry SDK initialization for voice-bridge2 server.
 *
 * Must be imported BEFORE any other module in server/index.ts.
 *
 * Reads OTEL_EXPORTER_OTLP_ENDPOINT from the environment (injected by .NET Aspire).
 * If the variable is absent, this module is a no-op.
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

const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT']

let sdk: NodeSDK | null = null

if (endpoint) {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] ?? 'voice-bridge-server',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  })

  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
  const metricExporter = new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` })

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new SimpleSpanProcessor(traceExporter)],
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10_000,
    }),
    instrumentations: [],
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
