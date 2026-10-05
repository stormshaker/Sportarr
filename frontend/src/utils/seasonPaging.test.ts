import { describe, expect, it } from 'vitest';
import { EVENTS_PER_PAGE, nextSeasonRenderLimit, seasonRenderLimit } from './seasonPaging';

const season = (count: number) => Array.from({ length: count }, (_, index) => ({ id: 1000 + index }));

describe('season render limit', () => {
  it('starts at one page', () => {
    expect(seasonRenderLimit(undefined, season(2500))).toBe(EVENTS_PER_PAGE);
  });

  it('keeps what Show more has reached', () => {
    expect(seasonRenderLimit(600, season(2500))).toBe(600);
  });

  it('grows to the page holding a deep-linked event past the limit', () => {
    // Index 900 is the 901st event, on the fifth page of 200.
    expect(seasonRenderLimit(undefined, season(2500), 1900)).toBe(1000);
  });

  it('does not shrink below what Show more reached for a deep link on an earlier page', () => {
    expect(seasonRenderLimit(1200, season(2500), 1005)).toBe(1200);
  });

  it('ignores a deep link to an event this season does not hold', () => {
    expect(seasonRenderLimit(undefined, season(2500), 99)).toBe(EVENTS_PER_PAGE);
    expect(seasonRenderLimit(undefined, season(2500), null)).toBe(EVENTS_PER_PAGE);
  });

  it('steps a page at a time and stops at the season size', () => {
    expect(nextSeasonRenderLimit(200, 2500)).toBe(400);
    expect(nextSeasonRenderLimit(2400, 2500)).toBe(2500);
  });
});
