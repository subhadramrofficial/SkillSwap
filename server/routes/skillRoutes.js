const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const { createSkillValidator, updateSkillValidator } = require('../validators/skillValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');

// Public browse & details
router.get('/', skillController.getSkills);
router.get('/suggestions', skillController.getSkillSuggestions);

// User skills: own and another user's public skills
router.get('/user/mine', authenticate, skillController.getMySkills);
router.get('/user/:userId', authenticate, skillController.getUserSkills);

router.get('/:id', skillController.getSkillById);

// Protected skill management
router.post('/', authenticate, createSkillValidator, validate, skillController.createSkill);
router.patch('/:id', authenticate, updateSkillValidator, validate, skillController.updateSkill);
router.delete('/:id', authenticate, skillController.deleteSkill);

module.exports = router;
