const pool = require('../db');


exports.getStats = async (req, res) => {
  try {
    // Lấy BXH cầu thủ ghi bàn nhiều nhất
    const topGoalsQuery = `
    SELECT concat(p.name, ' (' , p.jersey_number, ') - ', t.name) as name, p.goals 
    FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.goals > 0 
    ORDER BY p.goals DESC 
  `;
    const topGoalsResult = await pool.query(topGoalsQuery);

    // Lấy BXH cầu thủ có thẻ vàng nhiều nhất
    const topYellowCardsQuery = `
    SELECT concat(p.name, ' (' , p.jersey_number, ') - ', t.name) as name, p.yellow_cards 
    FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.yellow_cards > 0 
    ORDER BY p.yellow_cards DESC 
  `;
    const topYellowCardsResult = await pool.query(topYellowCardsQuery);

    // Lấy BXH cầu thủ có thẻ đỏ nhiều nhất
    const topRedCardsQuery = `
    SELECT concat(p.name, ' (' , p.jersey_number, ') - ', t.name) as name, p.red_cards 
    FROM players p
    JOIN teams t ON p.team_id = t.id
    WHERE p.red_cards > 0 
    ORDER BY p.red_cards DESC 
  `;
    const topRedCardsResult = await pool.query(topRedCardsQuery);

    // Trả về kết quả
    res.status(200).json({
      topGoals: topGoalsResult.rows,
      topYellowCards: topYellowCardsResult.rows,
      topRedCards: topRedCardsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu thống kê cầu thủ' });
  }
};

exports.getResult = async (req, res) => {
  try {
    // Top goal scorer (vua phá lưới)
    const topGoalsQuery = `
      SELECT name, goals 
      FROM players 
      ORDER BY goals DESC 
      LIMIT 1
    `;
    const topGoalsResult = await pool.query(topGoalsQuery);

    // Players with red cards
    const redCardsQuery = `
      SELECT name, red_cards 
      FROM players 
      WHERE red_cards > 0
    `;
    const redCardsResult = await pool.query(redCardsQuery);

    // Players with yellow cards
    const yellowCardsQuery = `
      SELECT p.name, p.yellow_cards, t.id as team_id, t.name as team_name
      FROM players p
        JOIN teams t on t.id = p.team_id
      WHERE yellow_cards > 0
    `;
    const yellowCardsResult = await pool.query(yellowCardsQuery);

    // Sending the result as response
    res.status(200).json({
      topGoals: topGoalsResult.rows[0], // The player with the highest goals
      redCards: redCardsResult.rows, // All players with red cards
      yellowCards: yellowCardsResult.rows, // All players with yellow cards
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu cầu thủ' });
  }
};