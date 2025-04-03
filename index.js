const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { body, validationResult, query } = require('express-validator');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ],
});

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const bodyParser = require('body-parser');
const db = require('./db/db'); 

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/api/users',
  body('username').isString().notEmpty().withMessage('Username is required and must be a non-empty string'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username } = req.body;

    const query = 'INSERT INTO users (username) VALUES (?)';
    db.run(query, [username], function (err) {
      if (err) {
        console.error('ERROR inserting user:', err); 

        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username must be unique' });
        }
        console.error(err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ username, _id: this.lastID });
    });
  });

app.get('/api/users', (req, res) => {
  db.all('SELECT id as _id, username FROM users', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

app.post('/api/users/:_id/exercises',
  body('description').isString().notEmpty().withMessage('Description is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
  body('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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

app.get('/api/users/:_id/logs', (req, res) => {
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

app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

if (require.main === module) {
  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
  });
}

module.exports = app;
