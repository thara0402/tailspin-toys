/**
 * Pure formatting helpers for game star ratings.
 *
 * Kept framework-free and side-effect-free so the logic is unit-testable
 * without the Astro runtime (see `ratings.test.ts`). Consumed by the
 * `StarRating.astro` component.
 */

/**
 * Clamps a rating into the displayable 0–5 range.
 *
 * @param rating - The raw rating value before normalization.
 * @returns The rating restricted to the 0–5 display range.
 */
export function clampRating(rating: number): number {
    return Math.min(5, Math.max(0, rating));
}

/**
 * Builds a star glyph string for a rating between 0 and 5.
 *
 * Renders full (★), an optional half (½) and empty (☆) stars. Returns
 * `'Not yet rated'` when the rating is `null`. Ratings are clamped to the
 * 0–5 range so the output always contains exactly five star positions.
 *
 * @param rating - The game rating, or null when the title has not been rated.
 * @returns A display string made of full, half, and empty stars, or a fallback label when null.
 */
export function formatStarRating(rating: number | null): string {
    if (rating === null) return 'Not yet rated';

    const clamped = clampRating(rating);
    const fullStars = Math.floor(clamped);
    const halfStar = clamped % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}
