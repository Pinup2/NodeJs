const { body, validationResult } = require('express-validator');

const validateUsername = body('username')
  .isString()
  .notEmpty()
  .withMessage('Username is required and must be a non-empty string');

const validateExercise = [
  body('description')
    .isString()
    .notEmpty()
    .withMessage('Description is required'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer'),
  body('date')
    .custom((value, { req }) => {
      if (!value) return true;
      const parsed = Date.parse(value);
      if (isNaN(parsed)) throw new Error('Date must be in YYYY-MM-DD format');
      return true;
    }),
];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  validateUsername,
  validateExercise,
  handleValidation,
};