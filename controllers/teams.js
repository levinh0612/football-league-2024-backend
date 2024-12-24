const pool = require('../db');

// Lấy bảng xếp hạng
exports.getLeaderboard = async (req, res) => {
  try {
    // Get leaderboard data
    const leaderboardResult = await pool.query(`
      SELECT 
        id AS team_id,
        name AS team_name,
        played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        (goals_for - goals_against) AS goal_difference,
        points
      FROM teams
      ORDER BY points DESC, goal_difference DESC;
    `);
    
    // Get recent results for each team
    const recentResultsResult = await pool.query(`
      SELECT
        team_id,
        array_agg(
            CASE
                WHEN team_id = m.team_id AND m.home_score > m.away_score THEN 'W'
                WHEN team_id = m.team_id AND m.away_score > m.home_score THEN 'L'
                WHEN m.home_score = m.away_score THEN 'D'
                ELSE 'L'
            END ORDER BY m.date DESC
        ) AS recent_results
      FROM (
          SELECT home_team_id AS team_id, home_score, away_score, date
          FROM matches where away_score > 0 or home_score > 0
          UNION ALL
          SELECT away_team_id AS team_id, away_score AS home_score, home_score AS away_score, date
          FROM matches where away_score > 0 or home_score > 0
      ) AS m
      GROUP BY team_id
      ORDER BY team_id;
    `);

    // Merge the data
    const leaderboard = leaderboardResult.rows;
    const recentResults = recentResultsResult.rows;

    // Combine the data
    const response = leaderboard.map(team => {
      const teamRecentResults = recentResults.find(result => result.team_id === team.team_id);
      return {
        rank: leaderboard.indexOf(team) + 1,
        teamName: team.team_name,
        matchesPlayed: team.played,
        wins: team.wins,
        draws: team.draws,
        losses: team.losses,
        goalsFor: team.goals_for,
        goalsAgainst: team.goals_against,
        goalDifference: team.goal_difference,
        points: team.points,
        recentResults: teamRecentResults ? teamRecentResults.recent_results.slice(0, 5) : []  // Get last 5 results
      };
    });

    res.status(200).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error getting leaderboard' });
  }
};

exports.getPlayersByTeam = async (req, res) => {
  const teamId = req.params.id; // Get the team id from the request

  try {
    // Write a raw SQL query to get players by team_id
    const query = 'SELECT * FROM players WHERE team_id = $1';
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