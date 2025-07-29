/// <reference lib="deno.ns" />

import { assertEquals, assertThrows } from "@std/assert";

/**
 * Test utilities and helpers
 */

/**
 * Create a mock fetch function with predefined responses
 */
export function createMockFetch(responses: Map<string, Response>) {
  return (input: string | Request | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const response = responses.get(url);
    
    if (!response) {
      return Promise.reject(new Error(`No mock response for URL: ${url}`));
    }
    
    return Promise.resolve(response.clone());
  };
}

/**
 * Create a mock Response object
 */
export function createMockResponse(
  body: unknown,
  init: ResponseInit = {}
): Response {
  const jsonBody = typeof body === "string" ? body : JSON.stringify(body);
  
  return new Response(jsonBody, {
    status: 200,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(
        Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
      ),
    },
    ...init,
  });
}

/**
 * Assert that an async function throws with a specific error message
 */
export async function assertAsyncThrows(
  fn: () => Promise<unknown>,
  errorClass?: new (...args: unknown[]) => Error,
  msgIncludes?: string
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected function to throw");
  } catch (error) {
    if (errorClass && !(error instanceof errorClass)) {
      throw new Error(`Expected ${errorClass.name} but got ${(error as any).constructor.name}`);
    }
    if (msgIncludes && error instanceof Error && !error.message.includes(msgIncludes)) {
      throw new Error(`Expected error message to include "${msgIncludes}" but got "${error.message}"`);
    }
  }
}

/**
 * Create a spy function that tracks calls
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(
  fn?: T
): T & { calls: unknown[][]; callCount: number; reset: () => void } {
  const calls: unknown[][] = [];
  
  const spy = ((...args: unknown[]) => {
    calls.push(args);
    return fn?.(...args);
  }) as T & { calls: unknown[][]; callCount: number; reset: () => void };
  
  Object.defineProperty(spy, "calls", {
    get: () => calls,
  });
  
  Object.defineProperty(spy, "callCount", {
    get: () => calls.length,
  });
  
  spy.reset = () => {
    calls.length = 0;
  };
  
  return spy;
}

/**
 * Assert deep equality with better error messages
 */
export function assertDeepEquals<T>(actual: T, expected: T, message?: string): void {
  try {
    assertEquals(actual, expected);
  } catch (error) {
    if (message) {
      throw new Error(`${message}\n${(error as Error).message}`);
    }
    throw error;
  }
}

/**
 * Create a fake timer for testing time-based operations
 */
export class FakeTime {
  private currentTime: number;
  private timers: Map<number, { callback: () => void; time: number }> = new Map();
  private nextTimerId = 1;
  private originalSetTimeout: typeof globalThis.setTimeout;
  private originalClearTimeout: typeof globalThis.clearTimeout;
  private originalDateNow: typeof Date.now;

  constructor(startTime = 0) {
    this.currentTime = startTime;
    this.originalSetTimeout = globalThis.setTimeout;
    this.originalClearTimeout = globalThis.clearTimeout;
    this.originalDateNow = Date.now;
  }

  install(): void {
    // @ts-ignore - Overriding global functions for testing
    globalThis.setTimeout = (callback: () => void, delay = 0) => {
      const id = this.nextTimerId++;
      this.timers.set(id, { callback, time: this.currentTime + delay });
      return id as unknown as number;
    };

    // @ts-ignore - Overriding global functions for testing
    globalThis.clearTimeout = (id: number) => {
      this.timers.delete(id);
    };

    Date.now = () => this.currentTime;
  }

  uninstall(): void {
    globalThis.setTimeout = this.originalSetTimeout;
    globalThis.clearTimeout = this.originalClearTimeout;
    Date.now = this.originalDateNow;
  }

  advance(ms: number): void {
    const targetTime = this.currentTime + ms;
    
    while (this.currentTime < targetTime) {
      const nextTimer = Array.from(this.timers.entries())
        .filter(([_, timer]) => timer.time <= targetTime)
        .sort((a, b) => a[1].time - b[1].time)[0];
      
      if (!nextTimer) {
        this.currentTime = targetTime;
        break;
      }
      
      const [id, timer] = nextTimer;
      this.currentTime = timer.time;
      this.timers.delete(id);
      timer.callback();
    }
  }

  reset(): void {
    this.currentTime = 0;
    this.timers.clear();
  }
}

/**
 * Wait for all promises to settle
 */
export function waitForPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Test data builder base class
 */
export class TestDataBuilder<T> {
  protected data: Partial<T> = {};

  with<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  build(): T {
    return { ...this.getDefaults(), ...this.data } as T;
  }

  protected getDefaults(): Partial<T> {
    return {};
  }
}