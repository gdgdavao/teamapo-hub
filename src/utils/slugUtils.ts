/**
 * Slug Utility Functions
 * Generates URL-friendly slugs from event titles
 */

/**
 * Generate a URL-friendly slug from a string
 * @param text - The text to convert to a slug
 * @returns A lowercase, hyphenated slug
 */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    // Replace special characters with their base equivalents
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace & with 'and'
    .replace(/&/g, 'and')
    // Remove special characters except spaces and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace multiple spaces/hyphens with single hyphen
    .replace(/[\s_-]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length to keep URLs manageable
    .substring(0, 60)
    // Remove trailing hyphen if truncated mid-word
    .replace(/-+$/, '');
};

/**
 * Generate a unique slug by appending a short random suffix if needed
 * @param text - The text to convert to a slug
 * @param existingSlugs - Array of existing slugs to check against
 * @returns A unique slug
 */
export const generateUniqueSlug = (text: string, existingSlugs: string[]): string => {
  const baseSlug = generateSlug(text);
  
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }
  
  // Add a short random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${randomSuffix}`;
};
