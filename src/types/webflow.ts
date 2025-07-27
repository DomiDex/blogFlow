// Webflow API types - will be populated in later tasks

export interface WebflowCollection {
  id: string;
  displayName: string;
  slug: string;
  createdOn: string;
  lastUpdated: string;
}

export interface WebflowItem {
  id: string;
  cmsLocaleId: string;
  lastPublished: string;
  lastUpdated: string;
  createdOn: string;
  isArchived: boolean;
  isDraft: boolean;
  fieldData: Record<string, unknown>;
}

export interface WebflowApiError {
  message: string;
  code: string;
  externalReference?: string;
  details?: unknown[];
}
