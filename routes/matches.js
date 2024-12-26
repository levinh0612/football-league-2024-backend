const express = require('express');
const router = express.Router();
const { getMatches, createMatch, updateMatchDetails, details } = require('../controllers/matches');

// Định tuyến
router.get('/', getMatches);
router.post('/', createMatch);
router.put('/:id', updateMatchDetails);
router.get('/:id', details);

module.exports = router;