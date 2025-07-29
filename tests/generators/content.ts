/// <reference lib="deno.ns" />

import type { QuillDelta } from "@utils/validation.ts";
import type { FormData } from "@/types/form.ts";

export interface ContentGeneratorOptions {
  paragraphs?: number;
  includeFormatting?: boolean;
  includeLists?: boolean;
  includeCode?: boolean;
  includeLinks?: boolean;
  includeHeaders?: boolean;
}

/**
 * Utility class for generating test content
 */
export class ContentGenerator {
  /**
   * Generate a Quill Delta object with various formatting options
   */
  static quillDelta(options?: ContentGeneratorOptions): QuillDelta {
    const ops: any[] = [];
    const { 
      paragraphs = 3, 
      includeFormatting = false,
      includeLists = false,
      includeCode = false,
      includeLinks = false,
      includeHeaders = false,
    } = options || {};
    
    // Add header if requested
    if (includeHeaders) {
      ops.push({
        insert: this.generateSentence(),
        attributes: { header: 1 }
      });
      ops.push({ insert: "\n\n" });
    }
    
    // Generate paragraphs
    for (let i = 0; i < paragraphs; i++) {
      const paragraph = this.generateParagraph();
      
      if (includeFormatting && i === 0) {
        // Add some formatting to the first paragraph
        const words = paragraph.split(" ");
        const boldIndex = Math.floor(words.length / 3);
        const italicIndex = Math.floor(words.length * 2 / 3);
        
        ops.push({ insert: words.slice(0, boldIndex).join(" ") + " " });
        ops.push({
          insert: words.slice(boldIndex, boldIndex + 2).join(" "),
          attributes: { bold: true }
        });
        ops.push({ insert: " " + words.slice(boldIndex + 2, italicIndex).join(" ") + " " });
        ops.push({
          insert: words.slice(italicIndex, italicIndex + 2).join(" "),
          attributes: { italic: true }
        });
        ops.push({ insert: " " + words.slice(italicIndex + 2).join(" ") });
      } else if (includeLinks && i === 1) {
        // Add a link in the second paragraph
        const words = paragraph.split(" ");
        const linkIndex = Math.floor(words.length / 2);
        
        ops.push({ insert: words.slice(0, linkIndex).join(" ") + " " });
        ops.push({
          insert: "example link",
          attributes: { link: "https://example.com" }
        });
        ops.push({ insert: " " + words.slice(linkIndex).join(" ") });
      } else {
        ops.push({ insert: paragraph });
      }
      
      ops.push({ insert: "\n\n" });
    }
    
    // Add lists if requested
    if (includeLists) {
      ops.push({ insert: "Here are some important points:\n" });
      const listItems = [
        "First item with detailed explanation",
        "Second item with supporting information",
        "Third item with additional context",
      ];
      
      listItems.forEach(item => {
        ops.push({
          insert: item + "\n",
          attributes: { list: "bullet" }
        });
      });
      ops.push({ insert: "\n" });
    }
    
    // Add code block if requested
    if (includeCode) {
      ops.push({ insert: "Here's an example code snippet:\n" });
      ops.push({
        insert: "const greeting = 'Hello, World!';\nconsole.log(greeting);\n",
        attributes: { "code-block": true }
      });
      ops.push({ insert: "\n" });
    }
    
    return { ops };
  }
  
  /**
   * Generate a minimal Quill Delta (just enough to pass validation)
   */
  static minimalDelta(): QuillDelta {
    return {
      ops: [{
        insert: "This is a minimal article with just enough content to pass validation. " +
                "It contains multiple sentences to meet the minimum word count requirement. " +
                "The content is straightforward without any special formatting. " +
                "We need at least fifty words to pass the validation checks. " +
                "This sentence ensures we have sufficient content."
      }]
    };
  }
  
  /**
   * Generate an empty Quill Delta
   */
  static emptyDelta(): QuillDelta {
    return { ops: [] };
  }
  
  /**
   * Generate a set of test articles
   */
  static articleSet(count: number): FormData[] {
    return Array.from({ length: count }, (_, i) => ({
      authorName: `Test Author ${i + 1}`,
      articleTitle: `Test Article ${i + 1}: ${this.generateTitle()}`,
      metaDescription: this.generateMetaDescription(),
      articleContent: this.quillDelta({ paragraphs: 2 + (i % 3) }),
      publishNow: i % 2 === 0, // Alternate between published and draft
    }));
  }
  
  /**
   * Generate content with special characters
   */
  static specialCharacterDelta(): QuillDelta {
    return {
      ops: [
        { insert: "Café & Résumé: Testing Special Characters\n\n" },
        { insert: "This article contains various special characters: " },
        { insert: "é, ñ, ü, ö, ä, ß, ç, ø, å, æ, œ, ™, ©, ®\n\n" },
        { insert: "Emojis: 🎉 🚀 💻 📚 ✨\n\n" },
        { insert: "Unicode: 你好世界 (Hello World in Chinese)\n\n" },
        { insert: "Math symbols: ∑ ∏ √ ∞ ≠ ≤ ≥\n" },
      ]
    };
  }
  
  // Helper methods
  private static generateSentence(): string {
    const sentences = [
      "Understanding Modern Web Development",
      "Best Practices for API Design",
      "The Future of JavaScript Frameworks",
      "Building Scalable Applications",
      "Performance Optimization Techniques",
    ];
    return sentences[Math.floor(Math.random() * sentences.length)];
  }
  
  private static generateParagraph(): string {
    const paragraphs = [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
      "The quick brown fox jumps over the lazy dog. This pangram contains all letters of the alphabet and is commonly used for testing fonts and keyboards. It has been used since the late 1800s.",
      "In the world of web development, staying current with the latest technologies is crucial. Modern frameworks and tools evolve rapidly, requiring developers to continuously learn and adapt their skills.",
      "Performance optimization is a critical aspect of web development. From minimizing bundle sizes to implementing lazy loading, every optimization contributes to a better user experience and improved metrics.",
      "Testing is an essential part of the development process. Unit tests, integration tests, and end-to-end tests all play important roles in ensuring code quality and preventing regressions.",
    ];
    return paragraphs[Math.floor(Math.random() * paragraphs.length)];
  }
  
  private static generateTitle(): string {
    const titles = [
      "A Comprehensive Guide",
      "Essential Tips and Tricks",
      "From Beginner to Expert",
      "Industry Best Practices",
      "The Complete Tutorial",
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }
  
  private static generateMetaDescription(): string {
    return "This comprehensive article provides detailed insights and practical examples. " +
           "Learn essential concepts and best practices from industry experts.";
  }
}