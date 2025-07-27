/// <reference lib="deno.ns" />
import { Hono } from "@hono/hono";
import { logger } from "@utils/logger.ts";
import type { Variables } from "@app-types";
import { 
  createFormValidation,
  draftFormValidation,
  updateFormValidation,
  getValidatedData,
  validateContentLength,
  validationRateLimit
} from "@middleware/validation.ts";
import type { FormData, DraftFormData, UpdateFormData } from "@utils/validation.ts";

export const webflowRoutes = new Hono<{ Variables: Variables }>();

// Main form submission endpoint with comprehensive validation
webflowRoutes.post(
  "/webflow-form",
  validationRateLimit(),
  createFormValidation,
  validateContentLength({ minWords: 50, maxWords: 5000 }),
  (c) => {
    const requestId = c.get("requestId") as string;
    const validatedData = getValidatedData<FormData>(c);
    
    logger.info("Processing validated form submission", {
      requestId,
      authorName: validatedData.authorName,
      articleTitle: validatedData.articleTitle.substring(0, 50) + "...",
      contentWords: extractWordCount(validatedData.articleContent),
      publishNow: validatedData.publishNow,
    });

    // TODO: Next tasks will implement:
    // - Quill Delta to HTML conversion (Task 17)
    // - HTML sanitization (Task 18) 
    // - Metadata generation (Task 19)
    // - Field mapping to Webflow CMS (Task 20)
    // - Webflow CMS item creation

    // Placeholder response with validated data structure
    return c.json({
      success: true,
      message: "Form submission validated successfully",
      data: {
        authorName: validatedData.authorName,
        articleTitle: validatedData.articleTitle,
        metaDescription: validatedData.metaDescription,
        contentPreview: extractTextPreview(validatedData.articleContent, 100),
        wordCount: extractWordCount(validatedData.articleContent),
        publishNow: validatedData.publishNow,
        slug: validatedData.slug,
        categories: validatedData.categories?.length || 0,
        tags: validatedData.tags?.length || 0,
      },
      processing: {
        timestamp: new Date().toISOString(),
        requestId,
        validationPassed: true,
        nextSteps: [
          "Convert Quill Delta to HTML",
          "Sanitize HTML content",
          "Generate metadata (reading time, intro text)",
          "Map fields to Webflow CMS structure",
          "Create Webflow CMS item",
          "Publish item (if requested)"
        ]
      }
    });
  }
);

// Draft saving endpoint (more lenient validation)
webflowRoutes.post(
  "/webflow-form/draft",
  validationRateLimit(),
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
        fieldsPresent: Object.keys(validatedData).filter(key => 
          validatedData[key as keyof DraftFormData] !== undefined
        ),
        wordCount: validatedData.articleContent ? 
          extractWordCount(validatedData.articleContent) : 0,
      },
      processing: {
        timestamp: new Date().toISOString(),
        requestId,
        type: "draft",
      }
    });
  }
);

// Update existing item endpoint
webflowRoutes.put(
  "/webflow-form/:itemId",
  validationRateLimit(),
  updateFormValidation,
  validateContentLength({ minWords: 50, maxWords: 5000 }),
  (c) => {
    const requestId = c.get("requestId") as string;
    const itemId = c.req.param("itemId");
    const validatedData = getValidatedData<UpdateFormData>(c);
    
    logger.info("Processing form update", {
      requestId,
      itemId,
      updatedFields: Object.keys(validatedData).filter(key => 
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
      }
    });
  }
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
function extractTextPreview(delta: { ops?: Array<{ insert?: unknown }> }, maxLength: number = 100): string {
  if (!delta.ops) return "";
  
  const text = delta.ops
    .map(op => typeof op.insert === 'string' ? op.insert : '')
    .join('')
    .trim();
  
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

function extractWordCount(delta: { ops?: Array<{ insert?: unknown }> }): number {
  if (!delta.ops) return 0;
  
  const text = delta.ops
    .map(op => typeof op.insert === 'string' ? op.insert : '')
    .join('')
    .trim();
  
  return text.split(/\s+/).filter(word => word.length > 0).length;
}
