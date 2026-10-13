import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Activity,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Upload,
  ChevronDown,
  Crosshair,
  Gamepad2,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Trophy,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'

const PerformanceChart = lazy(
  () => import('./components/PerformanceChart.jsx'),
)
import './App.css'

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

const TOURNAMENT_ID = 2

const NAVIGATION = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Leaderboard', icon: Trophy },
  { label: 'Match History', icon: Swords },
  { label: 'Team Analytics', icon: BarChart3 },
  { label: 'Team Details', icon: Users },
  { label: 'Team Comparison', icon: Crosshair },
]

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString('en-IN')

const numeric = (value, fallback = 0) => {
  const result = Number(value)
  return Number.isFinite(result) ? result : fallback
}

function extractArray(data) {
  if (Array.isArray(data)) return data

  for (const key of ['standings', 'analytics', 'results', 'data']) {
    if (Array.isArray(data?.[key])) return data[key]
  }

  return []
}

function normalizeTeam(team, index = 0) {
  const matchesPlayed = numeric(team.matches_played)
  const totalPoints = numeric(team.total_points)

  const eliminations = numeric(
    team.eliminations ?? team.total_eliminations,
  )

  const placementPoints = numeric(
    team.placement_points ?? team.total_placement_points,
  )

  return {
    rank: numeric(team.rank, index + 1),
    team_id: team.team_id ?? team.id ?? null,
    team_name: team.team_name ?? team.name ?? 'Unknown team',
    matches_played: matchesPlayed,
    eliminations,
    placement_points: placementPoints,
    total_points: totalPoints,

    average_points_per_match: numeric(
      team.average_points_per_match,
      matchesPlayed ? totalPoints / matchesPlayed : 0,
    ),

    average_eliminations_per_match: numeric(
      team.average_eliminations_per_match,
      matchesPlayed ? eliminations / matchesPlayed : 0,
    ),

    average_placement:
      team.average_placement == null
        ? null
        : numeric(team.average_placement),

    best_placement:
      team.best_placement == null
        ? null
        : numeric(team.best_placement),

    first_place_finishes: numeric(team.first_place_finishes),
    last_3_matches_points: numeric(team.last_3_matches_points),
    last_5_matches_points: numeric(team.last_5_matches_points),
  }
}

function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>
}

function RankBadge({ rank }) {
  return (
    <span
      className={`rank-badge rank-${rank <= 3 ? rank : 'other'}`}
    >
      {String(rank).padStart(2, '0')}
    </span>
  )
}

function MetricCard({ label, value, description, icon: Icon, accent }) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>

        <span className={`metric-icon ${accent || ''}`}>
          <Icon size={19} />
        </span>
      </div>

      <div className="metric-value">{value}</div>
      <div className="metric-description">{description}</div>
    </article>
  )
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="panel-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>

      {action}
    </div>
  )
}

/* =========================================================
   OVERVIEW
========================================================= */

function Overview({ teams, matches, analytics, onNavigate }) {
  const topTeams = teams.slice(0, 5)

  const chartData = useMemo(
    () =>
      teams.slice(0, 8).map((team) => ({
        name: team.team_name,
        points: team.total_points,
        eliminations: team.eliminations,
      })),
    [teams],
  )

  const recentMatches = useMemo(
    () =>
      [...matches]
        .sort(
          (a, b) =>
            numeric(b.sequence_number ?? b.match_id) -
            numeric(a.sequence_number ?? a.match_id),
        )
        .slice(0, 4),
    [matches],
  )

  const totalPoints = teams.reduce(
    (sum, team) => sum + team.total_points,
    0,
  )

  const totalEliminations = teams.reduce(
    (sum, team) => sum + team.eliminations,
    0,
  )

  const maxRecentPoints = Math.max(
    ...analytics.map((team) => team.last_5_matches_points),
    1,
  )

  return (
    <>
      <section className="metric-grid">
        <MetricCard
          label="Teams tracked"
          value={formatNumber(teams.length)}
          description="Participating teams"
          icon={Users}
        />

        <MetricCard
          label="Matches played"
          value={formatNumber(matches.length)}
          description="Across all match days"
          icon={Gamepad2}
          accent="purple"
        />

        <MetricCard
          label="Total eliminations"
          value={formatNumber(totalEliminations)}
          description="Combined team eliminations"
          icon={Crosshair}
          accent="orange"
        />

        <MetricCard
          label="Total points"
          value={formatNumber(totalPoints)}
          description="Combined tournament points"
          icon={Zap}
          accent="blue"
        />
      </section>

      <section className="content-grid">
        <article className="panel chart-panel">
          <SectionHeading
            eyebrow="TOURNAMENT PERFORMANCE"
            title="Leaderboard overview"
            description="Total points earned by the top teams"
            action={
              <span className="chart-indicator">
                <span className="live-dot" />
                Historical data
              </span>
            }
          />


          {chartData.length ? (
            <div className="chart-container">
              <Suspense
                fallback={
                  <div className="empty-state">
                    Loading performance chart...
                  </div>
                }
              >
                <PerformanceChart
                  data={chartData}
                  dataKey="points"
                  xAxisKey="name"
                  gradientId="pointsGradient"
                  chartLabel="Points"
                  formatNumber={formatNumber}
                />
              </Suspense>
            </div>

          ) : (
            <EmptyState message="Leaderboard data is unavailable." />
          )}
        </article>

        <article className="panel">
          <SectionHeading
            eyebrow="TOP PERFORMERS"
            title="Current standings"
            action={
              <button
                className="text-button"
                onClick={() => onNavigate('Leaderboard')}
              >
                View all →
              </button>
            }
          />

          <div className="mini-leaderboard">
            {topTeams.map((team) => (
              <div
                className="mini-team"
                key={team.team_id ?? team.team_name}
              >
                <RankBadge rank={team.rank} />

                <div className="mini-team-info">
                  <span>{team.team_name}</span>
                  <small>
                    {formatNumber(team.eliminations)} eliminations
                  </small>
                </div>

                <strong>{formatNumber(team.total_points)}</strong>
              </div>
            ))}

            {!topTeams.length && (
              <EmptyState message="No standings available." />
            )}
          </div>
        </article>
      </section >

      <section className="content-grid lower-grid">
        <article className="panel">
          <SectionHeading
            eyebrow="MATCH FEED"
            title="Recent matches"
            action={
              <button
                className="text-button"
                onClick={() => onNavigate('Match History')}
              >
                Full history →
              </button>
            }
          />

          <div className="match-list">
            {recentMatches.map((match) => (
              <div
                className="match-row"
                key={match.match_id ?? match.sequence_number}
              >
                <span className="match-number">
                  #
                  {String(
                    match.sequence_number ?? match.match_id ?? '?',
                  ).padStart(2, '0')}
                </span>

                <div className="match-info">
                  <strong>{match.map ?? 'Unknown map'}</strong>
                  <small>
                    Day {match.day ?? '—'} · Match{' '}
                    {match.match_number ?? '—'}
                  </small>
                </div>

                <span className="match-status">Recorded</span>
              </div>
            ))}

            {!recentMatches.length && (
              <EmptyState message="No match history available." />
            )}
          </div>
        </article>

        <article className="panel performance-panel">
          <div className="eyebrow">TEAM ANALYTICS</div>
          <h2>Recent form</h2>
          <p className="panel-subtitle">
            Points earned in the last five matches
          </p>

          <div className="form-list">
            {analytics
              .slice()
              .sort(
                (a, b) =>
                  b.last_5_matches_points -
                  a.last_5_matches_points,
              )
              .slice(0, 5)
              .map((team) => (
                <div className="form-row" key={team.team_id}>
                  <span className="form-name">{team.team_name}</span>

                  <div className="form-track">
                    <div
                      className="form-fill"
                      style={{
                        width: `${(team.last_5_matches_points /
                          maxRecentPoints) *
                          100
                          }%`,
                      }}
                    />
                  </div>

                  <strong>{team.last_5_matches_points}</strong>
                </div>
              ))}

            {!analytics.length && (
              <EmptyState message="Analytics are unavailable." />
            )}
          </div>
        </article>
      </section>
    </>
  )
}

/* =========================================================
   LEADERBOARD
========================================================= */

function Leaderboard({ teams, search, setSearch }) {
  const filteredTeams = teams.filter((team) =>
    team.team_name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <section className="panel table-panel">
      <SectionHeading
        eyebrow="TOURNAMENT STANDINGS"
        title="Team leaderboard"
        description="Rankings use total points, with eliminations as the secondary tiebreaker."
        action={
          <label className="search-box">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teams..."
              aria-label="Search teams"
            />

            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </label>
        }
      />

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>RANK</th>
              <th>TEAM</th>
              <th>MATCHES</th>
              <th>ELIMS</th>
              <th>PLACEMENT PTS</th>
              <th>TOTAL PTS</th>
              <th>AVG / MATCH</th>
            </tr>
          </thead>

          <tbody>
            {filteredTeams.map((team) => (
              <tr key={team.team_id ?? team.team_name}>
                <td>
                  <RankBadge rank={team.rank} />
                </td>

                <td>
                  <div className="table-team">
                    <span className="team-avatar">
                      {team.team_name.slice(0, 1).toUpperCase()}
                    </span>
                    <strong>{team.team_name}</strong>
                  </div>
                </td>

                <td>{team.matches_played}</td>
                <td>{formatNumber(team.eliminations)}</td>
                <td>{formatNumber(team.placement_points)}</td>
                <td className="points-cell">
                  {formatNumber(team.total_points)}
                </td>
                <td>{team.average_points_per_match.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filteredTeams.length && (
          <EmptyState message="No matching teams found." />
        )}
      </div>

      <div className="table-footer">
        Showing {filteredTeams.length} of {teams.length} teams
      </div>
    </section>
  )
}

/* =========================================================
   MATCH HISTORY
========================================================= */

function MatchHistory({ matches }) {
  const [dayFilter, setDayFilter] = useState('all')
  const [mapFilter, setMapFilter] = useState('all')
  const [expandedMatch, setExpandedMatch] = useState(null)

  const days = [
    ...new Set(matches.map((match) => String(match.day ?? ''))),
  ].filter(Boolean)

  const maps = [
    ...new Set(matches.map((match) => match.map).filter(Boolean)),
  ]

  const filteredMatches = matches
    .filter((match) => {
      const dayMatches =
        dayFilter === 'all' || String(match.day) === dayFilter

      const mapMatches =
        mapFilter === 'all' || match.map === mapFilter

      return dayMatches && mapMatches
    })
    .sort(
      (a, b) =>
        numeric(a.sequence_number ?? a.match_id) -
        numeric(b.sequence_number ?? b.match_id),
    )

  return (
    <section className="panel table-panel">
      <div className="panel-heading table-heading">
        <div>
          <div className="eyebrow">TOURNAMENT ARCHIVE</div>
          <h2>Match history</h2>
          <p>Browse matches and inspect individual team results.</p>
        </div>

        <div className="filter-group">
          <label className="select-box">
            <span>Day</span>
            <select
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
            >
              <option value="all">All days</option>
              {days
                .sort((a, b) => Number(a) - Number(b))
                .map((day) => (
                  <option value={day} key={day}>
                    Day {day}
                  </option>
                ))}
            </select>
            <ChevronDown size={15} />
          </label>

          <label className="select-box">
            <span>Map</span>
            <select
              value={mapFilter}
              onChange={(event) => setMapFilter(event.target.value)}
            >
              <option value="all">All maps</option>
              {maps.map((map) => (
                <option value={map} key={map}>
                  {map}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
      </div>

      <div className="match-history-grid">
        {filteredMatches.map((match) => {
          const results = [...(match.results ?? [])].sort(
            (a, b) =>
              numeric(a.placement, 99) -
              numeric(b.placement, 99),
          )

          const matchKey = match.match_id ?? match.sequence_number
          const isExpanded = expandedMatch === matchKey

          return (
            <article
              className={`history-card ${isExpanded ? 'history-card-expanded' : ''
                }`}
              key={matchKey}
            >
              <div className="history-card-top">
                <span className="history-map">
                  {match.map ?? 'Unknown map'}
                </span>
                <span className="history-day">
                  DAY {match.day ?? '—'}
                </span>
              </div>

              <h3>
                Match {match.match_number ?? match.sequence_number ?? '—'}
              </h3>

              <div className="history-meta">
                {results.length || match.teams_count || 0} teams recorded
              </div>

              <div className="history-divider" />

              {results.slice(0, 3).map((result, index) => (
                <div
                  className="history-team"
                  key={result.team_id ?? index}
                >
                  <span className="history-place">
                    {result.placement ?? index + 1}
                  </span>
                  <span>{result.team_name ?? 'Unknown team'}</span>
                  <strong>
                    {formatNumber(result.total_points)} pts
                  </strong>
                </div>
              ))}

              {isExpanded && results.length > 0 && (
                <div className="expanded-results">
                  <div className="expanded-results-heading">
                    <span>TEAM</span>
                    <span>ELIMS</span>
                    <span>PLACE PTS</span>
                    <span>TOTAL</span>
                  </div>

                  {results.map((result, index) => (
                    <div
                      className="expanded-result-row"
                      key={result.team_id ?? index}
                    >
                      <span>
                        <b>{result.placement ?? index + 1}</b>
                        {result.team_name}
                      </span>
                      <span>{numeric(result.eliminations)}</span>
                      <span>{numeric(result.placement_points)}</span>
                      <strong>{numeric(result.total_points)}</strong>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="expand-match-button"
                onClick={() =>
                  setExpandedMatch(isExpanded ? null : matchKey)
                }
              >
                {isExpanded ? 'Show less' : 'View all team results'}
                <ChevronDown
                  size={15}
                  className={isExpanded ? 'chevron-up' : ''}
                />
              </button>
            </article>
          )
        })}
      </div>

      {!filteredMatches.length && (
        <EmptyState message="No matches match these filters." />
      )}
    </section>
  )
}

/* =========================================================
   TEAM ANALYTICS
========================================================= */

function TeamAnalytics({ analytics }) {
  return (
    <section className="panel table-panel">
      <SectionHeading
        eyebrow="PERFORMANCE BREAKDOWN"
        title="Team analytics"
        description="Compare average performance, wins and recent form."
      />

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>RANK</th>
              <th>TEAM</th>
              <th>MATCHES</th>
              <th>AVG PTS</th>
              <th>AVG ELIMS</th>
              <th>AVG PLACE</th>
              <th>BEST PLACE</th>
              <th>WINS</th>
              <th>LAST 5 PTS</th>
            </tr>
          </thead>

          <tbody>
            {analytics.map((team) => (
              <tr key={team.team_id ?? team.team_name}>
                <td><RankBadge rank={team.rank} /></td>
                <td><strong>{team.team_name}</strong></td>
                <td>{team.matches_played}</td>
                <td>{team.average_points_per_match.toFixed(2)}</td>
                <td>{team.average_eliminations_per_match.toFixed(2)}</td>
                <td>{team.average_placement ?? '—'}</td>
                <td>{team.best_placement ?? '—'}</td>
                <td>{team.first_place_finishes}</td>
                <td className="points-cell">
                  {team.last_5_matches_points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!analytics.length && (
          <EmptyState message="No team analytics available." />
        )}
      </div>
    </section>
  )
}

/* =========================================================
   TEAM DETAILS
========================================================= */

function TeamDetails({ teams, matches }) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [chartMetric, setChartMetric] = useState('points')

  useEffect(() => {
    if (
      teams.length &&
      !teams.some(
        (team) => String(team.team_id) === selectedTeamId,
      )
    ) {
      setSelectedTeamId(String(teams[0].team_id ?? ''))
    }
  }, [teams, selectedTeamId])

  const selectedTeam = teams.find(
    (team) => String(team.team_id) === selectedTeamId,
  ) ?? teams[0]

  const teamMatches = useMemo(() => {
  if (!selectedTeam) return []

  return matches
    .map((match, index) => {
      const result = (match.results ?? []).find(
        (item) =>
          String(item.team_id) === String(selectedTeam.team_id) ||
          item.team_name === selectedTeam.team_name,
      )

      return result
        ? {
            ...match,
            result,
            day: numeric(match.day ?? match.day_number),
            map: match.map ?? match.map_name ?? 'Unknown',
            match_number: match.match_number ?? index + 1,
          }
        : null
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        numeric(a.sequence_number ?? a.match_id) -
        numeric(b.sequence_number ?? b.match_id),
    )
}, [matches, selectedTeam])

  const chartData = useMemo(
    () =>
      teamMatches.map((match, index) => ({
        match: `M${match.match_number ?? index + 1}`,
        points: numeric(match.result.total_points),
        eliminations: numeric(match.result.eliminations),
        placement: numeric(match.result.placement),
        day: numeric(match.day),
        map: match.map ?? 'Unknown',
      })),
    [teamMatches],
  )

  const totalPoints = teamMatches.reduce(
    (sum, match) => sum + numeric(match.result.total_points),
    0,
  )

  const totalEliminations = teamMatches.reduce(
    (sum, match) => sum + numeric(match.result.eliminations),
    0,
  )

  const validPlacements = teamMatches
    .map((match) => numeric(match.result.placement))
    .filter((placement) => placement > 0)

  const averagePlacement = validPlacements.length
    ? (
      validPlacements.reduce((sum, placement) => sum + placement, 0) /
      validPlacements.length
    ).toFixed(2)
    : '—'

  const topFiveFinishes = validPlacements.filter(
    (placement) => placement <= 5,
  ).length

  const topFiveRate = teamMatches.length
    ? (topFiveFinishes / teamMatches.length) * 100
    : 0

  const bestMatch = teamMatches.length
    ? teamMatches.reduce((best, current) =>
      numeric(current.result.total_points) >
        numeric(best.result.total_points)
        ? current
        : best,
    )
    : null

  const worstMatch = teamMatches.length
    ? teamMatches.reduce((worst, current) =>
      numeric(current.result.total_points) <
        numeric(worst.result.total_points)
        ? current
        : worst,
    )
    : null

  const lastThree = teamMatches.slice(-3)
  const lastFive = teamMatches.slice(-5)

  const sumPoints = (items) =>
    items.reduce(
      (sum, match) => sum + numeric(match.result.total_points),
      0,
    )

const availableDays = [
  ...new Set(
    teamMatches
      .map((match) => numeric(match.day))
      .filter((day) => Number.isInteger(day) && day > 0),
  ),
].sort((a, b) => a - b)

const dailyPerformance = availableDays.map((day) => {
  const dayMatches = teamMatches.filter(
    (match) => numeric(match.day) === day,
  )

  return {
    day,
    matches: dayMatches.length,
    points: dayMatches.reduce(
      (sum, match) => sum + numeric(match.result.total_points),
      0,
    ),
    eliminations: dayMatches.reduce(
      (sum, match) => sum + numeric(match.result.eliminations),
      0,
    ),
  }
})

  const maxDailyPoints = Math.max(
    1,
    ...dailyPerformance.map((day) => day.points),
  )

  const chartLabels = {
    points: 'Points per match',
    eliminations: 'Eliminations per match',
    placement: 'Finishing placement',
  }

  if (!teams.length) {
    return (
      <section className="panel">
        <EmptyState message="Load team standings before viewing team details." />
      </section>
    )
  }

  return (
    <div className="team-details-page">
      <section className="panel team-selector-panel">
        <div>
          <div className="eyebrow">TEAM INTELLIGENCE</div>
          <h2>Select a team</h2>
          <p className="panel-subtitle">
            Explore individual tournament performance.
          </p>
        </div>

        <label className="select-box team-selector">
          <span>TEAM</span>
          <select
            value={String(selectedTeam?.team_id ?? '')}
            onChange={(event) => setSelectedTeamId(event.target.value)}
          >
            {teams.map((team) => (
              <option
                key={team.team_id ?? team.team_name}
                value={String(team.team_id ?? '')}
              >
                {team.team_name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
      </section>

      {selectedTeam && (
        <>
          <section className="panel team-profile">
            <div className="team-profile-icon">
              <Shield size={28} />
            </div>

            <div className="team-profile-info">
              <div className="eyebrow">TOURNAMENT TEAM PROFILE</div>
              <h2>{selectedTeam.team_name}</h2>
              <p>
                Overall rank #{selectedTeam.rank} · {teamMatches.length} matches recorded
              </p>
            </div>

            <div className="team-profile-rank">
              <span>OVERALL RANK</span>
              <strong>#{selectedTeam.rank}</strong>
            </div>
          </section>

          <section className="metric-grid">
            <MetricCard
              label="Total points"
              value={formatNumber(totalPoints)}
              description="Points across recorded matches"
              icon={Trophy}
            />
            <MetricCard
              label="Eliminations"
              value={formatNumber(totalEliminations)}
              description="Total player eliminations"
              icon={Crosshair}
              accent="orange"
            />
            <MetricCard
              label="Average placement"
              value={averagePlacement}
              description="Lower is better"
              icon={Activity}
              accent="purple"
            />
            <MetricCard
              label="Top-five rate"
              value={`${topFiveRate.toFixed(1)}%`}
              description={`${topFiveFinishes} top-five finishes`}
              icon={Zap}
              accent="blue"
            />
          </section>

          <section className="team-highlight-grid">
            <article className="panel team-highlight-card">
              <div className="highlight-card-icon best">
                <Trophy size={20} />
              </div>
              <div className="highlight-card-content">
                <div className="eyebrow">BEST MATCH</div>
                <h3>
                  {bestMatch
                    ? `Match ${bestMatch.match_number}`
                    : 'No data'}
                </h3>
                <p>
                  {bestMatch
                    ? `${bestMatch.map ?? 'Unknown map'} · Place #${numeric(bestMatch.result.placement)}`
                    : 'No match records available'}
                </p>
              </div>
              <strong className="highlight-points">
                {bestMatch
                  ? `${numeric(bestMatch.result.total_points)} pts`
                  : '—'}
              </strong>
            </article>

            <article className="panel team-highlight-card">
              <div className="highlight-card-icon worst">
                <Activity size={20} />
              </div>
              <div className="highlight-card-content">
                <div className="eyebrow">LOWEST-SCORING MATCH</div>
                <h3>
                  {worstMatch
                    ? `Match ${worstMatch.match_number}`
                    : 'No data'}
                </h3>
                <p>
                  {worstMatch
                    ? `${worstMatch.map ?? 'Unknown map'} · Place #${numeric(worstMatch.result.placement)}`
                    : 'No match records available'}
                </p>
              </div>
              <strong className="highlight-points">
                {worstMatch
                  ? `${numeric(worstMatch.result.total_points)} pts`
                  : '—'}
              </strong>
            </article>
          </section>

          <section className="panel team-chart-panel">
            <div className="team-chart-header">
              <SectionHeading
                eyebrow="PERFORMANCE TREND"
                title="Match-by-match analysis"
                description={chartLabels[chartMetric]}
              />

              <div className="team-chart-controls">
                {Object.entries(chartLabels).map(([key, label]) => (
                  <button
                    type="button"
                    key={key}
                    className={`team-chart-toggle ${chartMetric === key ? 'active' : ''
                      }`}
                    onClick={() => setChartMetric(key)}
                  >
                    {label === 'Eliminations per match'
                      ? 'Eliminations'
                      : label === 'Finishing placement'
                        ? 'Placement'
                        : 'Points'}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length ? (
              <div className="chart-container team-details-chart">
                <Suspense
                  fallback={
                    <div className="empty-state">Loading team performance...</div>
                  }
                >
                  <PerformanceChart
                    data={chartData}
                    dataKey={chartMetric}
                    xAxisKey="match"
                    gradientId="teamDetailsGradient"
                    chartLabel={chartLabels[chartMetric]}
                    reversed={chartMetric === 'placement'}
                    allowDecimals={chartMetric === 'placement'}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload

                      return item
                        ? `${label} · Day ${item.day} · ${item.map}`
                        : label
                    }}
                  />
                </Suspense>
              </div>
            ) : (
              <EmptyState message="No match results found for this team." />
            )}

            {chartMetric === 'placement' && (
              <p className="chart-note">
                Finishing placement: 1 is best, and larger numbers indicate a lower finish.
              </p>
            )}
          </section>

          <section className="panel daily-performance-panel">
            <SectionHeading
              eyebrow="DAY-BY-DAY BREAKDOWN"
              title="Daily performance"
              description="Compare points and eliminations across tournament days."
            />

            <div className="team-day-grid">
              {dailyPerformance.map((day) => (
                <article className="team-day-card" key={day.day}>
                  <div className="team-day-heading">
                    <span>DAY {day.day}</span>
                    <strong>{day.points} pts</strong>
                  </div>

                  <div className="team-day-bar-track">
                    <div
                      className="team-day-bar"
                      style={{
                        width: `${(day.points / maxDailyPoints) * 100}%`,
                      }}
                    />
                  </div>

                  <div className="team-day-footer">
                    <span>{day.matches} matches</span>
                    <span>{day.eliminations} eliminations</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel team-form-panel">
            <SectionHeading
              eyebrow="RECENT FORM"
              title="Scoring snapshot"
              description="Points earned in the team's most recent matches."
            />

            <div className="team-form-stats-grid">
              <div className="team-form-stat">
                <span>Last 3 matches</span>
                <strong>{sumPoints(lastThree)} pts</strong>
              </div>
              <div className="team-form-stat">
                <span>Last 5 matches</span>
                <strong>{sumPoints(lastFive)} pts</strong>
              </div>
              <div className="team-form-stat">
                <span>Points per match</span>
                <strong>
                  {teamMatches.length
                    ? (totalPoints / teamMatches.length).toFixed(2)
                    : '0.00'}
                </strong>
              </div>
              <div className="team-form-stat">
                <span>Eliminations per match</span>
                <strong>
                  {teamMatches.length
                    ? (totalEliminations / teamMatches.length).toFixed(2)
                    : '0.00'}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel table-panel team-match-table-panel">
            <div className="table-heading">
              <div className="eyebrow">MATCH RECORDS</div>
              <h2>Match-by-match performance</h2>
              <p className="panel-subtitle">
                Wins and top-five finishes are highlighted.
              </p>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MATCH</th>
                    <th>DAY</th>
                    <th>MAP</th>
                    <th>PLACE</th>
                    <th>ELIMS</th>
                    <th>PLACEMENT PTS</th>
                    <th>TOTAL PTS</th>
                    <th>RESULT</th>
                  </tr>
                </thead>

                <tbody>
                  {teamMatches.map((match, index) => {
                    const placement = numeric(match.result.placement)
                    const isWin = placement === 1
                    const isTopFive = placement >= 2 && placement <= 5

                    return (
                      <tr
                        key={`${match.match_id}-${selectedTeam.team_id}`}
                        className={
                          isWin
                            ? 'team-match-row-win'
                            : isTopFive
                              ? 'team-match-row-top5'
                              : ''
                        }
                      >
                        <td>
                          <strong>
                            M{match.match_number ?? index + 1}
                          </strong>
                        </td>
                        <td>{match.day ?? '—'}</td>
                        <td>{match.map ?? '—'}</td>
                        <td>
                          <span
                            className={`placement-pill ${isWin
                              ? 'placement-win'
                              : isTopFive
                                ? 'placement-top5'
                                : ''
                              }`}
                          >
                            {placement ? `#${placement}` : '—'}
                          </span>
                        </td>
                        <td>{numeric(match.result.eliminations)}</td>
                        <td>{numeric(match.result.placement_points)}</td>
                        <td className="points-cell">
                          {numeric(match.result.total_points)}
                        </td>
                        <td>
                          {isWin ? (
                            <span className="team-match-badge win">WIN</span>
                          ) : isTopFive ? (
                            <span className="team-match-badge top5">TOP 5</span>
                          ) : (
                            <span className="team-match-badge">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {!teamMatches.length && (
                <EmptyState message="No match records found for this team." />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/* =========================================================
   TEAM COMPARISON 2.0
========================================================= */

function TeamComparison({ teams, matches }) {
  const [teamAId, setTeamAId] = useState('')
  const [teamBId, setTeamBId] = useState('')

  useEffect(() => {
    if (teams.length < 2) return

    setTeamAId((current) =>
      teams.some((team) => String(team.team_id) === current)
        ? current
        : String(teams[0].team_id),
    )

    setTeamBId((current) =>
      teams.some((team) => String(team.team_id) === current)
        ? current
        : String(teams[1].team_id),
    )
  }, [teams])

  const teamA = teams.find(
    (team) => String(team.team_id) === teamAId,
  )

  const teamB = teams.find(
    (team) => String(team.team_id) === teamBId,
  )

  const getTeamStats = (team) => {
    if (!team) return null

    const results = matches
      .map((match, index) => {
        const result = (match.results ?? []).find(
          (item) =>
            String(item.team_id) === String(team.team_id) ||
            item.team_name === team.team_name,
        )

        if (!result) return null

        return {
          ...match,
          result,
          displayMatch:
            match.match_number ??
            match.sequence_number ??
            index + 1,
        }
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          numeric(a.sequence_number ?? a.match_id) -
          numeric(b.sequence_number ?? b.match_id),
      )

    const placements = results
      .map((match) => numeric(match.result.placement))
      .filter((placement) => placement > 0)

    const points = results.reduce(
      (sum, match) => sum + numeric(match.result.total_points),
      0,
    )

    const eliminations = results.reduce(
      (sum, match) => sum + numeric(match.result.eliminations),
      0,
    )

    const wins = placements.filter(
      (placement) => placement === 1,
    ).length

    const topFive = placements.filter(
      (placement) => placement <= 5,
    ).length

    return {
      results,
      matchesPlayed: results.length,
      points,
      eliminations,
      placementPoints: results.reduce(
        (sum, match) =>
          sum + numeric(match.result.placement_points),
        0,
      ),
      averagePoints: results.length
        ? points / results.length
        : 0,
      averageEliminations: results.length
        ? eliminations / results.length
        : 0,
      averagePlacement: placements.length
        ? placements.reduce((sum, value) => sum + value, 0) /
        placements.length
        : 0,
      wins,
      topFive,
      winRate: results.length
        ? (wins / results.length) * 100
        : 0,
      topFiveRate: results.length
        ? (topFive / results.length) * 100
        : 0,
    }
  }

  const statsA = useMemo(
    () => getTeamStats(teamA),
    [matches, teamA],
  )

  const statsB = useMemo(
    () => getTeamStats(teamB),
    [matches, teamB],
  )

  const metrics = [
    {
      label: 'Matches played',
      key: 'matchesPlayed',
      better: 'higher',
    },
    {
      label: 'Total points',
      key: 'points',
      better: 'higher',
    },
    {
      label: 'Total eliminations',
      key: 'eliminations',
      better: 'higher',
    },
    {
      label: 'Placement points',
      key: 'placementPoints',
      better: 'higher',
    },
    {
      label: 'Average points per match',
      key: 'averagePoints',
      better: 'higher',
      decimals: 2,
    },
    {
      label: 'Average eliminations per match',
      key: 'averageEliminations',
      better: 'higher',
      decimals: 2,
    },
    {
      label: 'Average placement',
      key: 'averagePlacement',
      better: 'lower',
      decimals: 2,
    },
    {
      label: 'Match wins',
      key: 'wins',
      better: 'higher',
    },
    {
      label: 'Win rate',
      key: 'winRate',
      better: 'higher',
      suffix: '%',
      decimals: 1,
    },
    {
      label: 'Top-five finishes',
      key: 'topFive',
      better: 'higher',
    },
    {
      label: 'Top-five rate',
      key: 'topFiveRate',
      better: 'higher',
      suffix: '%',
      decimals: 1,
    },
  ]

  const comparison = metrics.map((metric) => {
    const valueA = statsA?.[metric.key] ?? 0
    const valueB = statsB?.[metric.key] ?? 0

    let winner = 'tie'

    if (valueA !== valueB) {
      winner =
        metric.better === 'lower'
          ? valueA < valueB
            ? 'a'
            : 'b'
          : valueA > valueB
            ? 'a'
            : 'b'
    }

    const formatValue = (value) => {
      const formatted = numeric(value).toFixed(metric.decimals ?? 0)
      return metric.suffix ? `${formatted}${metric.suffix}` : formatted
    }

    return {
      ...metric,
      valueA,
      valueB,
      winner,
      formattedA: formatValue(valueA),
      formattedB: formatValue(valueB),
    }
  })

  const winsA = comparison.filter(
    (metric) => metric.winner === 'a',
  ).length

  const winsB = comparison.filter(
    (metric) => metric.winner === 'b',
  ).length

  const dailyData = [1, 2, 3].map((day) => {
    const getDayStats = (stats) => {
      const dayMatches =
        stats?.results.filter(
          (match) => numeric(match.day) === day,
        ) ?? []

      return {
        points: dayMatches.reduce(
          (sum, match) => sum + numeric(match.result.total_points),
          0,
        ),
        eliminations: dayMatches.reduce(
          (sum, match) => sum + numeric(match.result.eliminations),
          0,
        ),
        matches: dayMatches.length,
      }
    }

    return {
      day,
      a: getDayStats(statsA),
      b: getDayStats(statsB),
    }
  })

  const matchComparison = useMemo(() => {
    if (!statsA || !statsB) return []

    const resultsB = new Map(
      statsB.results.map((match) => [
        String(
          match.source_match_id ??
          match.match_id ??
          match.sequence_number,
        ),
        match,
      ]),
    )

    return statsA.results
      .map((match) => {
        const key = String(
          match.source_match_id ??
          match.match_id ??
          match.sequence_number,
        )

        const opponentMatch = resultsB.get(key)
        if (!opponentMatch) return null

        const pointsA = numeric(match.result.total_points)
        const pointsB = numeric(opponentMatch.result.total_points)

        return {
          key,
          matchNumber: match.displayMatch,
          day: match.day,
          map: match.map,
          pointsA,
          pointsB,
          difference: Math.abs(pointsA - pointsB),
          winner:
            pointsA === pointsB
              ? 'tie'
              : pointsA > pointsB
                ? 'a'
                : 'b',
        }
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          numeric(a.matchNumber) - numeric(b.matchNumber),
      )
  }, [statsA, statsB])

  if (teams.length < 2) {
    return (
      <section className="panel">
        <EmptyState message="At least two teams are required for comparison." />
      </section>
    )
  }

  const renderTeamOptions = (excludedId) =>
    teams.map((team) => (
      <option
        key={team.team_id}
        value={String(team.team_id)}
        disabled={String(team.team_id) === excludedId}
      >
        {team.team_name}
      </option>
    ))

  return (
    <div className="team-comparison-page">
      <section className="panel comparison-selector-panel">
        <SectionHeading
          eyebrow="HEAD-TO-HEAD ANALYTICS"
          title="Team Comparison"
          description="Compare two teams across the tournament."
        />

        <div className="comparison-selectors">
          <label className="comparison-team-select team-a-select">
            <span>TEAM A</span>
            <select
              value={teamAId}
              onChange={(event) => setTeamAId(event.target.value)}
            >
              {renderTeamOptions(teamBId)}
            </select>
          </label>

          <div className="comparison-vs">VS</div>

          <label className="comparison-team-select team-b-select">
            <span>TEAM B</span>
            <select
              value={teamBId}
              onChange={(event) => setTeamBId(event.target.value)}
            >
              {renderTeamOptions(teamAId)}
            </select>
          </label>
        </div>
      </section>

      {teamA && teamB && statsA && statsB && (
        <>
          <section className="comparison-scoreboard">
            <article className="panel comparison-team-card team-a-card">
              <div className="comparison-team-symbol">
                <Shield size={25} />
              </div>

              <span className="eyebrow">
                TEAM A · RANK #{teamA.rank}
              </span>

              <h2>{teamA.team_name}</h2>

              <strong className="comparison-total">
                {formatNumber(statsA.points)}
              </strong>

              <span className="comparison-total-label">
                TOTAL POINTS
              </span>

              <div className="comparison-mini-stats">
                <span>{statsA.eliminations} eliminations</span>
                <span>{statsA.wins} wins</span>
              </div>
            </article>

            <div className="comparison-middle">
              <span>METRIC SCORE</span>

              <strong>
                {winsA} : {winsB}
              </strong>

              <p>
                {winsA > winsB
                  ? `${teamA.team_name} leads more metrics`
                  : winsB > winsA
                    ? `${teamB.team_name} leads more metrics`
                    : 'Metrics are tied'}
              </p>

              <small>
                A comparison aid, not an official ranking.
              </small>
            </div>

            <article className="panel comparison-team-card team-b-card">
              <div className="comparison-team-symbol second">
                <Shield size={25} />
              </div>

              <span className="eyebrow">
                TEAM B · RANK #{teamB.rank}
              </span>

              <h2>{teamB.team_name}</h2>

              <strong className="comparison-total">
                {formatNumber(statsB.points)}
              </strong>

              <span className="comparison-total-label">
                TOTAL POINTS
              </span>

              <div className="comparison-mini-stats">
                <span>{statsB.eliminations} eliminations</span>
                <span>{statsB.wins} wins</span>
              </div>
            </article>
          </section>

          <section className="panel comparison-table-panel">
            <SectionHeading
              eyebrow="STATISTICAL BREAKDOWN"
              title="Performance comparison"
              description="Green highlights indicate the better result for each metric."
            />

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>METRIC</th>
                    <th>{teamA.team_name}</th>
                    <th>{teamB.team_name}</th>
                    <th>ADVANTAGE</th>
                  </tr>
                </thead>

                <tbody>
                  {comparison.map((metric) => (
                    <tr key={metric.key}>
                      <td>{metric.label}</td>

                      <td
                        className={
                          metric.winner === 'a'
                            ? 'comparison-winner'
                            : ''
                        }
                      >
                        {metric.formattedA}
                      </td>

                      <td
                        className={
                          metric.winner === 'b'
                            ? 'comparison-winner'
                            : ''
                        }
                      >
                        {metric.formattedB}
                      </td>

                      <td>
                        {metric.winner === 'tie'
                          ? 'Tie'
                          : metric.winner === 'a'
                            ? teamA.team_name
                            : teamB.team_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel daily-performance-panel">
            <SectionHeading
              eyebrow="DAY-BY-DAY COMPARISON"
              title="Daily points race"
              description="Compare tournament performance across all three days."
            />

            <div className="comparison-daily-grid">
              {dailyData.map((day) => {
                const max = Math.max(
                  day.a.points,
                  day.b.points,
                  1,
                )

                return (
                  <article className="team-day-card" key={day.day}>
                    <div className="team-day-heading">
                      <span>DAY {day.day}</span>
                    </div>

                    <div className="comparison-daily-team">
                      <span>{teamA.team_name}</span>
                      <strong>{day.a.points}</strong>
                    </div>

                    <div className="comparison-bar-track">
                      <div
                        className="comparison-bar team-a-bar"
                        style={{
                          width: `${(day.a.points / max) * 100}%`,
                        }}
                      />
                    </div>

                    <div className="comparison-daily-team">
                      <span>{teamB.team_name}</span>
                      <strong>{day.b.points}</strong>
                    </div>

                    <div className="comparison-bar-track">
                      <div
                        className="comparison-bar team-b-bar"
                        style={{
                          width: `${(day.b.points / max) * 100}%`,
                        }}
                      />
                    </div>

                    <div className="comparison-day-result">
                      {day.a.points === day.b.points
                        ? 'Day tied'
                        : day.a.points > day.b.points
                          ? `${teamA.team_name} leads`
                          : `${teamB.team_name} leads`}
                    </div>

                    <div className="comparison-day-meta">
                      {day.a.matches} vs {day.b.matches} matches
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="panel comparison-match-panel">
            <SectionHeading
              eyebrow="MATCH-BY-MATCH BREAKDOWN"
              title="Same-match score comparison"
              description="Compare both teams' points in each recorded match. This is a score comparison, not a direct in-game head-to-head."
            />

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MATCH</th>
                    <th>DAY</th>
                    <th>MAP</th>
                    <th>{teamA.team_name}</th>
                    <th>{teamB.team_name}</th>
                    <th>DIFFERENCE</th>
                    <th>HIGHER SCORE</th>
                  </tr>
                </thead>

                <tbody>
                  {matchComparison.map((match) => (
                    <tr key={match.key}>
                      <td>M{match.matchNumber}</td>
                      <td>{match.day ?? '—'}</td>
                      <td>{match.map ?? '—'}</td>

                      <td
                        className={
                          match.winner === 'a'
                            ? 'comparison-winner'
                            : ''
                        }
                      >
                        {match.pointsA}
                      </td>

                      <td
                        className={
                          match.winner === 'b'
                            ? 'comparison-winner'
                            : ''
                        }
                      >
                        {match.pointsB}
                      </td>

                      <td>{match.difference}</td>

                      <td>
                        {match.winner === 'tie'
                          ? 'Tie'
                          : match.winner === 'a'
                            ? teamA.team_name
                            : teamB.team_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!matchComparison.length && (
                <EmptyState message="No matching match records found for both teams." />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/* =========================================================
   DATA MANAGEMENT
========================================================= */

function DataManagement() {
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const [tournamentStatus, setTournamentStatus] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  const selectedTournamentData = tournaments.find(
    (tournament) =>
      String(tournament.id ?? tournament.tournament_id) ===
      String(selectedTournament),
  )

  const hasExistingMatches =
    numeric(
      tournamentStatus?.matches_count ??
      tournamentStatus?.total_matches ??
      tournamentStatus?.matches,
    ) > 0
  const importDebug = {
    selectedTournament,
    tournamentName: selectedTournamentData?.name,
    tournamentStatus,
    hasExistingMatches,
    loadingStatus,
    fileSelected: Boolean(file),
    previewValid: preview?.valid,
    previewErrors: preview?.error_count,
    previewRows: preview?.valid_rows,
  }

  console.log('CSV Import Debug:', importDebug)

  const parseError = async (response) => {
    try {
      const data = await response.json()

      if (typeof data.detail === 'string') return data.detail

      if (Array.isArray(data.detail)) {
        return data.detail
          .map((item) => item.msg ?? JSON.stringify(item))
          .join('; ')
      }

      return (
        data.message ??
        JSON.stringify(data.detail ?? data) ??
        `Request failed (${response.status})`
      )
    } catch {
      return `Request failed (${response.status})`
    }
  }

  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/tournaments/`)

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const data = await response.json()

      const list = Array.isArray(data)
        ? data
        : data.tournaments ?? data.data ?? []

      setTournaments(list)

      setSelectedTournament((current) => {
        if (
          current &&
          list.some(
            (item) =>
              String(item.id ?? item.tournament_id) === current,
          )
        ) {
          return current
        }

        const defaultTournament = list.find(
          (item) =>
            String(item.id ?? item.tournament_id) ===
            String(TOURNAMENT_ID),
        )

        const firstTournament = list[0]

        return String(
          defaultTournament?.id ??
          defaultTournament?.tournament_id ??
          firstTournament?.id ??
          firstTournament?.tournament_id ??
          '',
        )
      })
    } catch (err) {
      setError(
        `Could not load tournaments. ${err.message}`,
      )
    } finally {
      setLoadingTournaments(false)
    }
  }, [])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  useEffect(() => {
    if (!selectedTournament) {
      setTournamentStatus(null)
      return
    }

    let cancelled = false

    async function loadStatus() {
      setLoadingStatus(true)
      setTournamentStatus(null)

      try {
        const response = await fetch(
          `${API_URL}/api/import/tournaments/${selectedTournament}/status`,
        )

        if (!response.ok) {
          throw new Error(await parseError(response))
        }

        const data = await response.json()

        if (!cancelled) {
          setTournamentStatus(data)
        }
      } catch {
        if (!cancelled) {
          setTournamentStatus(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false)
        }
      }
    }

    loadStatus()

    return () => {
      cancelled = true
    }
  }, [selectedTournament])

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0] ?? null

    setFile(null)
    setPreview(null)
    setImportResult(null)
    setError('')
    setNotice('')

    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.')
      event.target.value = ''
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('The file exceeds the 10 MB upload limit.')
      event.target.value = ''
      return
    }

    setFile(selectedFile)
  }

  async function handlePreview() {
    if (!file) {
      setError('Choose a CSV file before previewing.')
      return
    }

    if (!selectedTournament) {
      setError('Select a tournament first.')
      return
    }

    setPreviewing(true)
    setPreview(null)
    setImportResult(null)
    setError('')
    setNotice('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(
        `${API_URL}/api/import/tournaments/${selectedTournament}/preview`,
        {
          method: 'POST',
          body: formData,
        },
      )

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const data = await response.json()

      setPreview(data)

      if (data.valid && numeric(data.error_count) === 0) {
        setNotice('Validation completed. Review the preview before importing.')
      } else {
        setError('The file contains validation errors. Correct them before importing.')
      }
    } catch (err) {
      setError(`Preview failed. ${err.message}`)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleImport() {
    if (!file || !preview || !selectedTournament) {
      setError('Select a file and preview it before importing.')
      return
    }

    if (!preview.valid || numeric(preview.error_count) > 0) {
      setError('Import blocked because the preview contains validation errors.')
      return
    }

    if (hasExistingMatches) {
      setError(
        'This tournament already contains match data. Choose an empty tournament to avoid accidental duplicate imports.',
      )
      return
    }

    const confirmed = window.confirm(
      `Import ${preview.valid_rows} result rows into "${selectedTournamentData?.name ?? selectedTournamentData?.tournament_name ?? 'the selected tournament'}"? This action will write data to the database.`,
    )

    if (!confirmed) return

    setImporting(true)
    setError('')
    setNotice('')
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const params = new URLSearchParams({
        tournament_id: selectedTournament,
      })

      const game =
        selectedTournamentData?.game ??
        selectedTournamentData?.game_name

      if (game) params.set('game', game)

      const response = await fetch(
        `${API_URL}/api/import/import?${params.toString()}`,
        {
          method: 'POST',
          body: formData,
        },
      )

      if (!response.ok) {
        throw new Error(await parseError(response))
      }

      const data = await response.json()

      setImportResult(data)

      if (data.archive_status === 'saved') {
        setNotice(
          `Import completed successfully. CSV archived as ${data.saved_filename}.`,
        )
      } else if (data.archive_status === 'failed') {
        setNotice(
          'Import succeeded, but CSV archiving failed. The database data was saved.',
        )
      } else {
        setNotice('Import completed successfully.')
      }

      setPreview(null)
      setFile(null)

      setTournamentStatus(null)

      await loadTournaments()

    } catch (err) {
      setError(`Import failed. ${err.message}`)
    } finally {
      setImporting(false)
    }
  }

  const previewRows = preview?.preview ?? []

  return (
    <div className="data-management-page">
      <section className="panel">
        <SectionHeading
          eyebrow="DATA OPERATIONS"
          title="Import tournament results"
          description="Upload a match-results CSV, validate the data, inspect a preview, and import it into an empty tournament."
        />

        <div className="data-import-grid">
          <div className="data-import-field">
            <label htmlFor="import-tournament">
              Destination tournament
            </label>

            <select
              id="import-tournament"
              value={selectedTournament}
              disabled={loadingTournaments || importing}
              onChange={(event) => {
                setSelectedTournament(event.target.value)
                setPreview(null)
                setImportResult(null)
                setError('')
                setNotice('')
              }}
            >
              <option value="">
                {loadingTournaments
                  ? 'Loading tournaments…'
                  : 'Select a tournament'}
              </option>

              {tournaments.map((tournament) => {
                const id =
                  tournament.id ?? tournament.tournament_id

                return (
                  <option key={id} value={String(id)}>
                    {tournament.name ??
                      tournament.tournament_name ??
                      tournament.slug ??
                      `Tournament ${id}`}
                  </option>
                )
              })}
            </select>

            {selectedTournamentData && (
              <small>
                Tournament ID:{' '}
                {selectedTournamentData.id ??
                  selectedTournamentData.tournament_id}
              </small>
            )}
          </div>

          <div className="data-import-field">
            <label htmlFor="import-csv">Match results CSV</label>

            <label
              className={`csv-dropzone ${file ? 'csv-dropzone-selected' : ''}`}
              htmlFor="import-csv"
            >
              <FileSpreadsheet size={29} />

              <strong>
                {file ? file.name : 'Choose a CSV file'}
              </strong>

              <span>
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : 'CSV format · Maximum 10 MB'}
              </span>

              <input
                id="import-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={importing}
              />
            </label>
          </div>
        </div>

        {loadingStatus && selectedTournament && (
          <div className="import-status-note">
            Checking the selected tournament…
          </div>
        )}

        {!loadingStatus && hasExistingMatches && (
          <div className="import-alert import-alert-warning">
            <AlertCircle size={19} />

            <div>
              <strong>Tournament already has match data</strong>
              <p>
                Select an empty tournament for this import. Existing
                match data will not be overwritten.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="import-alert import-alert-error" role="alert">
            <AlertCircle size={19} />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="import-alert import-alert-success" role="status">
            <CheckCircle2 size={19} />
            <p>{notice}</p>
          </div>
        )}

        <div className="import-actions">
          <button
            type="button"
            className="import-button import-button-secondary"
            onClick={handlePreview}
            disabled={
              !file ||
              !selectedTournament ||
              previewing ||
              importing
            }
          >
            {previewing ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Search size={17} />
            )}

            {previewing ? 'Validating CSV…' : 'Validate & preview'}
          </button>

          <button
            type="button"
            className="import-button import-button-primary"
            onClick={handleImport}
            disabled={
              !file ||
              !preview ||
              !preview.valid ||
              numeric(preview.error_count) > 0 ||
              importing ||
              previewing ||
              hasExistingMatches ||
              loadingStatus
            }
          >
            {importing ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Upload size={17} />
            )}

            {importing ? 'Importing…' : 'Import results'}
          </button>
        </div>
      </section>

      {preview && (
        <>
          <section className="import-summary-grid">
            <article className="panel import-summary-card">
              <span>Rows received</span>
              <strong>{formatNumber(preview.rows_received)}</strong>
            </article>

            <article className="panel import-summary-card">
              <span>Valid rows</span>
              <strong>{formatNumber(preview.valid_rows)}</strong>
            </article>

            <article className="panel import-summary-card">
              <span>Matches detected</span>
              <strong>{formatNumber(preview.matches_detected)}</strong>
            </article>

            <article className="panel import-summary-card">
              <span>Teams detected</span>
              <strong>{formatNumber(preview.teams_detected)}</strong>
            </article>
          </section>

          <section className="panel table-panel">
            <SectionHeading
              eyebrow="VALIDATION RESULTS"
              title="CSV preview"
              description={`Showing ${previewRows.length} sample rows. Check the values before importing.`}
              action={
                <span
                  className={`import-validation-badge ${preview.valid && numeric(preview.error_count) === 0
                    ? 'valid'
                    : 'invalid'
                    }`}
                >
                  {preview.valid && numeric(preview.error_count) === 0
                    ? 'VALID'
                    : `${numeric(preview.error_count)} ERRORS`}
                </span>
              }
            />

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>MATCH ID</th>
                    <th>DAY</th>
                    <th>MAP</th>
                    <th>MATCH</th>
                    <th>TEAM</th>
                    <th>PLACE</th>
                    <th>ELIMS</th>
                    <th>PLACEMENT PTS</th>
                    <th>TOTAL PTS</th>
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${row.match_id}-${row.team_name}-${index}`}>
                      <td>{row.match_id ?? '—'}</td>
                      <td>{row.day ?? '—'}</td>
                      <td>{row.map ?? '—'}</td>
                      <td>{row.match ?? '—'}</td>
                      <td><strong>{row.team_name ?? '—'}</strong></td>
                      <td>{row.placement ?? '—'}</td>
                      <td>{row.eliminations ?? '—'}</td>
                      <td>{row.placement_points ?? '—'}</td>
                      <td className="points-cell">{row.total_points ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!previewRows.length && (
                <EmptyState message="The API did not return preview rows." />
              )}
            </div>
          </section>
        </>
      )}

      {importResult && (
        <section className="panel import-complete-panel">
          <div className="import-complete-icon">
            <CheckCircle2 size={27} />
          </div>

          <div>
            <div className="eyebrow">IMPORT COMPLETE</div>
            <h2>Results imported successfully</h2>
            <p>
              {importResult.message ??
                'The CSV data was accepted by the import API.'}
            </p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={loadTournaments}
          >
            <RefreshCw size={16} />
            Refresh tournaments
          </button>
        </section>
      )}
    </div>
  )
}

/* =========================================================
   TOURNAMENT HOME
========================================================= */

function TournamentHome({ onAnalyze }) {
  const [tournaments, setTournaments] = useState([])
  const [statuses, setStatuses] = useState({})
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState(null);

  async function parseApiError(response) {
    try {
      const data = await response.json()
      if (typeof data.detail === 'string') return data.detail
      if (data.detail?.message) {
        const errors = data.detail.errors || []
        const first = errors[0]?.error
        return first
          ? `${data.detail.message} ${first}`
          : data.detail.message
      }
      if (Array.isArray(data.detail)) {
        return data.detail.map((item) => item.msg).join('; ')
      }
      return data.message || JSON.stringify(data)
    } catch {
      return `Request failed (${response.status})`
    }
  }

  async function loadTournaments() {
    setLoadingList(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/tournaments/`)
      if (!response.ok) throw new Error(await parseApiError(response))

      const data = await response.json()
      const list = Array.isArray(data) ? data : data.tournaments || []
      setTournaments(list)

      const statusEntries = await Promise.all(
        list.map(async (tournament) => {
          try {
            const statusResponse = await fetch(
              `${API_URL}/api/import/tournaments/${tournament.id}/status`,
            )
            if (!statusResponse.ok) return [tournament.id, null]
            return [tournament.id, await statusResponse.json()]
          } catch {
            return [tournament.id, null]
          }
        }),
      )

      setStatuses(Object.fromEntries(statusEntries))
    } catch (err) {
      setError(`Could not load tournaments. ${err.message}`)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadTournaments()
  }, [])

  function handleFileChange(event) {
    const selected = event.target.files?.[0] ?? null
    setFile(null)
    setPreview(null)
    setError('')
    setNotice('')

    if (!selected) return

    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file.')
      event.target.value = ''
      return
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('The CSV exceeds the 10 MB upload limit.')
      event.target.value = ''
      return
    }

    setFile(selected)
  }

  async function validateCsv() {
    if (!name.trim()) {
      setError('Enter a tournament name first.')
      return
    }

    if (!file) {
      setError('Choose a CSV file first.')
      return
    }

    setValidating(true)
    setError('')
    setNotice('')
    setPreview(null)

    try {
      const form = new FormData()
      form.append('file', file)

      const response = await fetch(`${API_URL}/api/import/preview`, {
        method: 'POST',
        body: form,
      })

      if (!response.ok) throw new Error(await parseApiError(response))

      const result = await response.json()
      setPreview(result)

      if (!result.valid || Number(result.error_count) > 0) {
        setError(
          `CSV validation failed: ${result.error_count} issue(s). Review the errors below.`,
        )
      } else {
        setNotice(
          `CSV validated: ${result.valid_rows} rows, ${result.matches_detected} matches and ${result.teams_detected} teams.`,
        )
      }
    } catch (err) {
      setError(`CSV validation failed. ${err.message}`)
    } finally {
      setValidating(false)
    }
  }

  async function analyzeTournament() {
    if (!preview?.valid || Number(preview.error_count) > 0 || !file) {
      setError('Validate a CSV without errors before analyzing it.')
      return
    }

    const cleanName = name.trim()
    const slug = cleanName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    if (!slug) {
      setError('Use a tournament name containing letters or numbers.')
      return
    }

    setImporting(true)
    setError('')
    setNotice('')

    try {
      const form = new FormData()
      form.append('file', file)

      const params = new URLSearchParams({
        tournament_name: cleanName,
        tournament_slug: slug,
        game: 'BGMI',
      })

      const response = await fetch(
        `${API_URL}/api/import/import?${params.toString()}`,
        {
          method: 'POST',
          body: form,
        },
      )

      if (!response.ok) throw new Error(await parseApiError(response))

      const result = await response.json()

      setNotice(
        `Imported ${result.teams_imported} teams, ${result.matches_imported} matches and ${result.results_imported} result rows.`,
      )

      await loadTournaments()

      onAnalyze({
        id: result.tournament_id,
        name: result.tournament_name,
        slug,
        game: 'BGMI',
        status: 'completed',
        total_teams: result.teams_imported,
      })
    } catch (err) {
      setError(`Tournament import failed. ${err.message}`)
    } finally {
      setImporting(false)
    }
  }


  async function deleteTournament(tournament) {
    const confirmed = window.confirm(
      `Delete "${tournament.name}" permanently? Its teams, matches, and results will also be deleted. This cannot be undone.`,
    )
    if (!confirmed) return

    setDeletingId(tournament.id)
    setError('')
    setNotice('')

    try {
      const response = await fetch(
        `${API_URL}/api/tournaments/${tournament.id}`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        let message = `Request failed (${response.status})`
        try {
          const data = await response.json()
          message =
            typeof data.detail === 'string'
              ? data.detail
              : JSON.stringify(data.detail ?? data)
        } catch {}
        throw new Error(message)
      }

      setNotice(`"${tournament.name}" was deleted.`)
      await loadTournaments()
    } catch (err) {
      setError(`Could not delete tournament. ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="tournament-home">
      <header className="home-header">
        <div className="brand">
          <div className="brand-mark">
            <Activity size={23} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-name">
              META<span>MASTERS</span>
            </div>
            <div className="brand-subtitle">ESPORTS INTELLIGENCE</div>
          </div>
        </div>
        <span className="home-live-badge">
          <span className="live-dot" /> BGMI ANALYTICS
        </span>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <div className="eyebrow heading-eyebrow">
            <span className="live-dot" /> YOUR ESPORTS WORKSPACE
          </div>
          <h1>
            Every match.
            <br />
            <span>Every decision.</span>
          </h1>
          <p>
            Import tournament results, uncover team performance and
            explore your competitive intelligence in one place.
          </p>
        </section>

        <section className="home-import-card">
          <div className="home-card-heading">
            <span className="home-step">01</span>
            <div>
              <h2>Analyze a tournament</h2>
              <p>Create a tournament from a validated match-results CSV.</p>
            </div>
          </div>

          <label className="home-field">
            <span>Tournament name</span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setPreview(null)
                setError('')
              }}
              placeholder="e.g. BGMI Championship 2026"
              maxLength={200}
              disabled={validating || importing}
            />
          </label>

          <label className="home-file-picker">
            <FileSpreadsheet size={25} />
            <span>
              <strong>{file ? file.name : 'Choose tournament CSV'}</strong>
              <small>
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB · Ready to validate`
                  : 'CSV format · Maximum 10 MB'}
              </small>
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={validating || importing}
            />
          </label>

          {error && (
            <div className="home-message home-message-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="home-message home-message-success" role="status">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
            </div>
          )}

          {preview && (
            <div className="home-preview">
              <div>
                <span>Valid rows</span>
                <strong>{formatNumber(preview.valid_rows)}</strong>
              </div>
              <div>
                <span>Matches</span>
                <strong>{formatNumber(preview.matches_detected)}</strong>
              </div>
              <div>
                <span>Teams</span>
                <strong>{formatNumber(preview.teams_detected)}</strong>
              </div>
              <div>
                <span>Errors</span>
                <strong>{formatNumber(preview.error_count)}</strong>
              </div>
            </div>
          )}

          {preview?.errors?.length > 0 && (
            <div className="home-validation-errors">
              {preview.errors.slice(0, 5).map((item, index) => (
                <p key={`${item.row ?? 'file'}-${index}`}>
                  {item.row ? `Row ${item.row}: ` : ''}
                  {item.error}
                </p>
              ))}
              {preview.errors_truncated && <p>More errors were omitted.</p>}
            </div>
          )}

          <div className="home-form-actions">
            <button
              type="button"
              className="home-secondary-button"
              onClick={validateCsv}
              disabled={!file || !name.trim() || validating || importing}
            >
              {validating ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Search size={17} />
              )}
              {validating ? 'Validating CSV…' : 'Validate CSV'}
            </button>

            <button
              type="button"
              className="home-primary-button"
              onClick={analyzeTournament}
              disabled={
                !file ||
                !name.trim() ||
                !preview?.valid ||
                Number(preview?.error_count) > 0 ||
                validating ||
                importing
              }
            >
              {importing ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Zap size={17} />
              )}
              {importing ? 'Importing tournament…' : 'Analyze Tournament'}
            </button>
          </div>
          <p className="home-safety-note">
            <Shield size={14} />
            Data is validated before it is saved. Existing tournaments
            are not overwritten.
          </p>
        </section>

        <section className="home-tournaments">
          <div className="home-section-heading">
            <div>
              <div className="eyebrow">YOUR LIBRARY</div>
              <h2>Saved tournaments</h2>
              <p>Choose a tournament to open its analytics dashboard.</p>
            </div>
            <button
              type="button"
              className="home-refresh-button"
              onClick={loadTournaments}
              disabled={loadingList}
              aria-label="Refresh tournaments"
            >
              <RefreshCw
                size={17}
                className={loadingList ? 'spin' : ''}
              />
            </button>
          </div>

          {loadingList ? (
            <div className="home-empty-state">
              <LoaderCircle size={23} className="spin" />
              Loading saved tournaments…
            </div>
          ) : tournaments.length === 0 ? (
            <div className="home-empty-state">
              No tournaments yet. Import your first CSV above.
            </div>
          ) : (
            <div className="home-tournament-list">
              {tournaments.map((tournament) => {
                const status = statuses[tournament.id]
                const matchCount = Number(status?.matches ?? 0)
                const teamCount = Number(status?.teams ?? tournament.total_teams ?? 0)
                const ready = matchCount > 0 && Number(status?.results ?? 0) > 0

                return (
                  <article
                    className="home-tournament-card"
                    key={tournament.id}
                  >
                    <div className="home-tournament-symbol">
                      <Trophy size={21} />
                    </div>
                    <div className="home-tournament-info">
                      <h3>{tournament.name}</h3>
                      <p>
                        {tournament.game || 'BGMI'} · Tournament #{tournament.id}
                      </p>
                      <div className="home-tournament-stats">
                        <span>{formatNumber(teamCount)} teams</span>
                        <span>{formatNumber(matchCount)} matches</span>
                        <span className={ready ? 'home-ready' : 'home-empty'}>
                          {ready ? 'Data ready' : 'No match data'}
                        </span>
                      </div>
                    </div>
                    <div className="home-tournament-actions">
                      <button
                        type="button"
                        className="home-analyze-button"
                        disabled={!ready || importing || !status || deletingId !== null}
                        onClick={() => onAnalyze(tournament)}
                        title={ready ? 'Open tournament dashboard' : 'Import match results first'}
                      >
                        Analyze <span aria-hidden="true">→</span>
                      </button>
                      <button
                        type="button"
                        className="home-delete-button"
                        disabled={deletingId !== null || importing}
                        onClick={() => deleteTournament(tournament)}
                        title={`Delete ${tournament.name}`}
                        aria-label={`Delete ${tournament.name}`}
                      >
                        {deletingId === tournament.id ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        <span>{deletingId === tournament.id ? 'Deleting…' : 'Delete'}</span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer className="home-footer">
          <span>© 2026 MetaMasters Analytics</span>
          <span>Built for competitive intelligence</span>
        </footer>
      </main>
    </div>
  )
}

/* =========================================================
   MAIN APPLICATION
========================================================= */

export default function App() {
  const [activeTournament, setActiveTournament] = useState(null)
  const [activePage, setActivePage] = useState('Overview')
  const [teams, setTeams] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadDashboard = useCallback(async () => {
    if (!activeTournament?.id) return

    setLoading(true)
    setError('')

    try {
      const tournamentId = activeTournament.id
      const endpoints = [
        `${API_URL}/api/standings/${tournamentId}`,
        `${API_URL}/api/analytics/${tournamentId}/teams`,
        `${API_URL}/api/tournaments/${tournamentId}/history`,
      ]

      const responses = await Promise.all(
        endpoints.map((url) => fetch(url)),
      )

      const failed = responses.find((response) => !response.ok)

      if (failed) {
        throw new Error(
          `API request failed (${failed.status}). Check the backend endpoint.`,
        )
      }

      const [standingsData, analyticsData, historyData] =
        await Promise.all(
          responses.map((response) => response.json()),
        )

      const standings = extractArray(standingsData)

      const teamAnalytics = extractArray(analyticsData).map(
        (team, index) => normalizeTeam(team, index + 1),
      )

      const normalizedStandings = standings.map(
        (team, index) => normalizeTeam(team, index + 1),
      )

      const analyticsById = new Map(
        teamAnalytics.map((team) => [
          String(team.team_id),
          team,
        ]),
      )

      const analyticsByName = new Map(
        teamAnalytics.map((team) => [
          team.team_name.toLowerCase(),
          team,
        ]),
      )

      const sourceTeams = normalizedStandings.length
        ? normalizedStandings
        : teamAnalytics

      const rankedTeams = sourceTeams.map((team, index) => {
        const detail =
          analyticsById.get(String(team.team_id)) ??
          analyticsByName.get(team.team_name.toLowerCase())

        return normalizeTeam(
          {
            ...detail,
            ...team,
            rank: team.rank ?? index + 1,
            average_points_per_match:
              detail?.average_points_per_match ??
              team.average_points_per_match,
            average_eliminations_per_match:
              detail?.average_eliminations_per_match ??
              team.average_eliminations_per_match,
            average_placement:
              detail?.average_placement ??
              team.average_placement,
            best_placement:
              detail?.best_placement ??
              team.best_placement,
            first_place_finishes:
              detail?.first_place_finishes ??
              team.first_place_finishes,
            last_3_matches_points:
              detail?.last_3_matches_points ??
              team.last_3_matches_points,
            last_5_matches_points:
              detail?.last_5_matches_points ??
              team.last_5_matches_points,
          },
          index + 1,
        )
      })

      const matchRows = Array.isArray(historyData.matches)
        ? historyData.matches
        : extractArray(historyData)

      setTeams(rankedTeams)
      setAnalytics(teamAnalytics)
      setMatches(matchRows)
      setLastUpdated(new Date())
    } catch (err) {
      setError(
        `${err.message}. Confirm that FastAPI is running at ${API_URL} and CORS permits localhost:5173.`,
      )
    } finally {
      setLoading(false)
    }
  }, [activeTournament?.id])

  useEffect(() => {
    if (!activeTournament?.id) return
    loadDashboard()
  }, [activeTournament?.id, loadDashboard])

  function navigate(page) {
    setActivePage(page)
    setMobileNavOpen(false)
  }

  function openTournament(tournament) {
    setTeams([])
    setAnalytics([])
    setMatches([])
    setError('')
    setSearch('')
    setActivePage('Overview')
    setLoading(true)
    setActiveTournament(tournament)
  }

  const pageDescription = {
    Overview: 'Your competitive intelligence at a glance.',
    Leaderboard: 'Track every team, every point, every position.',
    'Match History': 'Explore the tournament one match at a time.',
    'Team Analytics':
      'Discover consistency, momentum and performance.',
    'Team Details':
      'Inspect individual team performance match by match.',
    'Team Comparison':
      'Compare teams, identify strengths and analyse performance.',
  }[activePage]

  if (!activeTournament) {
    return <TournamentHome onAnalyze={openTournament} />
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Activity size={23} strokeWidth={2.5} />
          </div>

          <div>
            <div className="brand-name">
              META<span>MASTERS</span>
            </div>
            <div className="brand-subtitle">
              ESPORTS INTELLIGENCE
            </div>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="navigation">
          {NAVIGATION.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? 'nav-active' : ''
                }`}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              <span>{label}</span>

              {label === 'Leaderboard' && (
                <span className="nav-count">
                  {teams.length || '—'}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <div className="status-symbol">
              <Shield size={18} />
            </div>

            <div>
              <strong>
                {error
                  ? 'Connection issue'
                  : loading
                    ? 'Connecting…'
                    : 'Dataset connected'}
              </strong>
              <span>{activeTournament.name}</span>
            </div>

            <span
              className="status-light"
              style={
                error ? { background: '#f87171' } : undefined
              }
            />
          </div>

          <div className="sidebar-version">
            METAMASTERS <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <div className="breadcrumb">
              Workspace <span>/</span> <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="home-back-button"
              onClick={() => {
                setActiveTournament(null)
                setError('')
                setMobileNavOpen(false)
              }}
            >
              ← Tournaments
            </button>
            <span className="connection-status">
              <span
                className="live-dot"
                style={
                  error ? { background: '#f87171' } : undefined
                }
              />
              {error
                ? 'Connection issue'
                : loading
                  ? 'Connecting'
                  : 'API connected'}
            </span>

            <button
              className="refresh-button"
              onClick={loadDashboard}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                className={loading ? 'spin' : ''}
              />
              <span>Refresh</span>
            </button>

            <div className="avatar">MM</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow heading-eyebrow">
                <span className="live-dot" />
                BGMI · TOURNAMENT ANALYTICS
              </div>

              <h1>
                {activePage === 'Overview'
                  ? 'Command center'
                  : activePage}
              </h1>

              <p>{pageDescription}</p>
            </div>

            <div className="tournament-pill">
              <span className="tournament-icon">
                <Trophy size={17} />
              </span>

              <span>
                <small>ACTIVE DATASET</small>
                <strong>{activeTournament.name}</strong>
              </span>

              <span className="dataset-id">
                #{String(activeTournament.id).padStart(2, '0')}
              </span>
            </div>
          </section>

          {error && (
            <div className="error-banner">
              <div>
                <strong>Unable to load tournament data</strong>
                <p>{error}</p>
              </div>

              <button onClick={loadDashboard}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <LoaderCircle size={28} className="spin" />
              <strong>Loading tournament intelligence…</strong>
              <span>Connecting to MetaMasters API</span>
            </div>
          ) : (
            <>
              {activePage === 'Overview' && (
                <Overview
                  teams={teams}
                  matches={matches}
                  analytics={analytics}
                  onNavigate={navigate}
                />
              )}

              {activePage === 'Leaderboard' && (
                <Leaderboard
                  teams={teams}
                  search={search}
                  setSearch={setSearch}
                />
              )}

              {activePage === 'Match History' && (
                <MatchHistory matches={matches} />
              )}

              {activePage === 'Team Analytics' && (
                <TeamAnalytics analytics={analytics} />
              )}

              {activePage === 'Team Details' && (
                <TeamDetails
                  teams={teams}
                  matches={matches}
                />
              )}

              {activePage === 'Team Comparison' && (
                <TeamComparison
                  teams={teams}
                  matches={matches}
                />
              )}
            </>
          )}

          <footer className="page-footer">
            <span>© 2026 MetaMasters Analytics</span>

            <span>
              {lastUpdated
                ? `Last synced ${lastUpdated.toLocaleTimeString(
                  [],
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )}`
                : 'Waiting for API'}

              <span className="footer-separator"> · </span>
              Built for competitive intelligence
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}