// Webflow API v2 Types
export interface WebflowCollection {
  id: string;
  displayName: string;
  slug: string;
  createdOn: string;
  lastUpdated: string;
}

export interface WebflowCollectionItem {
  id: string;
  cmsLocaleId: string;
  lastPublished?: string;
  lastUpdated: string;
  createdOn: string;
  isArchived: boolean;
  isDraft: boolean;
  fieldData: WebflowFieldData;
}

export interface WebflowFieldData {
  name: string;
  slug: string;
  "author-name": string;
  "meta-description": string;
  post: string;
  "reading-time"?: string; // Webflow expects string values
  "intro-text"?: string;
  "created-on"?: string;
  "updated-on"?: string;
  "published-on"?: string;
  [key: string]: unknown;
}

export interface WebflowCreateItemRequest {
  isArchived?: boolean;
  isDraft?: boolean;
  fieldData: Partial<WebflowFieldData>;
}

export interface WebflowListResponse<T> {
  items: T[];
  pagination: {
    limit: number;
    offset: string;
    total: number;
  };
}

export interface WebflowSite {
  id: string;
  displayName: string;
  shortName: string;
  slug: string;
  createdOn: string;
  lastUpdated: string;
  publishedOn?: string;
  timezone: string;
  locales: WebflowLocale[];
}

export interface WebflowLocale {
  id: string;
  cmsLocaleId: string;
  code: string;
  displayName: string;
  isPrimary: boolean;
  isEnabled: boolean;
}

export interface WebflowApiError {
  message: string;
  code: string;
  externalReference?: string;
  details?: unknown[];
  msg?: string;
  errors?: string[] | string;
}
