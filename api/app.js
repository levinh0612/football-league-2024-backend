const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
require('dotenv').config();

app.use(cors());
app.use(bodyParser.json());

// Import routes
const teamRoutes = require('../routes/teams');
const matchRoutes = require('../routes/matches');
const prizeRoutes = require('../routes/prizes');
const playerStats = require('../routes/player-stats');

// Sử dụng routes
app.use('/team', teamRoutes);
app.use('/match', matchRoutes);
app.use('/prize', prizeRoutes);
app.use('/player-stats', playerStats);

app.use((req, res) => {
  res.send("Hello from football-league-2024-backend@1.0.0!");
})

// Khởi chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;