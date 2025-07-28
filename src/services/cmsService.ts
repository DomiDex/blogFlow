/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";
import { createWebflowService, type WebflowService } from "@services/webflowService.ts";
import { SlugService } from "@services/slugService.ts";
import { convertDeltaToHtml } from "@services/contentProcessor.ts";
import { generateMetadata } from "@services/metadataGenerator.ts";
import type { WebflowCollectionItem, WebflowFieldData } from "../types/webflow.ts";
import type { FormData } from "../types/form.ts";

export interface CMSItemResult {
  success: boolean;
  item?: WebflowCollectionItem;
  error?: string;
  slug?: string;
}

export interface PublishResult {
  success: boolean;
  itemId: string;
  error?: string;
}

export class CMSService {
  private webflowService: WebflowService;
  private slugService: SlugService;

  constructor(webflowService?: WebflowService) {
    this.webflowService = webflowService || createWebflowService();
    this.slugService = new SlugService(this.webflowService);
  }

  /**
   * Create a new CMS item from form data
   */
  async createCMSItem(formData: FormData, isDraft = true): Promise<CMSItemResult> {
    try {
      logger.info("Creating CMS item", {
        title: formData.articleTitle,
        author: formData.authorName,
        isDraft,
      });

      // Map form data to Webflow field structure
      const fieldData = await this.mapFormDataToWebflowFields(formData);

      // Create the item
      const item = await this.webflowService.createCollectionItem({
        isDraft,
        isArchived: false,
        fieldData,
      });

      logger.info("CMS item created successfully", {
        itemId: item.id,
        slug: fieldData.slug,
        title: fieldData.name,
      });

      return {
        success: true,
        item,
        slug: fieldData.slug,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Failed to create CMS item", {
        title: formData.articleTitle,
        error: new Error(errorMessage),
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create and immediately publish a CMS item
   */
  async createAndPublishCMSItem(formData: FormData): Promise<CMSItemResult> {
    try {
      // First create as draft
      const createResult = await this.createCMSItem(formData, true);
      
      if (!createResult.success || !createResult.item) {
        return createResult;
      }

      // Then publish it
      const publishResult = await this.publishCMSItem(createResult.item.id);
      
      if (!publishResult.success) {
        logger.warn("Item created but publishing failed", {
          itemId: createResult.item.id,
          publishError: publishResult.error,
        });
        
        return {
          success: false,
          item: createResult.item,
          error: `Item created but publishing failed: ${publishResult.error}`,
        };
      }

      logger.info("CMS item created and published successfully", {
        itemId: createResult.item.id,
        slug: createResult.slug,
      });

      return {
        success: true,
        item: createResult.item,
        slug: createResult.slug,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Failed to create and publish CMS item", {
        title: formData.articleTitle,
        error: new Error(errorMessage),
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Publish an existing CMS item
   */
  async publishCMSItem(itemId: string): Promise<PublishResult> {
    try {
      logger.info("Publishing CMS item", { itemId });

      await this.webflowService.publishItem(itemId);

      logger.info("CMS item published successfully", { itemId });

      return {
        success: true,
        itemId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Failed to publish CMS item", {
        itemId,
        error: new Error(errorMessage),
      });

      return {
        success: false,
        itemId,
        error: errorMessage,
      };
    }
  }

  /**
   * Update an existing CMS item
   */
  async updateCMSItem(itemId: string, formData: FormData): Promise<CMSItemResult> {
    try {
      logger.info("Updating CMS item", {
        itemId,
        title: formData.articleTitle,
      });

      // Map form data to Webflow field structure
      const fieldData = await this.mapFormDataToWebflowFields(formData);

      // Add update timestamp
      fieldData["updated-on"] = new Date().toISOString();

      // Update the item
      const item = await this.webflowService.updateCollectionItem(itemId, {
        fieldData,
      });

      logger.info("CMS item updated successfully", {
        itemId,
        slug: fieldData.slug,
        title: fieldData.name,
      });

      return {
        success: true,
        item,
        slug: fieldData.slug,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error("Failed to update CMS item", {
        itemId,
        title: formData.articleTitle,
        error: new Error(errorMessage),
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a slug exists in the collection
   */
  async checkSlugAvailability(slug: string): Promise<{ available: boolean; itemId?: string }> {
    try {
      const result = await this.webflowService.checkSlugExists(slug);
      
      return {
        available: !result.exists,
        itemId: result.itemId,
      };
    } catch (error) {
      logger.error("Failed to check slug availability", {
        slug,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      
      // On error, assume slug is not available to be safe
      return { available: false };
    }
  }

  /**
   * Get all CMS items with pagination
   */
  async getCMSItems(limit = 10, offset?: string) {
    try {
      const response = await this.webflowService.getCollectionItems({
        limit,
        offset,
        sort: ["-created-on"], // Sort by creation date, newest first
      });

      logger.debug("Retrieved CMS items", {
        count: response.items?.length || 0,
        total: response.pagination?.total || 0,
      });

      return response;
    } catch (error) {
      logger.error("Failed to retrieve CMS items", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Get a specific CMS item by ID
   */
  async getCMSItem(itemId: string): Promise<WebflowCollectionItem> {
    try {
      const item = await this.webflowService.getCollectionItem(itemId);
      
      logger.debug("Retrieved CMS item", {
        itemId,
        title: item.fieldData.name,
      });

      return item;
    } catch (error) {
      logger.error("Failed to retrieve CMS item", {
        itemId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Map form data to Webflow field structure
   */
  private async mapFormDataToWebflowFields(formData: FormData): Promise<Partial<WebflowFieldData>> {

    // Convert Quill Delta to HTML
    const conversionResult = await convertDeltaToHtml(formData.articleContent);
    if (conversionResult.errors.length > 0) {
      throw new Error(`Failed to convert content: ${conversionResult.errors.join(", ")}`);
    }
    const htmlContent = conversionResult.html;

    // Generate metadata
    const metadata = generateMetadata({
      title: formData.articleTitle,
      htmlContent,
      publishNow: formData.publishNow,
      customSlug: formData.slug,
    });

    // Generate unique slug
    let slug = metadata.slug;
    if (formData.slug) {
      // Validate provided slug
      const validation = await this.slugService.validateSlug(formData.slug);
      if (!validation.isValid || !validation.isUnique) {
        throw new Error(`Invalid slug "${formData.slug}": ${validation.errors?.join(", ")}`);
      }
      slug = formData.slug;
    } else {
      // Use generated slug and ensure uniqueness
      const slugResult = await this.slugService.generateUniqueSlug(formData.articleTitle);
      if (slugResult.isValid && slugResult.isUnique) {
        slug = slugResult.finalSlug!;
      } else {
        throw new Error(`Failed to generate valid slug: ${slugResult.errors?.join(", ")}`);
      }
    }

    return {
      // Core fields from form
      name: formData.articleTitle,
      slug,
      "author-name": formData.authorName,
      "meta-description": formData.metaDescription,
      post: htmlContent, // HTML content converted from Quill Delta

      // Auto-generated metadata
      "reading-time": metadata.readingTime,
      "intro-text": metadata.introText,

      // Timestamps
      "created-on": metadata.createdOn,
      "updated-on": metadata.updatedOn,
      "published-on": formData.publishNow ? metadata.publishedOn : undefined,
    };
  }


  /**
   * Test CMS operations
   */
  async testCMSOperations(): Promise<boolean> {
    try {
      // Test connection
      const isConnected = await this.webflowService.testConnection();
      if (!isConnected) {
        return false;
      }

      // Test retrieving items
      await this.getCMSItems(1);

      logger.info("CMS operations test passed");
      return true;
    } catch (error) {
      logger.error("CMS operations test failed", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }
}