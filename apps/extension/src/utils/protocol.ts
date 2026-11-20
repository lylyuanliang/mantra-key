/**
 * 密诀 MantraKey IPC 协议常量与信封构建工具
 */

// 1MB 缓冲区溢出保护硬红线
export const MAX_PAYLOAD_SIZE = 1024 * 1024;

// 请求信封结构
export interface RequestEnvelope {
  id: string;
  action: string;
  ts: number;
  payload: Record<string, unknown>;
}

// 响应信封结构
export interface ResponseEnvelope<T = unknown> {
  id: string;
  status: 'ok' | 'error';
  code: number;
  data: T;
  error?: string | null;
}

/**
 * 构建统一请求信封
 */
export function buildRequestEnvelope(
  action: string,
  payload: Record<string, unknown> = {}
): RequestEnvelope {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const id = `req-${Date.now()}-${randomSuffix}`;
  return {
    id,
    action,
    ts: Date.now(),
    payload,
  };
}

/**
 * 校验载荷大小，若超过 1MB 则阻断并抛出异常，防止 OOM DoS
 */
export function validatePayloadSize(data: string | Uint8Array): void {
  const byteLength = typeof data === 'string'
    ? new TextEncoder().encode(data).length
    : data.byteLength;

  if (byteLength > MAX_PAYLOAD_SIZE) {
    throw new Error(`帧长度超出 1MB 安全上限 (实际大小: ${byteLength} 字节)`);
  }
}

/**
 * 25 秒 PING/PONG 心跳保活管理器
 * 周期性向原生代理发送心跳帧，防止 Chrome MV3 Service Worker 闲置冻结
 */
export class HeartbeatManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly port: chrome.runtime.Port;
  private readonly intervalMs: number;

  constructor(port: chrome.runtime.Port, intervalMs = 25000) {
    this.port = port;
    this.intervalMs = intervalMs;
  }

  /**
   * 启动心跳定时器
   */
  public start(): void {
    this.stop();
    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  /**
   * 触发单次心跳 PING
   */
  public tick(): void {
    try {
      this.port.postMessage({
        action: 'PING',
        ts: Date.now(),
      });
    } catch (e) {
      console.warn('[MantraKey Heartbeat] 发送心跳帧失败:', e);
    }
  }

  /**
   * 停止心跳定时器
   */
  public stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
