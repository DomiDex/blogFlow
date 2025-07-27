/// <reference lib="deno.ns" />
import { logger } from "../utils/logger.ts";
import type { WebflowService } from "./webflowService.ts";

export interface SlugGenerationOptions {
  maxLength?: number;
  preserveCase?: boolean;
  allowNumbers?: boolean;
  separator?: string;
  maxAttempts?: number;
}

export interface SlugValidationResult {
  isValid: boolean;
  isUnique: boolean;
  suggestions?: string[];
  errors?: string[];
  finalSlug?: string;
}

export interface SlugCacheEntry {
  slug: string;
  exists: boolean;
  timestamp: number;
  itemId?: string;
}

export class SlugService {
  private webflowService: WebflowService;
  private slugCache = new Map<string, SlugCacheEntry>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly maxCacheSize = 1000;

  // Reserved slugs that cannot be used
  private readonly reservedSlugs = new Set([
    'admin', 'api', 'app', 'blog', 'cms', 'dashboard',
    'docs', 'help', 'home', 'login', 'logout', 'profile',
    'privacy', 'terms', 'about', 'contact', 'support',
    'search', 'sitemap', 'robots', 'favicon', 'assets',
    'static', 'public', 'www', 'mail', 'email', 'news',
    'events', 'gallery', 'portfolio', 'services', 'products',
    'shop', 'store', 'cart', 'checkout', 'payment', 'order',
    'account', 'settings', 'config', 'test', 'staging',
    'dev', 'development', 'prod', 'production', 'preview'
  ]);

  constructor(webflowService: WebflowService) {
    this.webflowService = webflowService;
    
    // Clean up cache periodically
    setInterval(() => this.cleanupCache(), this.cacheTimeout);
  }

  /**
   * Generate a unique, SEO-friendly slug from a title
   */
  async generateUniqueSlug(
    title: string, 
    options: SlugGenerationOptions = {}
  ): Promise<SlugValidationResult> {
    const opts = {
      maxLength: 100,
      preserveCase: false,
      allowNumbers: true,
      separator: '-',
      maxAttempts: 10,
      ...options,
    };

    try {
      // Generate base slug
      const baseSlug = this.generateBaseSlug(title, opts);
      
      logger.debug("Generating unique slug", {
        title,
        baseSlug,
        options: opts,
      });

      // Validate the base slug format
      const validationResult = this.validateSlugFormat(baseSlug);
      if (!validationResult.isValid) {
        return validationResult;
      }

      // Check uniqueness and generate alternatives if needed
      const uniqueResult = await this.ensureUniqueness(baseSlug, opts);
      
      logger.info("Slug generation completed", {
        title,
        originalSlug: baseSlug,
        finalSlug: uniqueResult.finalSlug,
        attempts: uniqueResult.attempts || 1,
      });

      return uniqueResult;
    } catch (error) {
      logger.error("Failed to generate unique slug", {
        title,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        isValid: false,
        isUnique: false,
        errors: [`Failed to generate slug: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  /**
   * Validate an existing slug for format and uniqueness
   */
  async validateSlug(slug: string): Promise<SlugValidationResult> {
    try {
      logger.debug("Validating slug", { slug });

      // Check format first
      const formatResult = this.validateSlugFormat(slug);
      if (!formatResult.isValid) {
        return formatResult;
      }

      // Check uniqueness
      const isUnique = await this.checkSlugUniqueness(slug);
      
      const result: SlugValidationResult = {
        isValid: true,
        isUnique,
        finalSlug: isUnique ? slug : undefined,
      };

      if (!isUnique) {
        result.errors = ["Slug already exists"];
        result.suggestions = this.generateSuggestions(slug);
      }

      logger.debug("Slug validation completed", {
        slug,
        isValid: result.isValid,
        isUnique: result.isUnique,
      });

      return result;
    } catch (error) {
      logger.error("Failed to validate slug", {
        slug,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        isValid: false,
        isUnique: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  /**
   * Generate base slug from title
   */
  private generateBaseSlug(title: string, options: SlugGenerationOptions): string {
    let slug = title.trim();

    // Normalize Unicode characters
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Convert to lowercase unless preserveCase is true
    if (!options.preserveCase) {
      slug = slug.toLowerCase();
    }

    // Replace spaces and special characters with separator
    slug = slug
      .replace(/[^a-z0-9\s-]/gi, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, options.separator || '-') // Replace spaces with separator
      .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen

    // Remove numbers if not allowed
    if (!options.allowNumbers) {
      slug = slug.replace(/[0-9]/g, '');
    }

    // Remove leading and trailing separators
    const separator = options.separator || '-';
    const separatorRegex = new RegExp(`^${separator}+|${separator}+$`, 'g');
    slug = slug.replace(separatorRegex, '');

    // Truncate to max length
    if (options.maxLength && slug.length > options.maxLength) {
      slug = slug.substring(0, options.maxLength);
      // Ensure we don't end with a separator after truncation
      slug = slug.replace(new RegExp(`${separator}+$`), '');
    }

    // Ensure minimum length
    if (slug.length < 1) {
      slug = 'article';
    }

    return slug;
  }

  /**
   * Validate slug format according to SEO best practices
   */
  private validateSlugFormat(slug: string): SlugValidationResult {
    const errors: string[] = [];

    // Check if slug is empty
    if (!slug || slug.trim().length === 0) {
      errors.push("Slug cannot be empty");
    }

    // Check length
    if (slug.length > 100) {
      errors.push("Slug must be 100 characters or less");
    }

    if (slug.length < 1) {
      errors.push("Slug must be at least 1 character long");
    }

    // Check for invalid characters
    if (!/^[a-z0-9-]+$/.test(slug)) {
      errors.push("Slug can only contain lowercase letters, numbers, and hyphens");
    }

    // Check for consecutive hyphens
    if (/--+/.test(slug)) {
      errors.push("Slug cannot contain consecutive hyphens");
    }

    // Check for leading/trailing hyphens
    if (slug.startsWith('-') || slug.endsWith('-')) {
      errors.push("Slug cannot start or end with a hyphen");
    }

    // Check reserved words
    if (this.reservedSlugs.has(slug)) {
      errors.push(`"${slug}" is a reserved word and cannot be used`);
    }

    // Check for common problematic patterns
    if (/^\d+$/.test(slug)) {
      errors.push("Slug cannot be only numbers");
    }

    return {
      isValid: errors.length === 0,
      isUnique: true, // Format validation doesn't check uniqueness
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Ensure slug uniqueness by checking against existing CMS items
   */
  private async ensureUniqueness(
    baseSlug: string, 
    options: SlugGenerationOptions
  ): Promise<SlugValidationResult & { attempts?: number }> {
    const maxAttempts = options.maxAttempts || 10;
    let currentSlug = baseSlug;
    let attempts = 0;

    for (let i = 0; i < maxAttempts; i++) {
      attempts++;
      const isUnique = await this.checkSlugUniqueness(currentSlug);
      
      if (isUnique) {
        return {
          isValid: true,
          isUnique: true,
          finalSlug: currentSlug,
          attempts,
        };
      }

      // Generate next variation
      if (i === 0) {
        currentSlug = `${baseSlug}-2`;
      } else {
        currentSlug = `${baseSlug}-${i + 2}`;
      }

      // Ensure the variation doesn't exceed max length
      if (options.maxLength && currentSlug.length > options.maxLength) {
        const suffix = `-${i + 2}`;
        const availableLength = options.maxLength - suffix.length;
        currentSlug = `${baseSlug.substring(0, availableLength)}${suffix}`;
      }
    }

    // If we couldn't find a unique slug after max attempts, use timestamp
    const timestamp = Date.now().toString().slice(-8);
    const timestampSlug = `${baseSlug}-${timestamp}`;
    
    // Truncate if needed
    let finalSlug = timestampSlug;
    if (options.maxLength && finalSlug.length > options.maxLength) {
      const suffix = `-${timestamp}`;
      const availableLength = options.maxLength - suffix.length;
      finalSlug = `${baseSlug.substring(0, availableLength)}${suffix}`;
    }

    logger.warn("Max slug attempts reached, using timestamp", {
      baseSlug,
      finalSlug,
      attempts: maxAttempts,
    });

    return {
      isValid: true,
      isUnique: true, // Assume timestamp makes it unique
      finalSlug,
      attempts: maxAttempts + 1,
    };
  }

  /**
   * Check if a slug is unique in the CMS
   */
  private async checkSlugUniqueness(slug: string): Promise<boolean> {
    // Check cache first
    const cached = this.getFromCache(slug);
    if (cached !== null) {
      logger.debug("Slug uniqueness check from cache", {
        slug,
        exists: cached.exists,
      });
      return !cached.exists;
    }

    try {
      // Check via Webflow API
      const result = await this.webflowService.checkSlugExists(slug);
      
      // Cache the result
      this.addToCache(slug, {
        slug,
        exists: result.exists,
        timestamp: Date.now(),
        itemId: result.itemId,
      });

      logger.debug("Slug uniqueness check from API", {
        slug,
        exists: result.exists,
        itemId: result.itemId,
      });

      return !result.exists;
    } catch (error) {
      logger.error("Failed to check slug uniqueness", {
        slug,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      
      // On error, assume slug is not unique to be safe
      return false;
    }
  }

  /**
   * Generate alternative slug suggestions
   */
  private generateSuggestions(slug: string): string[] {
    const suggestions: string[] = [];
    const baseSlug = slug.replace(/-\d+$/, ''); // Remove trailing numbers

    // Generate numbered variations
    for (let i = 2; i <= 5; i++) {
      suggestions.push(`${baseSlug}-${i}`);
    }

    // Add timestamp variation
    const timestamp = Date.now().toString().slice(-6);
    suggestions.push(`${baseSlug}-${timestamp}`);

    // Add word variations
    const commonSuffixes = ['article', 'post', 'guide', 'story'];
    for (const suffix of commonSuffixes) {
      suggestions.push(`${baseSlug}-${suffix}`);
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Cache management methods
   */
  private getFromCache(slug: string): SlugCacheEntry | null {
    const entry = this.slugCache.get(slug);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.cacheTimeout) {
      this.slugCache.delete(slug);
      return null;
    }

    return entry;
  }

  private addToCache(slug: string, entry: SlugCacheEntry): void {
    // Clean up cache if it's getting too large
    if (this.slugCache.size >= this.maxCacheSize) {
      this.cleanupCache();
    }

    this.slugCache.set(slug, entry);
  }

  private cleanupCache(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [slug, entry] of this.slugCache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.slugCache.delete(slug);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug("Slug cache cleanup completed", {
        removedEntries: removedCount,
        remainingEntries: this.slugCache.size,
      });
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.slugCache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * Clear the entire cache (useful for testing)
   */
  clearCache(): void {
    this.slugCache.clear();
    logger.debug("Slug cache cleared");
  }
}