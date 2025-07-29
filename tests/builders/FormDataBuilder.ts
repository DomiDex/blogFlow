/// <reference lib="deno.ns" />

import type { FormData } from "@/types/form.ts";
import type { QuillDelta } from "@utils/validation.ts";
import { ContentGenerator } from "../generators/content.ts";

/**
 * Builder pattern for creating FormData test objects
 * Provides fluent API for constructing test data with sensible defaults
 */
export class FormDataBuilder {
  private data: Partial<FormData> = {
    publishNow: false, // sensible default
  };

  /**
   * Set the author name
   * @param name - Author name or generates a random one if not provided
   */
  withAuthor(name?: string): this {
    this.data.authorName = name || this.generateAuthorName();
    return this;
  }

  /**
   * Set the article title
   * @param title - Article title or generates a random one if not provided
   */
  withTitle(title?: string): this {
    this.data.articleTitle = title || this.generateTitle();
    return this;
  }

  /**
   * Set the article content
   * @param content - Quill Delta content or generates default content if not provided
   */
  withContent(content?: QuillDelta): this {
    this.data.articleContent = content || this.generateContent();
    return this;
  }

  /**
   * Set the meta description
   * @param desc - Meta description or generates a random one if not provided
   */
  withMetaDescription(desc?: string): this {
    this.data.metaDescription = desc || this.generateMetaDescription();
    return this;
  }

  /**
   * Mark the article to be published immediately
   */
  published(): this {
    this.data.publishNow = true;
    return this;
  }

  /**
   * Mark the article as draft (default behavior)
   */
  draft(): this {
    this.data.publishNow = false;
    return this;
  }

  /**
   * Build the final FormData object
   * Ensures all required fields have values
   */
  build(): FormData {
    return {
      authorName: this.data.authorName || this.generateAuthorName(),
      articleTitle: this.data.articleTitle || this.generateTitle(),
      metaDescription: this.data.metaDescription || this.generateMetaDescription(),
      articleContent: this.data.articleContent || this.generateContent(),
      publishNow: this.data.publishNow ?? false,
    };
  }

  /**
   * Create a minimal valid FormData object
   */
  static minimal(): FormData {
    return new FormDataBuilder().build();
  }

  /**
   * Create a complete FormData object with rich content
   */
  static complete(): FormData {
    return new FormDataBuilder()
      .withContent(ContentGenerator.quillDelta({
        paragraphs: 5,
        includeFormatting: true,
        includeLists: true,
      }))
      .published()
      .build();
  }

  // Private helper methods for generating realistic test data
  private generateAuthorName(): string {
    const firstNames = ["John", "Jane", "Alex", "Sarah", "Michael", "Emma", "David", "Lisa"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${first} ${last}`;
  }

  private generateTitle(): string {
    const templates = [
      "Getting Started with {topic}",
      "The Ultimate Guide to {topic}",
      "Understanding {topic} in 2024",
      "10 Best Practices for {topic}",
      "How to Master {topic}",
      "A Deep Dive into {topic}",
      "{topic}: Everything You Need to Know",
      "Why {topic} Matters for Modern Development",
    ];
    const topics = ["Deno", "TypeScript", "Web Development", "API Design", "Testing", "Performance", "Security", "DevOps"];
    
    const template = templates[Math.floor(Math.random() * templates.length)];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    return template.replace("{topic}", topic);
  }

  private generateMetaDescription(): string {
    const descriptions = [
      "Learn the fundamentals and best practices in this comprehensive guide that covers everything you need to know",
      "Discover expert tips, tricks, and strategies to help you succeed with modern development practices",
      "A detailed exploration of concepts, techniques, and real-world applications for developers",
      "Master the essential skills and knowledge needed to excel in today's technology landscape",
      "Comprehensive coverage of important topics with practical examples and actionable insights",
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private generateContent(): QuillDelta {
    return ContentGenerator.quillDelta({ paragraphs: 3 });
  }
}