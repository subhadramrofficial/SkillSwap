const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { updateProfileValidator } = require('../validators/authValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { errorResponse } = require('../utils/apiResponse');

const handleAvatarUpload = (req, res, next) => {
  const uploadSingle = upload.single('avatar');
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 400, 'File size exceeds 5MB limit. Please choose a smaller image.');
      }
      return errorResponse(res, 400, err.message || 'Error uploading file.');
    }
    next();
  });
};

// Upload profile avatar
router.post('/upload-avatar', authenticate, handleAvatarUpload, userController.uploadAvatar);

// Update personal profile
router.patch('/me', authenticate, updateProfileValidator, validate, userController.updateMe);


// Get public profile of another user
router.get('/profile/:id', authenticate, userController.getProfile);

module.exports = router;
