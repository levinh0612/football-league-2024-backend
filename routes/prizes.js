const express = require('express');
const router = express.Router();
const { getPrizeDetails } = require('../controllers/prizes');

// Định tuyến
router.get('/', getPrizeDetails);

module.exports = router;