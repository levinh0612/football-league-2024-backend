const express = require('express');
const router = express.Router();
const { getMatches, createMatch, updateMatchDetails } = require('../controllers/matches');

// Định tuyến
router.get('/', getMatches);
router.post('/', createMatch);
router.put('/:id', updateMatchDetails);

module.exports = router;