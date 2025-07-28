/// <reference lib="deno.ns" />
import { logger } from "@utils/logger.ts";

/**
 * Reading speed configuration for different content types
 */
export const READING_SPEEDS = {
  text: 238,      // Average words per minute for regular text
  technical: 200, // Technical content with jargon
  code: 150,      // Code blocks require slower reading
  list: 250,      // Lists are scanned faster
} as const;

/**
 * Time constants for non-text elements
 */
export const ELEMENT_TIMES = {
  image: 12,      // Seconds to view an image
  video: 0,       // Videos handled separately (duration-based)
  table: 15,      // Seconds to scan a table
  codeBlock: 0,   // Calculated based on lines
} as const;

/**
 * Content analysis result
 */
export interface ContentAnalysis {
  totalWords: number;
  textWords: number;
  codeWords: number;
  listWords: number;
  technicalWords: number;
  imageCount: number;
  videoCount: number;
  tableCount: number;
  codeBlockCount: number;
  hasMath: boolean;
  complexity: "simple" | "moderate" | "complex";
}

/**
 * Reading time result
 */
export interface ReadingTimeResult {
  minutes: number;
  time: string;
  words: number;
  analysis: ContentAnalysis;
}

/**
 * Technical terms that indicate complex content
 */
const TECHNICAL_TERMS = new Set([
  "algorithm", "implementation", "architecture", "framework", "database",
  "api", "interface", "component", "module", "function", "method",
  "class", "object", "array", "variable", "parameter", "argument",
  "asynchronous", "synchronous", "promise", "callback", "closure",
  "recursion", "iteration", "optimization", "performance", "complexity",
  "encryption", "authentication", "authorization", "security", "protocol",
  "deploy", "build", "compile", "runtime", "debug", "test",
  "repository", "branch", "commit", "merge", "pull request",
  "container", "docker", "kubernetes", "microservice", "serverless",
  "typescript", "javascript", "react", "vue", "angular", "node",
  "deno", "npm", "yarn", "webpack", "vite", "rollup",
]);

/**
 * Calculate reading time from HTML content
 */
export function calculateReadingTime(
  htmlContent: string,
  options: {
    wordsPerMinute?: number;
    minimumTime?: number;
    includeAnalysis?: boolean;
  } = {}
): ReadingTimeResult {
  const {
    wordsPerMinute = READING_SPEEDS.text,
    minimumTime = 1,
    includeAnalysis = true,
  } = options;

  try {
    // Analyze content
    const analysis = analyzeContent(htmlContent);
    
    // Calculate time for different content types
    const textTime = analysis.textWords / wordsPerMinute;
    const codeTime = analysis.codeWords / READING_SPEEDS.code;
    const listTime = analysis.listWords / READING_SPEEDS.list;
    const technicalTime = analysis.technicalWords / READING_SPEEDS.technical;
    
    // Calculate time for non-text elements (in minutes)
    const imageTime = (analysis.imageCount * ELEMENT_TIMES.image) / 60;
    const tableTime = (analysis.tableCount * ELEMENT_TIMES.table) / 60;
    
    // Add extra time for code blocks (30 seconds per block for context switching)
    const codeBlockTime = (analysis.codeBlockCount * 30) / 60;
    
    // Calculate total time
    const totalMinutes = 
      textTime + 
      codeTime + 
      listTime + 
      technicalTime + 
      imageTime + 
      tableTime + 
      codeBlockTime;
    
    // Apply complexity multiplier
    const complexityMultiplier = getComplexityMultiplier(analysis.complexity);
    const adjustedMinutes = totalMinutes * complexityMultiplier;
    
    // Round to nearest minute with minimum
    const finalMinutes = Math.max(Math.ceil(adjustedMinutes), minimumTime);
    
    // Format time string
    const timeString = formatReadingTime(finalMinutes);
    
    logger.debug("Calculated reading time", {
      totalWords: analysis.totalWords,
      minutes: finalMinutes,
      complexity: analysis.complexity,
    });
    
    return {
      minutes: finalMinutes,
      time: timeString,
      words: analysis.totalWords,
      analysis: includeAnalysis ? analysis : undefined!,
    };
  } catch (error) {
    logger.error("Failed to calculate reading time", { 
      error: error instanceof Error ? error : new Error(String(error))
    });
    
    // Fallback to simple calculation
    const words = countWords(stripHtml(htmlContent));
    const minutes = Math.max(Math.ceil(words / wordsPerMinute), minimumTime);
    
    return {
      minutes,
      time: formatReadingTime(minutes),
      words,
      analysis: includeAnalysis ? createEmptyAnalysis(words) : undefined!,
    };
  }
}

/**
 * Analyze content structure and complexity
 */
export function analyzeContent(htmlContent: string): ContentAnalysis {
  // Initialize counters
  let textWords = 0;
  let codeWords = 0;
  let listWords = 0;
  let technicalWords = 0;
  
  // Count elements using regex patterns
  const imageCount = (htmlContent.match(/<img[^>]*>/gi) || []).length;
  const videoCount = (htmlContent.match(/<video[^>]*>|<iframe[^>]*(youtube|vimeo)[^>]*>/gi) || []).length;
  const tableCount = (htmlContent.match(/<table[^>]*>/gi) || []).length;
  
  // Count code blocks (pre with code, or standalone pre/code blocks)
  const preCodeMatches = htmlContent.match(/<pre[^>]*>[\s\S]*?<code[\s\S]*?<\/code>[\s\S]*?<\/pre>/gi) || [];
  const standalonePreMatches = htmlContent.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) || [];
  const standaloneCodeMatches = htmlContent.match(/<code[^>]*class=["']hljs["'][^>]*>[\s\S]*?<\/code>/gi) || [];
  const codeBlockCount = preCodeMatches.length + 
    standalonePreMatches.filter(pre => !preCodeMatches.some(pc => pc.includes(pre))).length +
    standaloneCodeMatches.length;
  
  // Check for math content
  const hasMath = /<math[^>]*>|class=["'](katex|MathJax|[^"']*math[^"']*|[^"']*equation[^"']*)/i.test(htmlContent);
  
  // Extract text from paragraphs, headings, blockquotes
  const textPattern = /<(p|h[1-6]|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let textMatch;
  while ((textMatch = textPattern.exec(htmlContent)) !== null) {
    const text = stripHtml(textMatch[2]);
    const words = countWords(text);
    textWords += words;
    
    // Count technical terms
    const techTermCount = countTechnicalTerms(text);
    if (techTermCount > 0) {
      technicalWords += techTermCount;
      textWords -= techTermCount; // Don't double count
    }
  }
  
  // Extract text from list items
  const listPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let listMatch;
  while ((listMatch = listPattern.exec(htmlContent)) !== null) {
    const text = stripHtml(listMatch[1]);
    listWords += countWords(text);
  }
  
  // Extract text from code blocks
  const codePattern = /<(code|pre)[^>]*>([\s\S]*?)<\/\1>/gi;
  let codeMatch;
  while ((codeMatch = codePattern.exec(htmlContent)) !== null) {
    const text = stripHtml(codeMatch[2]);
    codeWords += countWords(text);
  }
  
  // Calculate total words (avoid double counting)
  const totalWords = Math.max(textWords + technicalWords, 0) + 
                    Math.max(codeWords, 0) + 
                    Math.max(listWords, 0);
  
  // Determine complexity
  const complexity = determineComplexity({
    totalWords,
    codeBlockCount,
    technicalRatio: technicalWords / Math.max(totalWords, 1),
    hasMath,
  });
  
  return {
    totalWords,
    textWords: Math.max(textWords, 0),
    codeWords: Math.max(codeWords, 0),
    listWords: Math.max(listWords, 0),
    technicalWords: Math.max(technicalWords, 0),
    imageCount,
    videoCount,
    tableCount,
    codeBlockCount,
    hasMath,
    complexity,
  };
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) {
    return 0;
  }
  
  // Normalize whitespace and split
  return text
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(word => word.length > 0)
    .length;
}

/**
 * Count technical terms in text
 */
function countTechnicalTerms(text: string): number {
  if (!text) return 0;
  
  const words = text.toLowerCase().split(/\s+/);
  return words.filter(word => TECHNICAL_TERMS.has(word)).length;
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Determine content complexity
 */
function determineComplexity(factors: {
  totalWords: number;
  codeBlockCount: number;
  technicalRatio: number;
  hasMath: boolean;
}): "simple" | "moderate" | "complex" {
  const { totalWords, codeBlockCount, technicalRatio, hasMath } = factors;
  
  // Complex: high technical content, many code blocks, or math
  if (
    technicalRatio > 0.15 ||
    codeBlockCount > 5 ||
    (codeBlockCount > 2 && totalWords > 500) ||
    hasMath
  ) {
    return "complex";
  }
  
  // Moderate: some technical content or code
  if (
    technicalRatio > 0.05 ||
    codeBlockCount > 0 ||
    totalWords > 1000
  ) {
    return "moderate";
  }
  
  // Simple: straightforward content
  return "simple";
}

/**
 * Get complexity multiplier for time adjustment
 */
function getComplexityMultiplier(complexity: "simple" | "moderate" | "complex"): number {
  switch (complexity) {
    case "simple":
      return 0.9;  // Read 10% faster
    case "moderate":
      return 1.0;  // Normal speed
    case "complex":
      return 1.2;  // Read 20% slower
    default:
      return 1.0;
  }
}

/**
 * Format reading time as string
 */
export function formatReadingTime(minutes: number): string {
  if (minutes <= 0) {
    return "1 min read";
  }
  
  if (minutes === 1) {
    return "1 min read";
  }
  
  return `${minutes} min read`;
}

/**
 * Create empty analysis object
 */
function createEmptyAnalysis(totalWords: number): ContentAnalysis {
  return {
    totalWords,
    textWords: totalWords,
    codeWords: 0,
    listWords: 0,
    technicalWords: 0,
    imageCount: 0,
    videoCount: 0,
    tableCount: 0,
    codeBlockCount: 0,
    hasMath: false,
    complexity: "simple",
  };
}

/**
 * Calculate reading time for plain text
 */
export function calculatePlainTextReadingTime(
  text: string,
  wordsPerMinute: number = READING_SPEEDS.text
): ReadingTimeResult {
  const words = countWords(text);
  const minutes = Math.max(Math.ceil(words / wordsPerMinute), 1);
  
  return {
    minutes,
    time: formatReadingTime(minutes),
    words,
    analysis: createEmptyAnalysis(words),
  };
}