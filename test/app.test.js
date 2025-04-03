const request = require('supertest');
const app = require('../index');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

describe('Exercise Tracker API', () => {
  let userId;

  beforeAll((done) => {
    const dbPath = path.resolve(__dirname, './exercise-tracker.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          description TEXT NOT NULL,
          duration INTEGER NOT NULL,
          date TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `, () => {
        db.close();
        done();
      });
    });
  });

  it('should reject empty username', async () => {
    const res = await request(app).post('/api/users').send({ username: '' });
    expect(res.statusCode).toBe(400);
  });

  it('should create a user', async () => {
    const res = await request(app).post('/api/users').send({ username: 'tester' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('_id');
    userId = res.body._id;
  });

  it('should reject duplicate usernames', async () => {
    const res = await request(app).post('/api/users').send({ username: 'tester' });
    expect(res.statusCode).toBe(400);
  });

  it('should log a valid exercise', async () => {
    const res = await request(app).post(`/api/users/${userId}/exercises`).send({
      description: 'Test workout',
      duration: 30,
      date: '2024-04-01',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('description', 'Test workout');
  });

  it('should reject exercise with invalid duration', async () => {
    const res = await request(app).post(`/api/users/${userId}/exercises`).send({
      description: 'Invalid',
      duration: 'bad',
      date: '2024-04-01',
    });
    expect(res.statusCode).toBe(400);
  });

  it('should return exercise logs', async () => {
    const res = await request(app).get(`/api/users/${userId}/logs`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('log');
    expect(Array.isArray(res.body.log)).toBe(true);
  });
  afterAll(() => {
    if (fs.existsSync(process.env.TEST_DB_PATH)) {
      fs.unlinkSync(process.env.TEST_DB_PATH);
    }
  });
});