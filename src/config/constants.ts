export const API_VERSION = "1.0.0";
export const SERVICE_NAME = "webflow-middleware";

// Webflow API
export const WEBFLOW_API_BASE_URL = "https://api.webflow.com/v2";
export const WEBFLOW_API_VERSION = "1.0.0";

// Field mappings - Form fields to CMS fields
export const CMS_FIELD_MAPPINGS = {
  // Direct mappings from form fields
  authorName: "author-name",
  articleTitle: "name",
  metaDescription: "meta-description",
  articleContent: "post",

  // Auto-generated fields
  slug: "slug",
  readingTime: "reading-time",
  introText: "intro-text",
  featuredImage: "featured-image",
  category: "category",
  tags: "tags",
  publishDate: "publish-date",
  lastUpdated: "last-updated",
  status: "status",
  featured: "featured",
  views: "views",
  likes: "likes",
} as const;

// Content processing
export const READING_SPEED_WPM = {
  text: 238, // Average reading speed
  code: 150, // Code blocks read slower
  technical: 200, // Technical content
} as const;

// Slug configuration
export const SLUG_CONFIG = {
  maxLength: 100,
  reservedSlugs: [
    "admin",
    "api",
    "app",
    "blog",
    "docs",
    "login",
    "logout",
    "register",
    "dashboard",
    "settings",
    "profile",
    "search",
    "tag",
    "category",
    "page",
    "post",
    "article",
  ],
  maxCollisionAttempts: 10,
} as const;

// Content limits and validation
export const CONTENT_LIMITS = {
  minArticleLength: 50, // Minimum characters for article content
  introTextLength: 160, // Characters for intro/excerpt
  maxTitleLength: 200, // Maximum title length
  maxMetaDescriptionLength: 300, // SEO meta description limit
  maxSlugLength: 100, // URL slug limit
} as const;

// Default values for CMS fields
export const CMS_DEFAULTS = {
  featuredImage: null,
  category: "uncategorized",
  tags: [],
  status: "draft",
  featured: false,
  views: 0,
  likes: 0,
} as const;

// HTTP status codes for Webflow API
export const WEBFLOW_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
} as const;

// API retry configuration
export const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelay: 1000, // ms
  maxDelay: 10000, // ms
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504],
} as const;

// Logging configuration
export const LOG_LEVELS = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;
