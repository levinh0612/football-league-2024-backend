const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
require('dotenv').config();

app.use(cors());
app.use(bodyParser.json());

// Import routes
const teamRoutes = require('./routes/teams');
const matchRoutes = require('./routes/matches');
const prizeRoutes = require('./routes/prizes');
const playerStats = require('./routes/player-stats');

// Use routes
app.use('/team', teamRoutes);
app.use('/match', matchRoutes);
app.use('/prize', prizeRoutes);
app.use('/player-stats', playerStats);

// Export the express app as a Vercel function
// Export the app as a serverless function
// Define a simple GET route
app.get('/', (req, res) => {
  res.send("Hello from football-league-2024-backend!");
});

// Export the app as a serverless function
// Export the express app as a Vercel function
module.exports = (req, res) => {
  app(req, res);
};