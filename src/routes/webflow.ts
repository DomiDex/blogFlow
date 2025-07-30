/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { logger } from "@utils/logger.ts";
import type { Variables } from "@app-types";
import {
  createFormValidation,
  draftFormValidation,
  getValidatedData,
  updateFormValidation,
  validateContentLength,
  validationRateLimit,
} from "@middleware/validation.ts";
import type { DraftFormData, FormData, UpdateFormData } from "@utils/validation.ts";
import { CMSService } from "@services/cmsService.ts";
import { parseFormData } from "@middleware/formParser.ts";

export const webflowRoutes = new Hono<{ Variables: Variables }>();

// Initialize CMS service
const cmsService = new CMSService();

// Main form submission endpoint with comprehensive validation
webflowRoutes.post(
  "/webflow-form",
  validationRateLimit(),
  parseFormData, // Parse form data before validation
  createFormValidation,
  validateContentLength({ minWords: 20, maxWords: 10000 }), // Reduced for medical professionals
  async (c) => {
    const requestId = c.get("requestId") as string;
    const validatedData = getValidatedData<FormData>(c);

    logger.info("Processing validated form submission", {
      requestId,
      authorName: validatedData.authorName,
      articleTitle: validatedData.articleTitle.substring(0, 50) + "...",
      contentWords: extractWordCount(validatedData.articleContent),
      publishNow: validatedData.publishNow,
    });

    try {
      // Create CMS item (as draft by default, unless publishNow is true)
      const result = await cmsService.createCMSItem(
        validatedData,
        !validatedData.publishNow, // isDraft
      );

      if (!result.success) {
        logger.error("Failed to create CMS item", {
          requestId,
          error: result.error ? new Error(result.error) : undefined,
        });
        return c.json({
          success: false,
          message: "Failed to create CMS item",
          error: result.error,
        }, 500);
      }

      // If publishNow is true, publish the item
      if (validatedData.publishNow && result.item) {
        const publishResult = await cmsService.publishCMSItem(result.item.id);
        if (!publishResult.success) {
          logger.warn("Item created but publishing failed", {
            requestId,
            itemId: result.item.id,
            error: publishResult.error ? new Error(publishResult.error) : undefined,
          });
        }
      }

      logger.info("CMS item created successfully", {
        requestId,
        itemId: result.item?.id,
        slug: result.slug,
        published: validatedData.publishNow,
      });

      return c.json({
        success: true,
        message: "Article created successfully",
        data: {
          itemId: result.item?.id,
          slug: result.slug,
          authorName: validatedData.authorName,
          articleTitle: validatedData.articleTitle,
          metaDescription: validatedData.metaDescription,
          contentPreview: extractTextPreview(validatedData.articleContent, 100),
          wordCount: extractWordCount(validatedData.articleContent),
          published: validatedData.publishNow,
          categories: validatedData.categories?.length || 0,
          tags: validatedData.tags?.length || 0,
        },
        item: result.item,
        processing: {
          timestamp: new Date().toISOString(),
          requestId,
          status: "completed",
        },
      });
    } catch (error) {
      logger.error("Unexpected error in form submission", {
        requestId,
        error: error instanceof Error ? error : new Error("Unknown error"),
      });
      return c.json({
        success: false,
        message: "An unexpected error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  },
);

// Draft saving endpoint (more lenient validation)
webflowRoutes.post(
  "/webflow-form/draft",
  validationRateLimit(),
  parseFormData, // Parse form data before validation
  draftFormValidation,
  (c) => {
    const requestId = c.get("requestId") as string;
    const validatedData = getValidatedData<DraftFormData>(c);

    logger.info("Processing draft save", {
      requestId,
      hasTitle: !!validatedData.articleTitle,
      hasContent: !!validatedData.articleContent,
      hasAuthor: !!validatedData.authorName,
    });

    return c.json({
      success: true,
      message: "Draft saved successfully",
      data: {
        fieldsPresent: Object.keys(validatedData).filter((key) =>
          validatedData[key as keyof DraftFormData] !== undefined
        ),
        wordCount: validatedData.articleContent
          ? extractWordCount(validatedData.articleContent)
          : 0,
      },
      processing: {
        timestamp: new Date().toISOString(),
        requestId,
        type: "draft",
      },
    });
  },
);

// Update existing item endpoint
webflowRoutes.put(
  "/webflow-form/:itemId",
  validationRateLimit(),
  parseFormData, // Parse form data before validation
  updateFormValidation,
  validateContentLength({ minWords: 20, maxWords: 10000 }), // Reduced for medical professionals
  (c) => {
    const requestId = c.get("requestId") as string;
    const itemId = c.req.param("itemId");
    const validatedData = getValidatedData<UpdateFormData>(c);

    logger.info("Processing form update", {
      requestId,
      itemId,
      updatedFields: Object.keys(validatedData).filter((key) =>
        validatedData[key as keyof UpdateFormData] !== undefined
      ),
    });

    return c.json({
      success: true,
      message: "Form update validated successfully",
      data: {
        itemId,
        updatedFields: Object.keys(validatedData).length,
        contentWords: extractWordCount(validatedData.articleContent),
      },
      processing: {
        timestamp: new Date().toISOString(),
        requestId,
        type: "update",
      },
    });
  },
);

// Options endpoint for CORS preflight
webflowRoutes.options("/webflow-form", (_c) => {
  // CORS headers are handled by middleware
  return new Response(null, { status: 204 });
});

webflowRoutes.options("/webflow-form/draft", (_c) => {
  return new Response(null, { status: 204 });
});

webflowRoutes.options("/webflow-form/:itemId", (_c) => {
  return new Response(null, { status: 204 });
});

// Helper functions for content processing
function extractTextPreview(
  delta: { ops?: Array<{ insert?: unknown }> },
  maxLength: number = 100,
): string {
  if (!delta.ops) return "";

  const text = delta.ops
    .map((op) => typeof op.insert === "string" ? op.insert : "")
    .join("")
    .trim();

  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function extractWordCount(delta: { ops?: Array<{ insert?: unknown }> }): number {
  if (!delta.ops) return 0;

  const text = delta.ops
    .map((op) => typeof op.insert === "string" ? op.insert : "")
    .join("")
    .trim();

  return text.split(/\s+/).filter((word) => word.length > 0).length;
}
