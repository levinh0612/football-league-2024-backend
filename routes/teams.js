const express = require('express');
const router = express.Router();
const { getLeaderboard, getPlayersByTeam } = require('../controllers/teams');

// Định tuyến
router.get('/leaderboard', getLeaderboard);
router.get('/players/:id', getPlayersByTeam);


module.exports = router;