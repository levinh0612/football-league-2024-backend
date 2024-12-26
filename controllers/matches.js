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
          m.date,
          CASE 
              WHEN COUNT(ps.id) > 0 THEN true
              ELSE false
          END AS is_defined
      FROM matches m
      LEFT JOIN teams t1 ON m.home_team_id = t1.id
      LEFT JOIN teams t2 ON m.away_team_id = t2.id
      LEFT JOIN player_stats ps ON ps.match_id = m.id
      GROUP BY m.id, t1.id, t2.id, m.home_score, m.away_score, m.date
      ORDER BY m.date ASC;
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
  const {
    isDefined,
    homeScore: home_score,
    awayScore: away_score,
    events,
    homeTeamId: home_team_id,
    awayTeamId: away_team_id,
  } = req.body;

  try {
    // Begin a transaction
    await pool.query("BEGIN");

    // Step 1: Update the match score
    await pool.query(
      `
      UPDATE matches 
      SET home_score = $1, away_score = $2 
      WHERE id = $3;
    `,
      [home_score, away_score, id]
    );

    if (isDefined) {
      // Step 2a: Adjust player stats before processing events
      const statsQuery = `
        SELECT player_id, goals, yellow_cards, red_cards 
        FROM player_stats 
        WHERE match_id = $1;
      `;
      const statsResult = await pool.query(statsQuery, [id]);

      for (const stat of statsResult.rows) {
        // Subtract existing stats from the players table
        await pool.query(
          `
          UPDATE players 
          SET 
            goals = goals - $1, 
            yellow_cards = yellow_cards - $2, 
            red_cards = red_cards - $3
          WHERE id = $4;
        `,
          [stat.goals, stat.yellow_cards, stat.red_cards, stat.player_id]
        );
      }

      // Step 2b: Remove old player stats for this match
      const deleteResult = await pool.query(`
        DELETE FROM player_stats 
        WHERE match_id = $1;
      `, [id]);

      // Reset sequence to avoid duplicate ID issues
      await pool.query(
        `
        SELECT setval('player_stats_id_seq', (SELECT MAX(id) FROM player_stats) + 1);
      `
      );
    }

    // Step 3: Process and insert events
    for (const { homePlayer, awayPlayer, eventType, eventCount } of events) {
      const parsedEventCount = parseInt(eventCount, 10) || 0;

      let eventColumn, playerColumn;

      if (eventType === "Goal") {
        eventColumn = "goals";
        playerColumn = "goals";
      } else if (eventType === "Yellow Card") {
        eventColumn = "yellow_cards";
        playerColumn = "yellow_cards";
      } else if (eventType === "Red Card") {
        eventColumn = "red_cards";
        playerColumn = "red_cards";
      } else continue;

      const processEvent = async (playerId) => {
        // Check if player stats already exist for this match
        const existingStats = await pool.query(
          `
          SELECT * FROM player_stats 
          WHERE player_id = $1 AND match_id = $2;
        `,
          [playerId, id]
        );

        if (existingStats.rows.length > 0) {
          // Update player stats
          await pool.query(
            `
            UPDATE player_stats
            SET ${eventColumn} = ${eventColumn} + $1
            WHERE player_id = $2 AND match_id = $3;
          `,
            [parsedEventCount, playerId, id]
          );
        } else {
          // Insert new stats record
          await pool.query(
            `
            INSERT INTO player_stats (player_id, match_id, ${eventColumn})
            VALUES ($1, $2, $3);
          `,
            [playerId, id, parsedEventCount]
          );
        }

        // Update the player's overall stats
        await pool.query(
          `
          UPDATE players
          SET ${playerColumn} = ${playerColumn} + $1
          WHERE id = $2;
        `,
          [parsedEventCount, playerId]
        );
      };

      if (homePlayer) await processEvent(homePlayer);
      if (awayPlayer) await processEvent(awayPlayer);
    }

    // Step 4: Update team stats
    const updateTeamStats = async (teamId, goalsFor, goalsAgainst, result) => {
      const columns = {
        win: "wins",
        loss: "losses",
        draw: "draws",
      };

      const resultColumn = columns[result];

      await pool.query(
        `
        UPDATE teams
        SET 
          ${resultColumn} = ${resultColumn} + 1, 
          goals_for = goals_for + $1, 
          goals_against = goals_against + $2, 
          points = points + $3
        WHERE id = $4;
      `,
        [
          goalsFor,
          goalsAgainst,
          result === "win" ? 3 : result === "draw" ? 1 : 0,
          teamId,
        ]
      );
    };

    let homeResult, awayResult;

    if (home_score > away_score) {
      homeResult = "win";
      awayResult = "loss";
    } else if (home_score < away_score) {
      homeResult = "loss";
      awayResult = "win";
    } else {
      homeResult = "draw";
      awayResult = "draw";
    }

    await updateTeamStats(home_team_id, home_score, away_score, homeResult);
    await updateTeamStats(away_team_id, away_score, home_score, awayResult);

    // Commit the transaction
    await pool.query("COMMIT");

    res.status(200).json({ message: "Match details updated successfully." });
  } catch (error) {
    console.error("Error updating match details:", error);

    // Rollback the transaction in case of an error
    await pool.query("ROLLBACK");

    res.status(500).json({ message: "Error updating match details." });
  }
};

exports.details = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch match details to identify home and away teams
    const matchQuery = `
      SELECT 
        id AS match_id,
        home_team_id, 
        away_team_id,
        home_score, 
        away_score
      FROM matches
      WHERE id = $1
    `;
    const matchResult = await pool.query(matchQuery, [id]);

    if (matchResult.rowCount === 0) {
      return res.status(404).json({ message: "Match not found" });
    }

    const match = matchResult.rows[0];

    // Fetch player stats for the match
    const statsQuery = `
      SELECT 
        ps.player_id, 
        ps.goals, 
        ps.yellow_cards, 
        ps.red_cards, 
        CONCAT(p.name, ' (', p.jersey_number, ')') AS player_name, 
        p.id as playerId,
        p.team_id
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.match_id = $1
    `;
    const statsResult = await pool.query(statsQuery, [id]);

    const homeTeamStats = [];
    const awayTeamStats = [];
    const events = [];

    statsResult.rows.forEach((stat) => {
      const playerDetails = {
        player_name: stat.player_name,
        player_id: stat.playerId,
        goals: stat.goals,
        yellow_cards: stat.yellow_cards,
        red_cards: stat.red_cards,
      };

      // Categorize stats by team
      if (stat.team_id === match.home_team_id) {
        homeTeamStats.push(playerDetails);
      } else if (stat.team_id === match.away_team_id) {
        awayTeamStats.push(playerDetails);
      }

      // Create events based on player stats
      if (stat.goals > 0) {
        events.push({
          homePlayer: stat.team_id === match.home_team_id ? stat.player_id : null,
          awayPlayer: stat.team_id === match.away_team_id ? stat.player_id : null,
          event_type: "Goal",
          event_count: stat.goals,
        });
      }
      if (stat.yellow_cards > 0) {
        events.push({
          homePlayer: stat.team_id === match.home_team_id ? stat.player_id : null,
          awayPlayer: stat.team_id === match.away_team_id ? stat.player_id : null,
          event_type: "Yellow Card",
          event_count: stat.yellow_cards,
        });
      }
      if (stat.red_cards > 0) {
        events.push({
          homePlayer: stat.team_id === match.home_team_id ? stat.player_id : null,
          awayPlayer: stat.team_id === match.away_team_id ? stat.player_id : null,
          event_type: "Red Card",
          event_count: stat.red_cards,
        });
      }
    });

    // Send response
    res.json({
      match_id: match.match_id,
      home_score: match.home_score,
      away_score: match.away_score,
      home_team_stats: homeTeamStats,
      away_team_stats: awayTeamStats,
      events: events,
    });
  } catch (error) {
    console.error("Error fetching match details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};