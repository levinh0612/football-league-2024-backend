const pool = require('../db');

// Lấy bảng xếp hạng
exports.getLeaderboard = async (req, res) => {
  try {
    // Get leaderboard data
    const leaderboardResult = await pool.query(`
      SELECT 
        t.id AS team_id,
        t.name AS team_name,
        COUNT(m.id) AS played,
        SUM(CASE WHEN m.winner_id = t.id THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN m.winner_id IS NULL THEN 1 ELSE 0 END) AS draws,
        SUM(CASE WHEN m.winner_id != t.id AND m.winner_id IS NOT NULL THEN 1 ELSE 0 END) AS losses,
        COALESCE((
          SELECT SUM(ps.goals)
          FROM player_stats ps
          JOIN players p ON ps.player_id = p.id
          WHERE p.team_id = t.id
        ), 0) AS goals_for,
        COALESCE((
          SELECT SUM(ps.goals)
          FROM player_stats ps
          JOIN players p ON ps.player_id = p.id
          WHERE p.team_id != t.id AND ps.match_id IN (
            SELECT id FROM matches WHERE home_team_id = t.id OR away_team_id = t.id
          )
        ), 0) AS goals_against,
        (COALESCE((
          SELECT SUM(ps.goals)
          FROM player_stats ps
          JOIN players p ON ps.player_id = p.id
          WHERE p.team_id = t.id
        ), 0) - COALESCE((
          SELECT SUM(ps.goals)
          FROM player_stats ps
          JOIN players p ON ps.player_id = p.id
          WHERE p.team_id != t.id AND ps.match_id IN (
            SELECT id FROM matches WHERE home_team_id = t.id OR away_team_id = t.id
          )
        ), 0)) AS goal_difference,
        (SUM(CASE WHEN m.winner_id = t.id THEN 3 ELSE 0 END) +
         SUM(CASE WHEN m.winner_id IS NULL THEN 1 ELSE 0 END)) AS points
      FROM teams t
      LEFT JOIN matches m
      ON t.id = m.home_team_id OR t.id = m.away_team_id
      WHERE m.date <= NOW()  -- Consider only matches that have already been played
      GROUP BY t.id
      ORDER BY points DESC, goal_difference DESC;
    `);

    // Get recent results for each team
    const recentResultsResult = await pool.query(`
      SELECT
        team_id,
        array_agg(
            CASE
                WHEN m.winner_id = team_id THEN 'W'
                WHEN m.winner_id IS NULL THEN 'D'
                ELSE 'L'
            END ORDER BY m.date DESC
        ) AS recent_results
      FROM (
          SELECT home_team_id AS team_id, winner_id, date
          FROM matches
          WHERE date <= NOW()
          UNION ALL
          SELECT away_team_id AS team_id, winner_id, date
          FROM matches
          WHERE date <= NOW()
      ) AS m
      GROUP BY team_id
      ORDER BY team_id;
    `);

    // Merge the data
    const leaderboard = leaderboardResult.rows;
    const recentResults = recentResultsResult.rows;

    // Combine the data
    const response = leaderboard.map((team, index) => {
      const teamRecentResults = recentResults.find(result => result.team_id === team.team_id);
      return {
        rank: index + 1,
        teamName: team.team_name,
        matchesPlayed: parseInt(team.played, 10),
        wins: parseInt(team.wins, 10),
        draws: parseInt(team.draws, 10),
        losses: parseInt(team.losses, 10),
        goalsFor: parseInt(team.goals_for, 10),
        goalsAgainst: parseInt(team.goals_against, 10),
        goalDifference: parseInt(team.goal_difference, 10),
        points: parseInt(team.points, 10),
        recentResults: teamRecentResults ? teamRecentResults.recent_results.slice(0, 5) : [] // Get last 5 results
      };
    });

    res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ message: "Error getting leaderboard" });
  }
};

exports.getPlayersByTeam = async (req, res) => {
  const teamId = req.params.id; // Get the team id from the request

  try {
    // Write a raw SQL query to get players by team_id
    const query = 'SELECT * FROM players WHERE team_id = $1 ORDER BY jersey_number asc';
    const { rows } = await pool.query(query, [teamId]); // $1 is a placeholder for teamId

    if (rows.length > 0) {
      res.status(200).json(rows); // Return the list of players
    } else {
      res.status(404).json({ message: 'No players found for this team.' });
    }
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'An error occurred while fetching players.' });
  }
};