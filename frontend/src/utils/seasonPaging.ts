// An expanded season renders its events a page at a time. A team sport's
// season is a few hundred games, but an individual sport's is not: an ATP or
// WTA season is 2,000-2,700 matches, because every match in every tournament
// is its own event, and rendering them all put 65,000 nodes on the page from
// a single click.
export const EVENTS_PER_PAGE = 200;

/**
 * How many of a season's events to render. `stored` is what "Show more" has
 * reached for this season, if anything. A deep link can name an event past
 * that point, so the limit grows to the page that holds it; otherwise its row
 * never renders and the scroll to it gives up.
 */
export function seasonRenderLimit(
  stored: number | undefined,
  events: ReadonlyArray<{ id: number }>,
  deepLinkedEventId?: number | null
): number {
  const limit = stored ?? EVENTS_PER_PAGE;
  if (deepLinkedEventId == null) return limit;
  const index = events.findIndex((event) => event.id === deepLinkedEventId);
  if (index < 0) return limit;
  return Math.max(limit, Math.ceil((index + 1) / EVENTS_PER_PAGE) * EVENTS_PER_PAGE);
}

/** The limit after one more "Show more", never past the season's size. */
export function nextSeasonRenderLimit(shown: number, total: number): number {
  return Math.min(shown + EVENTS_PER_PAGE, total);
}
