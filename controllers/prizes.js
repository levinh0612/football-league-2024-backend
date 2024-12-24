exports.getPrizeDetails = async (req, res) => {
  try {
    // Tính đội vô địch
    const champion = await pool.query(`
      SELECT name, points FROM teams 
      ORDER BY points DESC LIMIT 1;
    `);

    // Tính vua phá lưới
    const topScorer = await pool.query(`
      SELECT p.name, SUM(ps.goals) AS total_goals 
      FROM players p
      JOIN player_stats ps ON p.id = ps.player_id
      GROUP BY p.name
      ORDER BY total_goals DESC LIMIT 1;
    `);

    // Tổng hợp thẻ vàng/đỏ
    const cards = await pool.query(`
      SELECT t.name AS team_name, 
             SUM(ps.yellow_cards) AS yellow_cards, 
             SUM(ps.red_cards) AS red_cards
      FROM teams t
      JOIN players p ON t.id = p.team_id
      JOIN player_stats ps ON p.id = ps.player_id
      GROUP BY t.name;
    `);

    res.status(200).json({
      champion: champion.rows[0],
      top_scorer: topScorer.rows[0],
      cards: cards.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi khi tính giải thưởng' });
  }
};