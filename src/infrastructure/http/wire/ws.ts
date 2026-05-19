/**
 * WebSocket frame wire types — `/ws/scans`, `/ws/scanner/jobs/:id`.
 */

import type { ID, ISODate, ScanAngle } from "../atoms";
import type { ScanJob } from "./scan";

export interface WsFrame<T = unknown> {
  type: string;
  ts: ISODate;
  request_id: string;
  data: T;
}

export interface WsHello {
  user_id: ID;
}

export interface WsScanProgress {
  scan_id: ID;
  status: ScanJob["status"];
  progress: number;
  angle?: ScanAngle;
}

export interface WsScanFailed {
  scan_id: ID;
  reason: string;
  code: string;
}
