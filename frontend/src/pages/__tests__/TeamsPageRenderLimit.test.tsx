import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TeamsPage from '../TeamsPage';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../api/client', () => ({ default: transport }));

const clients: QueryClient[] = [];
beforeEach(() => {
  localStorage.clear();
  transport.get.mockReset();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

const teams = Array.from({ length: 90 }, (_, index) => ({
  idTeam: String(1000 + index),
  strTeam: `Team ${String(index).padStart(3, '0')}`,
  strSport: 'Soccer',
  strTeamBadge: `https://badges.example/${index}.png`,
}));

// Stands in for /api/teams/all, which searches, filters, sorts and pages the
// catalog on the server. Only what these tests exercise is modelled.
function serveTeams(path: string) {
  const url = new URL(path, 'http://sportarr.test');
  if (url.pathname !== '/teams/all') return null;
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const nameFilter = (url.searchParams.get('filter.strTeam') ?? '').toLowerCase();
  const matched = teams.filter((team) =>
    team.strTeam.toLowerCase().includes(q) && team.strTeam.toLowerCase().includes(nameFilter));
  const limit = Number(url.searchParams.get('limit') ?? matched.length);
  return {
    data: matched.slice(0, limit),
    headers: { 'x-total-count': String(matched.length), 'x-catalog-count': String(teams.length) },
  };
}

async function renderTeamsPage() {
  transport.get.mockImplementation(async (path: string) => {
    const page = serveTeams(path);
    if (page) return page;
    if (path === '/followed-teams') return { data: [] };
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
  await screen.findByText('Team 000');
}

describe('teams page render limit', () => {
  it('preselects new leagues but leaves existing library leagues for an explicit choice', async () => {
    transport.get.mockImplementation(async (path: string) => {
      const page = serveTeams(path);
      if (page) return page;
      if (path === '/followed-teams') return { data: [{ id: 1, externalId: '1000', name: 'Team 000', sport: 'Soccer' }] };
      if (path === '/qualityprofile') return { data: [{ id: 1, name: 'Any' }] };
      if (path === '/followed-teams/1/leagues') return { data: { leagues: [
        { externalId: 'lg-existing', name: 'Existing League', sport: 'Soccer', eventCount: 4, isAdded: false, isInLibrary: true },
        { externalId: 'lg-new', name: 'New League', sport: 'Soccer', eventCount: 4, isAdded: false, isInLibrary: false },
      ] } };
      throw new Error('Unconfigured page request ' + path);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><TeamsPage /></MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByTitle('Expand'));
    expect(await screen.findByText('Existing League')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Selected Leagues (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Existing League'));
    expect(screen.getByRole('button', { name: 'Add Selected Leagues (2)' })).toBeInTheDocument();
  });

  it('renders the first page of teams and reveals more on demand', async () => {
    await renderTeamsPage();

    expect(screen.getAllByAltText(/^Team \d{3}$/)).toHaveLength(60);
    expect(screen.queryByText('Team 060')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 60 of 90 teams')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more (30 remaining)'));

    expect(await screen.findByText('Team 089')).toBeInTheDocument();
    expect(screen.getAllByAltText(/^Team \d{3}$/)).toHaveLength(90);
    expect(screen.getByText('Showing 90 of 90 teams')).toBeInTheDocument();
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('counts the compact table rows after column filtering', async () => {
    const viewport = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    try {
      await renderTeamsPage();

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(61);
      expect(screen.getByText('Showing 60 of 90 teams')).toBeInTheDocument();

      fireEvent.click(screen.getAllByTitle('Filter')[0]);
      fireEvent.change(screen.getByPlaceholderText('Filter...'), { target: { value: 'Team 089' } });

      expect(await screen.findByText('Team 089')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(2);
      expect(screen.getByText('Showing 1 of 1 team (90 total)')).toBeInTheDocument();
      expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
    } finally {
      viewport.mockRestore();
    }
  });

  it('searches all teams, not only the rendered page', async () => {
    await renderTeamsPage();

    fireEvent.change(screen.getByPlaceholderText(/Filter teams/), { target: { value: 'Team 089' } });

    expect(await screen.findByText('Team 089')).toBeInTheDocument();
    expect(screen.queryByText(/Show more/)).not.toBeInTheDocument();
  });

  it('asks the server for one page rather than the whole catalog', async () => {
    await renderTeamsPage();

    const teamRequests = transport.get.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.startsWith('/teams/all'));
    expect(teamRequests.length).toBeGreaterThan(0);
    expect(teamRequests.every((path) => new URL(path, 'http://sportarr.test').searchParams.get('limit') === '60')).toBe(true);
  });

  it('sends the compact column sort to the server', async () => {
    const viewport = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
    try {
      await renderTeamsPage();

      fireEvent.click(screen.getByText('Team'));

      await vi.waitFor(() => {
        const last = String(transport.get.mock.calls.filter(([path]) => String(path).startsWith('/teams/all')).at(-1)?.[0]);
        const params = new URL(last, 'http://sportarr.test').searchParams;
        expect(params.get('sort')).toBe('strTeam');
        expect(params.get('dir')).toBe('desc');
      });
    } finally {
      viewport.mockRestore();
    }
  });

  it('lazy loads team badges', async () => {
    await renderTeamsPage();

    expect(screen.getByAltText('Team 000')).toHaveAttribute('loading', 'lazy');
  });
});
