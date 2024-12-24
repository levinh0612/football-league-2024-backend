const pool = require('../db');

// Lấy lịch thi đấu
exports.getMatches = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.id, 
        t1.id AS home_id,
        t2.id AS away_id,
        COALESCE(t1.name, 'TOP1') AS home_team, 
        COALESCE(t2.name, 'TOP2') AS away_team, 
        m.home_score, 
        m.away_score, 
        m.date 
      FROM matches m
      LEFT JOIN teams t1 ON m.home_team_id = t1.id
      LEFT JOIN teams t2 ON m.away_team_id = t2.id
      ORDER BY m.date asc;
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy lịch thi đấu' });
  }
};

// Tạo lịch thi đấu mới
exports.createMatch = async (req, res) => {
  const { home_team_id, away_team_id, date } = req.body;
  try {
    await pool.query(`
      INSERT INTO matches (home_team_id, away_team_id, date) 
      VALUES ($1, $2, $3);
    `, [home_team_id, away_team_id, date]);
    res.status(201).json({ message: 'Tạo lịch thi đấu thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi tạo lịch thi đấu' });
  }
};

exports.updateMatchDetails = async (req, res) => {
  const { id } = req.params;
  const { homeScore: home_score, awayScore: away_score, events } = req.body; // Assuming events is the array with event details

  try {
    // Step 1: Update the match score
    await pool.query(`
      UPDATE matches 
      SET home_score = $1, away_score = $2 
      WHERE id = $3;
    `, [home_score, away_score, id]);

    // Step 2: Process each event (Goal, Yellow Card, Red Card)
    for (const { homePlayer, awayPlayer, eventType, eventCount } of events) {
      const parsedEventCount = parseInt(eventCount, 10) || 0;

      // Determine the event column (goals, yellow_cards, red_cards)
      let eventColumn;
      let playerColumn; // We will store the column name for players table to update
      if (eventType === 'Goal') {
        eventColumn = 'goals';
        playerColumn = 'goals';
      }
      else if (eventType === 'Yellow Card') {
        eventColumn = 'yellow_cards';
        playerColumn = 'yellow_cards';
      }
      else if (eventType === 'Red Card') {
        eventColumn = 'red_cards';
        playerColumn = 'red_cards';
      } else continue; // Skip if eventType is invalid

      // Helper function to check if player stats exist and update them
      const checkAndUpdatePlayerStats = async (playerId, count) => {
        const res = await pool.query(`
          SELECT * FROM player_stats 
          WHERE player_id = $1 AND match_id = $2;
        `, [playerId, id]);

        if (res.rows.length > 0) {
          // If player stats exist, update the relevant column
          await pool.query(`
            UPDATE player_stats
            SET ${eventColumn} = ${eventColumn} + $1
            WHERE player_id = $2 AND match_id = $3;
          `, [count, playerId, id]);
        } else {
          // If player stats do not exist, insert a new record
          await pool.query(`
            INSERT INTO player_stats (player_id, match_id, ${eventColumn})
            VALUES ($1, $2, $3);
          `, [playerId, id, count]);
        }

        // After updating the player stats, update the player's total stats in the players table
        await pool.query(`
          UPDATE players
          SET ${playerColumn} = ${playerColumn} + $1
          WHERE id = $2;
        `, [count, playerId]);
      };

      // Update stats for home and away players
      if (homePlayer) await checkAndUpdatePlayerStats(homePlayer, parsedEventCount);
      if (awayPlayer) await checkAndUpdatePlayerStats(awayPlayer, parsedEventCount);
    }

    // Step 3: Update team stats (wins, draws, losses, goals_for, goals_against, points)
    const updateTeamStats = async (teamId, goalsFor, goalsAgainst) => {
      // Update goals for and goals against
      await pool.query(`
        UPDATE teams
        SET goals_for = goals_for + $1, goals_against = goals_against + $2
        WHERE id = $3;
      `, [goalsFor, goalsAgainst, teamId]);
    };

    const home_team_id = req.body.homeTeamId; // Assuming home team ID is passed
    const away_team_id = req.body.awayTeamId; // Assuming away team ID is passed

    let home_team_points = 0;
    let away_team_points = 0;

    // Determine match result and update team records
    if (home_score > away_score) {
      // Home team wins
      home_team_points = 3;
      away_team_points = 0;
    } else if (home_score < away_score) {
      // Away team wins
      home_team_points = 0;
      away_team_points = 3;
    } else {
      // Draw
      home_team_points = 1;
      away_team_points = 1;
    }

    // Step 4: Update team points and wins, draws, losses
    await pool.query(`
      UPDATE teams
      SET wins = wins + $1, losses = losses + $2, points = points + $3
      WHERE id = $4;
    `, [home_score > away_score ? 1 : 0, home_score < away_score ? 1 : 0, home_team_points, home_team_id]);

    await pool.query(`
      UPDATE teams
      SET wins = wins + $1, losses = losses + $2, points = points + $3
      WHERE id = $4;
    `, [away_score > home_score ? 1 : 0, away_score < home_score ? 1 : 0, away_team_points, away_team_id]);

    // Update goals for and goals against
    await updateTeamStats(home_team_id, home_score, away_score);
    await updateTeamStats(away_team_id, away_score, home_score);

    // Send success response
    res.status(200).json({ message: 'Cập nhật chi tiết trận đấu thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi cập nhật chi tiết trận đấu' });
  }
};