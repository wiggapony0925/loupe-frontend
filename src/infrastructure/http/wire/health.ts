/**
 * Health/version wire types — `/health`, `/version`.
 */

export interface HealthResponse {
  status: string;
  uptime_seconds?: number;
  version?: string;
}
