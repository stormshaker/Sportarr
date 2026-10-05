import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { apiGet } from '../../utils/api';
import LeagueSearchPage from '../LeagueSearchPage';

const view = vi.hoisted(() => ({ compact: false }));
vi.mock('../../hooks/useCompactView', () => ({ useCompactView: () => view.compact }));
vi.mock('../../utils/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn() }));

const leagues = Array.from({ length: 90 }, (_, index) => ({
  idLeague: `lg-${1000 + index}`,
  strLeague: `League ${String(index).padStart(3, '0')}`,
  strSport: index % 2 === 0 ? 'Soccer' : 'Basketball',
  strCountry: 'Nowhere',
}));

function json(body: unknown, headers: Record<string, string> = {}) {
  return { ok: true, json: async () => body, headers: new Headers(headers) } as never;
}

// Stands in for /api/leagues/all, which searches, filters, sorts and pages
// the catalog on the server. Only what these tests exercise is modelled.
function serve(path: string) {
  const url = new URL(path, 'http://sportarr.test');
  if (url.pathname === '/api/leagues/sports') return json(['Basketball', 'Soccer']);
  if (url.pathname === '/api/leagues') return json([]);
  if (url.pathname !== '/api/leagues/all') throw new Error('Unconfigured page request ' + path);

  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const sport = url.searchParams.get('sport');
  const nameFilter = (url.searchParams.get('filter.strLeague') ?? '').toLowerCase();
  let matched = leagues.filter((league) =>
    league.strLeague.toLowerCase().includes(q) &&
    league.strLeague.toLowerCase().includes(nameFilter) &&
    (!sport || league.strSport === sport));
  if (url.searchParams.get('dir') === 'desc') matched = [...matched].reverse();
  const limit = Number(url.searchParams.get('limit') ?? matched.length);
  return json(matched.slice(0, limit), {
    'x-total-count': String(matched.length),
    'x-catalog-count': String(leagues.length),
  });
}

function leagueRequests() {
  return vi.mocked(apiGet).mock.calls
    .map(([path]) => new URL(String(path), 'http://sportarr.test'))
    .filter((url) => url.pathname === '/api/leagues/all');
}

describe('league search paging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    view.compact = false;
    vi.mocked(apiGet).mockImplementation(async (path) => serve(String(path)));
  });

  it('asks the server for one page and reveals more on demand', async () => {
    renderWithProviders(<LeagueSearchPage />);

    expect(await screen.findByText('League 000')).toBeInTheDocument();
    expect(screen.queryByText('League 060')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 60 of 90 leagues')).toBeInTheDocument();
    expect(leagueRequests().every((url) => url.searchParams.get('limit') === '60')).toBe(true);

    fireEvent.click(screen.getByText('Show more (30 remaining)'));

    expect(await screen.findByText('League 089')).toBeInTheDocument();
    expect(screen.getByText('Showing 90 of 90 leagues')).toBeInTheDocument();
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('shows the count of the page on screen when a cached page comes back', async () => {
    renderWithProviders(<LeagueSearchPage />);
    await screen.findByText('Showing 60 of 90 leagues');

    const sportSelect = screen.getByTitle('Filter by sport');
    fireEvent.change(sportSelect, { target: { value: 'Soccer' } });
    expect(await screen.findByText(/^Showing 45 of 45 leagues \(90 total\)/)).toBeInTheDocument();

    // Back to a page React Query already holds. Its count must come with it,
    // not linger from the Soccer request.
    fireEvent.change(sportSelect, { target: { value: 'all' } });
    expect(await screen.findByText('Showing 60 of 90 leagues')).toBeInTheDocument();
  });

  it('keeps the compact table on screen when a column filter matches nothing', async () => {
    view.compact = true;
    renderWithProviders(<LeagueSearchPage />);
    await screen.findByText('League 000');

    fireEvent.click(screen.getAllByTitle('Filter')[0]);
    fireEvent.change(screen.getByPlaceholderText('Filter...'), { target: { value: 'no such league' } });

    await waitFor(() =>
      expect(leagueRequests().at(-1)?.searchParams.get('filter.strLeague')).toBe('no such league'));
    expect(await screen.findByText(/^Showing 0 of 0 leagues \(90 total\)/)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Filter...')).toHaveValue('no such league');
  });

  it('sends the compact column sort to the server', async () => {
    view.compact = true;
    renderWithProviders(<LeagueSearchPage />);
    await screen.findByText('League 000');

    fireEvent.click(screen.getByText('League'));

    await waitFor(() => {
      const last = leagueRequests().at(-1);
      expect(last?.searchParams.get('sort')).toBe('strLeague');
      expect(last?.searchParams.get('dir')).toBe('desc');
    });
    expect(await screen.findByText('League 089')).toBeInTheDocument();
  });
});
