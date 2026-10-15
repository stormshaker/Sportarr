import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TeamsPage from '../TeamsPage';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/client', () => ({ default: transport }));

const originalWidth = window.innerWidth;
const clients: QueryClient[] = [];
beforeEach(() => {
  localStorage.clear();
  transport.get.mockReset();
  // Just above COMPACT_VIEW_BREAKPOINT, so the page draws cards, not the table.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1300 });
});
afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  for (const client of clients.splice(0)) client.clear();
});

describe('teams page card layout', () => {
  it('lets the card row wrap the buttons under the name instead of covering it', async () => {
    transport.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://sportarr.test');
      if (url.pathname === '/teams/all') {
        return {
          data: [{ idTeam: '1', strTeam: 'Adelaide United', strSport: 'Soccer', strCountry: 'Australia' }],
          headers: { 'x-total-count': '1', 'x-catalog-count': '1' },
        };
      }
      if (path === '/followed-teams') return { data: [{ id: 1, externalId: '1', name: 'Adelaide United', sport: 'Soccer' }] };
      if (path === '/qualityprofile') return { data: [] };
      throw new Error('Unconfigured page request ' + path);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><TeamsPage /></MemoryRouter>
      </QueryClientProvider>
    );

    const heading = await screen.findByRole('heading', { name: 'Adelaide United' });
    const following = await screen.findByTitle('Following - view leagues');
    const textColumn = heading.parentElement as HTMLElement;
    const row = textColumn.parentElement as HTMLElement;
    const badges = screen.getByText('Soccer').parentElement as HTMLElement;

    expect(row).toContainElement(following);
    expect(row.className).toContain('flex-wrap');
    expect(textColumn.className).toContain('min-w-[10rem]');
    expect(badges.className).toContain('flex-wrap');
  });
});
