const express = require('express');
const db = require('../db/db');
const router = express.Router();

const {
  validateUsername,
  validateExercise,
  handleValidation,
} = require('../middlewares/validation');

router.post('/api/users', validateUsername, handleValidation, (req, res) => {
  const { username } = req.body;
  const query = 'INSERT INTO users (username) VALUES (?)';

  db.run(query, [username], function (err) {
    if (err) {
      console.error('ERROR inserting user:', err);
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Username must be unique' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ username, _id: this.lastID });
  });
});

router.post('/api/users/:_id/exercises', validateExercise, handleValidation, (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;
  const parsedDuration = parseInt(duration);
  const exerciseDate = date ? new Date(date) : new Date();
  const formattedDate = exerciseDate.toDateString();

  db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.run(
      'INSERT INTO exercises (user_id, description, duration, date) VALUES (?, ?, ?, ?)',
      [userId, description, parsedDuration, formattedDate],
      function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });

        res.json({
          _id: userId,
          username: user.username,
          description,
          duration: parsedDuration,
          date: formattedDate,
        });
      }
    );
  });
});

router.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let query = 'SELECT id, description, duration, date FROM exercises WHERE user_id = ?';
    const params = [userId];

    if (from) {
      query += ' AND date >= ?';
      params.push(new Date(from).toDateString());
    }

    if (to) {
      query += ' AND date <= ?';
      params.push(new Date(to).toDateString());
    }

    query += ' ORDER BY date DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    db.all(query, params, (err, logs) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      res.json({
        _id: userId,
        username: user.username,
        count: logs.length,
        log: logs.map(e => ({
          description: e.description,
          duration: e.duration,
          date: e.date,
        })),
      });
    });
  });
});

module.exports = router;