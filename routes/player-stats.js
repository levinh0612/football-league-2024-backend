const express = require('express');
const router = express.Router();
const { getStats, getResult } = require('../controllers/player-stats');

// Định tuyến
router.get('/', getStats);
router.get('/result', getResult);

module.exports = router;