/**
 * Provider status wire types — `/v1/providers/status`.
 * Surfaces which third-party data sources are healthy.
 */

export interface ProviderStatusWire {
  id: string;
  configured: boolean;
  capabilities: Record<string, boolean>;
}

export interface ProvidersStatusResponseWire {
  providers: ProviderStatusWire[];
}
