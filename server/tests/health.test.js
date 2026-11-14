const request = require('supertest');
const app = require('../app');

describe('Server Foundation & Health Checks', () => {
  it('GET /api/v1/health should return 200 and online status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('online');
  });

  it('GET /api/v1/nonexistent should trigger 404 handler with json error response', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('API route not found');
  });
});
