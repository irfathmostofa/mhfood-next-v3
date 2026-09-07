// ============================================================
// SEO analysis engine (edge function / Deno)
// ------------------------------------------------------------
// Extracts keywords, measures density + readability and produces
// a 0-100 SEO score. A mirrored copy lives at src/lib/seoAnalyzer.js
// so the admin review UI can recompute the score live while editing.
// ============================================================

export interface SeoStats {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  keywordOccurrences: Record<string, number>;
}

export interface SeoResult {
  suggestedKeywords: string[];
  keywordDensity: number; // 0-100
  readabilityScore: number; // 0-100, higher = easier to read
  seoScore: number; // 0-100
  stats: SeoStats;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "me",
  "more",
  "my",
  "not",
  "of",
  "on",
  "one",
  "or",
  "our",
  "out",
  "over",
  "said",
  "she",
  "so",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "under",
  "up",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
  "very",
  "just",
  "also",
  "own",
  "its",
  "every",
  "each",
  "both",
  "other",
  "such",
  "only",
  "same",
  "even",
  "how",
]);

const HTML_TAGS = /<[^>]*>/g;
const NON_WORD = /[^\p{L}\p{N}'-]+/gu;

export function stripHtml(text: string): string {
  return String(text || "")
    .replace(HTML_TAGS, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

export function tokenize(text: string): string[] {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(HTML_TAGS, " ")
    .split(NON_WORD)
    .map((w) => w.replace(/['-]+$/g, ""))
    .filter((w) => w.length > 1);
}

export function splitSentences(text: string): string[] {
  const clean = stripHtml(text);
  return clean
    .replace(/([.!?]+["')\]]*)\s+/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function extractKeywords(
  text: string,
  topN = 10,
  exclude: string[] = [],
): string[] {
  const words = tokenize(text);
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    if (exclude.includes(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([w]) => w);
}

// Estimate syllables by counting vowel-group runs (no dictionary needed).
function countSyllables(word: string): number {
  const groups = word.match(/[aeiouy]+/g);
  if (!groups) return 1;
  let n = groups.length;
  if (word.endsWith("e") && n > 1) n -= 1;
  return Math.max(1, n);
}

export function analyzeSEO(title: string, description: string): SeoResult {
  const text = `${title || ""} ${description || ""}`;
  const words = tokenize(text);
  const sentences = splitSentences(`${title || ""}. ${description || ""}`);
  const totalWords = words.length;
  const totalSentences = sentences.length;

  const keywords = extractKeywords(text, 10);
  const keywordOccurrences: Record<string, number> = {};
  let keywordHits = 0;
  for (const k of keywords) {
    let count = 0;
    for (const w of words) if (w === k) count += 1;
    keywordOccurrences[k] = count;
    keywordHits += count;
  }

  const avgWps = totalSentences > 0 ? totalWords / totalSentences : 0;

  // Keyword density: share of all words that are top keywords. Ideal 2-3%.
  const keywordDensity = totalWords > 0 ? (keywordHits / totalWords) * 100 : 0;

  // Readability: Flesch Reading Ease approximation (0-100, higher is easier).
  let syllableTotal = 0;
  for (const w of words) syllableTotal += countSyllables(w);
  const syllablesPer100 =
    totalWords > 0 ? (syllableTotal / totalWords) * 100 : 0;
  const flesch = 206.835 - 1.015 * avgWps - 84.6 * (syllablesPer100 / 100);
  const readabilityScore = Math.max(0, Math.min(100, Math.round(flesch)));

  // Length component: a full description should be substantial (500+ words).
  const descriptionWords = tokenize(description || "").length;
  const lengthScore = Math.min(100, Math.round((descriptionWords / 200) * 100));

  // Density component: penalise both under- and over-optimised copy.
  const densityScore = Math.max(0, 100 - Math.abs(keywordDensity - 2.5) * 18);

  // Keyword coverage bonus: having 8+ suggested keywords is good.
  const coverageScore = Math.min(100, keywords.length * 12);

  const seoScore = Math.round(
    0.4 * densityScore +
      0.3 * readabilityScore +
      0.2 * lengthScore +
      0.1 * coverageScore,
  );

  return {
    suggestedKeywords: keywords,
    keywordDensity: Math.round(keywordDensity * 100) / 100,
    readabilityScore,
    seoScore: Math.max(0, Math.min(100, seoScore)),
    stats: {
      wordCount: totalWords,
      sentenceCount: totalSentences,
      avgWordsPerSentence: Math.round(avgWps * 100) / 100,
      keywordOccurrences,
    },
  };
}
