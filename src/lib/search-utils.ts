// PHASE 5: Centralized search utilities
// Removes duplicate fuzzy search implementations across components

/**
 * Fuzzy match function for searching text
 * Matches if pattern appears in text (exact or with missing characters)
 * 
 * @param text - The text to search in
 * @param pattern - The pattern to search for
 * @returns true if pattern matches text (70% character match threshold)
 */
export const fuzzyMatch = (text: string, pattern: string): boolean => {
  if (!pattern) return true;
  if (!text) return false;
  
  const normalizedText = text.toLowerCase().replace(/\s+/g, '');
  const normalizedPattern = pattern.toLowerCase().replace(/\s+/g, '');
  
  // Exact substring match gets highest priority
  if (normalizedText.includes(normalizedPattern)) return true;
  
  // Character sequence match (allows missing characters between)
  let patternIndex = 0;
  for (let i = 0; i < normalizedText.length && patternIndex < normalizedPattern.length; i++) {
    if (normalizedText[i] === normalizedPattern[patternIndex]) {
      patternIndex++;
    }
  }
  
  // If we matched at least 70% of the pattern characters, it's a fuzzy match
  return patternIndex >= Math.ceil(normalizedPattern.length * 0.7);
};

/**
 * Simple fuzzy search - matches if all pattern characters appear in order in text
 * More strict than fuzzyMatch (requires 100% character match)
 * 
 * @param text - The text to search in
 * @param query - The query to search for
 * @returns true if all query characters appear in order in text
 */
export const fuzzySearch = (text: string, query: string): boolean => {
  if (!query) return true;
  if (!text) return false;
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (queryLower.length === 0) return true;
  
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }
  
  return queryIndex === queryLower.length;
};

