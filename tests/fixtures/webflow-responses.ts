/**
 * Webflow API response fixtures
 */

export const COLLECTION_RESPONSE = {
  id: "64f8a1b2c3d4e5f6a7b8c9d0",
  displayName: "Blog Posts",
  singularName: "Blog Post",
  slug: "blog-posts",
  createdOn: "2024-01-01T00:00:00Z",
  lastUpdated: "2024-01-01T00:00:00Z",
  fields: [
    { id: "name", slug: "name", displayName: "Name", type: "PlainText", required: true },
    { id: "slug", slug: "slug", displayName: "Slug", type: "PlainText", required: true },
    { id: "author-name", slug: "author-name", displayName: "Author Name", type: "PlainText", required: true },
    { id: "post", slug: "post", displayName: "Post", type: "RichText", required: true },
    { id: "meta-description", slug: "meta-description", displayName: "Meta Description", type: "PlainText", required: false },
    { id: "reading-time", slug: "reading-time", displayName: "Reading Time", type: "PlainText", required: false },
    { id: "intro-text", slug: "intro-text", displayName: "Intro Text", type: "PlainText", required: false },
  ]
};

export const CREATE_ITEM_SUCCESS_RESPONSE = {
  id: "64f8a1b2c3d4e5f6a7b8c9d1",
  cmsLocaleId: "64f8a1b2c3d4e5f6a7b8c9d2",
  lastPublished: null,
  lastUpdated: "2024-01-01T12:00:00Z",
  createdOn: "2024-01-01T12:00:00Z",
  isArchived: false,
  isDraft: true,
  fieldData: {
    name: "Test Article",
    slug: "test-article",
    "author-name": "John Doe",
    post: "<p>Test content</p>",
    "meta-description": "Test description",
    "reading-time": "1 min read",
    "intro-text": "Test content preview"
  }
};

export const PUBLISH_ITEM_SUCCESS_RESPONSE = {
  ...CREATE_ITEM_SUCCESS_RESPONSE,
  isDraft: false,
  lastPublished: "2024-01-01T12:00:01Z"
};

export const LIST_ITEMS_RESPONSE = {
  items: [
    {
      id: "item1",
      fieldData: { slug: "existing-slug-1", name: "Article 1" }
    },
    {
      id: "item2",
      fieldData: { slug: "existing-slug-2", name: "Article 2" }
    },
    {
      id: "item3",
      fieldData: { slug: "test-article", name: "Test Article" }
    }
  ],
  pagination: {
    limit: 100,
    offset: 0,
    total: 3
  }
};

export const WEBFLOW_ERROR_RESPONSE = {
  error: "ValidationError",
  message: "Validation Error",
  code: "VALIDATION_ERROR",
  details: [
    {
      field: "slug",
      message: "Slug must be unique"
    }
  ]
};

export const RATE_LIMIT_ERROR_RESPONSE = {
  error: "RateLimitError",
  message: "Rate limit exceeded",
  code: "RATE_LIMIT_ERROR"
};

export const AUTH_ERROR_RESPONSE = {
  error: "UnauthorizedError",
  message: "Invalid API token",
  code: "UNAUTHORIZED"
};

export const NOT_FOUND_ERROR_RESPONSE = {
  error: "NotFoundError",
  message: "Collection not found",
  code: "NOT_FOUND"
};

export const SERVER_ERROR_RESPONSE = {
  error: "InternalServerError",
  message: "An unexpected error occurred",
  code: "INTERNAL_SERVER_ERROR"
};