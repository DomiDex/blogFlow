/// <reference lib="deno.ns" />
import { stub } from "@std/testing/mock";
import type { WebflowService } from "@services/webflowService.ts";
import * as fixtures from "../fixtures/webflow-responses.ts";

export interface MockWebflowService extends WebflowService {
  setNextResponse(method: keyof WebflowService, response: any): void;
  setNextError(method: keyof WebflowService, error: Error): void;
  resetMocks(): void;
}

/**
 * Creates a mock WebflowService for testing
 */
export function createMockWebflowService(): MockWebflowService {
  const responses = new Map<string, any>();
  const errors = new Map<string, Error>();

  const mockService: MockWebflowService = {
    // Mock implementations
    async createItem(collectionId: string, data: any) {
      if (errors.has("createItem")) {
        throw errors.get("createItem");
      }
      return responses.get("createItem") || fixtures.CREATE_ITEM_SUCCESS_RESPONSE;
    },

    async publishItem(collectionId: string, itemId: string) {
      if (errors.has("publishItem")) {
        throw errors.get("publishItem");
      }
      return responses.get("publishItem") || fixtures.PUBLISH_ITEM_SUCCESS_RESPONSE;
    },

    async getCollectionItems(collectionId: string, options?: any) {
      if (errors.has("getCollectionItems")) {
        throw errors.get("getCollectionItems");
      }
      return responses.get("getCollectionItems") || {
        items: [],
        pagination: { limit: 100, offset: 0, total: 0 },
      };
    },

    async getItem(collectionId: string, itemId: string) {
      if (errors.has("getItem")) {
        throw errors.get("getItem");
      }
      return responses.get("getItem") || fixtures.GET_ITEM_SUCCESS_RESPONSE;
    },

    async updateItem(collectionId: string, itemId: string, data: any) {
      if (errors.has("updateItem")) {
        throw errors.get("updateItem");
      }
      return responses.get("updateItem") || {
        ...fixtures.GET_ITEM_SUCCESS_RESPONSE,
        fieldData: { ...fixtures.GET_ITEM_SUCCESS_RESPONSE.fieldData, ...data },
      };
    },

    async deleteItem(collectionId: string, itemId: string) {
      if (errors.has("deleteItem")) {
        throw errors.get("deleteItem");
      }
      return responses.get("deleteItem") || { deleted: true };
    },

    // Test helper methods
    setNextResponse(method: keyof WebflowService, response: any) {
      responses.set(method, response);
    },

    setNextError(method: keyof WebflowService, error: Error) {
      errors.set(method, error);
    },

    resetMocks() {
      responses.clear();
      errors.clear();
    },
  };

  return mockService;
}

/**
 * Creates a spy WebflowService that tracks calls
 */
export function createSpyWebflowService(realService: WebflowService) {
  const calls = new Map<string, any[]>();

  const spyService = {
    ...realService,
    getCalls(method: keyof WebflowService) {
      return calls.get(method) || [];
    },
    resetCalls() {
      calls.clear();
    },
  };

  // Wrap each method to track calls
  for (const method of Object.keys(realService) as (keyof WebflowService)[]) {
    const original = realService[method];
    if (typeof original === "function") {
      (spyService as any)[method] = async (...args: any[]) => {
        if (!calls.has(method)) {
          calls.set(method, []);
        }
        calls.get(method)!.push(args);
        return original.apply(realService, args);
      };
    }
  }

  return spyService;
}
