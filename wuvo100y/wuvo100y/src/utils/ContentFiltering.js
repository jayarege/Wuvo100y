/**
 * Content Filtering Utilities
 * Extracted from duplicated code across components
 * Used for filtering adult and inappropriate content from search results
 */

// Whitelist for major studios/franchises that should never be filtered
const trustedSources = [
  'disney', 'pixar', 'marvel', 'lucasfilm', 'warner bros', 'universal',
  'paramount', 'sony pictures', 'columbia', 'dreamworks', 'netflix',
  'hbo', 'amc', 'fx', 'bbc', 'cbs', 'nbc', 'abc', 'fox'
];

// Check for obfuscated adult content patterns
export const isObfuscatedAdultContent = (text) => {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // Obfuscation patterns for adult terms
  const obfuscationPatterns = [
    /c[\*\-\_0o]{1,4}[ck]/gi,     // c*ck, c--k, c0ck variants
    /p[\*\-\_0o]{1,4}rn/gi,       // p*rn, p--rn, p0rn variants
    /d[\*\-\_1i]{1,4}[ck]/gi,     // d*ck, d--k, d1ck variants
    /f[\*\-\_]{1,4}ck/gi,         // f*ck, f--k variants
    /[\*\-\_]{3,}/g,              // 3+ consecutive censorship chars
    /\b(cock|dick|penis)\b/gi,    // Explicit anatomy terms
    /\b(pussy|vagina|cunt)\b/gi,  // Female anatomy terms
    /\b(tits|boobs|breasts)\b/gi, // Chest terms
  ];
  
  return obfuscationPatterns.some(pattern => pattern.test(lower));
};

// Check for suspicious adult title structures
export const hasSuspiciousAdultStructure = (title) => {
  if (!title) return false;
  const lower = title.toLowerCase();
  
  // Suspicious title patterns common in adult content
  const suspiciousPatterns = [
    // "My/The [size] [anatomy]" patterns
    /\b(my|the|a)\s+(massive|huge|big|enormous|giant|thick)\s+(cock|dick|penis)/gi,
    /\b(my|the|a)\s+(tight|wet|hot)\s+(pussy|vagina)/gi,
    /\b(my|the|a)\s+(big|huge|massive)\s+(tits|boobs|breasts)/gi,
    
    // Size + anatomy combinations anywhere
    /\b(massive|huge|big|enormous|giant|thick)\s+(cock|dick|penis)/gi,
    /\b(tight|wet|hot|horny)\s+(pussy|vagina)/gi,
    
    // Action + anatomy patterns
    /\b(fucking|sucking|riding|mounting)\s+(my|your|his|her)\s+(cock|dick|pussy)/gi,
    /\b(blowjob|handjob|rimjob|footjob)/gi,
    
    // Adult film title patterns
    /\b(barely|just)\s+(legal|18)/gi,
    /\b(teen|young)\s+(slut|whore|bitch)/gi,
    /\b(milf|gilf|cougar)\b/gi,
    /\b(gangbang|threesome|orgy)/gi,
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(lower));
};

// Check for obvious adult terms
export const hasObviousAdultTerms = (title, overview = '') => {
  if (!title) return false;
  const allText = `${title} ${overview}`.toLowerCase();
  
  // Very obvious adult terms that should always be filtered
  const obviousTerms = [
    'xxx', 'porn', 'pornographic', 'erotic', 'sexual', 'nude', 'naked',
    'hardcore', 'softcore', 'adult film', 'sex tape', 'sex scene',
    'masturbation', 'orgasm', 'cumshot', 'facial', 'anal', 'oral',
    'bdsm', 'fetish', 'kinky', 'strip', 'stripper', 'escort', 'prostitute'
  ];
  
  return obviousTerms.some(term => allText.includes(term));
};

// Check if content is from trusted sources
export const isTrustedContent = (item) => {
  // High vote count usually indicates legitimate content
  if (item.vote_count && item.vote_count > 1000) return true;
  
  // Check production companies
  if (item.production_companies && Array.isArray(item.production_companies)) {
    const hasTrustedStudio = item.production_companies.some(company => 
      trustedSources.some(trusted => 
        (company.name || '').toLowerCase().includes(trusted)
      )
    );
    if (hasTrustedStudio) return true;
  }
  
  return false;
};

// Strict filtering for search suggestions (higher bar)
export const filterSearchSuggestions = (items) => {
  return items.filter(item => {
    // Always block explicitly marked adult content
    if (item.adult === true) return false;
    
    // Allow trusted content even if it might trigger some patterns
    if (isTrustedContent(item)) return true;
    
    const title = item.title || item.name || '';
    const overview = item.overview || '';
    
    // Block obvious adult terms
    if (hasObviousAdultTerms(title, overview)) return false;
    
    // Block obfuscated content
    if (isObfuscatedAdultContent(title)) return false;
    
    // Block suspicious title structures
    if (hasSuspiciousAdultStructure(title)) return false;
    
    return true;
  });
};

// Moderate filtering for full search results (more permissive)
export const filterFullSearchResults = (items) => {
  return items.filter(item => {
    // Always block explicitly marked adult content
    if (item.adult === true) return false;
    
    // Allow trusted content
    if (isTrustedContent(item)) return true;
    
    const title = item.title || item.name || '';
    const overview = item.overview || '';
    
    // Block obvious adult terms
    if (hasObviousAdultTerms(title, overview)) return false;
    
    // Block obfuscated content (stricter check)
    if (isObfuscatedAdultContent(title)) return false;
    
    // For full search, only block the most obvious suspicious patterns
    const veryObviousPatterns = [
      /\b(my|the)\s+(massive|huge|enormous)\s+(cock|dick)/gi,
      /\b(gangbang|threesome|orgy)/gi,
      /\bxxx\b/gi,
    ];
    
    const hasVeryObviousPattern = veryObviousPatterns.some(pattern => 
      pattern.test(title.toLowerCase())
    );
    
    if (hasVeryObviousPattern) return false;
    
    return true;
  });
};

// Main content filtering function - alias for compatibility
export const filterAdultContent = (contentArray, mediaType = 'movie') => {
  if (!contentArray || !Array.isArray(contentArray)) {
    console.warn('filterAdultContent: Invalid input provided');
    return [];
  }
  return filterFullSearchResults(contentArray);
};

// Search results filtering function - alias for compatibility  
export const filterSearchResults = (searchResults, mediaType = 'movie') => {
  return filterSearchSuggestions(searchResults);
};

// Content safety check function
export const isContentSafe = (item, mediaType = 'movie') => {
  if (!item) return false;
  
  // Check if item would pass filtering
  const passesFilter = filterAdultContent([item], mediaType).length > 0;
  return passesFilter;
};