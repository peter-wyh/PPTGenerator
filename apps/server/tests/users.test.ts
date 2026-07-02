import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createUser, login, authHeader } from './helpers';

describe('admin users CRUD', () => {
  describe('role guard', () => {
    it('401 without access token', async () => {
      const res = await request(app()).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
    });

    it('403 for non-admin USER', async () => {
      const u = await createUser({ email: 'user@x.com', role: 'USER' });
      const { accessToken } = await login(app(), u.email);
      const res = await request(app()).get('/api/v1/admin/users').set(authHeader(accessToken));
      expect(res.status).toBe(403);
    });

    it('200 for ADMIN', async () => {
      const u = await createUser({ email: 'admin@x.com', role: 'ADMIN' });
      const { accessToken } = await login(app(), u.email);
      const res = await request(app()).get('/api/v1/admin/users').set(authHeader(accessToken));
      expect(res.status).toBe(200);
      expect(res.body.users).toEqual(expect.any(Array));
    });
  });

  describe('CRUD', () => {
    it('creates, lists, updates, deletes a user', async () => {
      const admin = await createUser({ email: 'admin@x.com', role: 'ADMIN' });
      const { accessToken } = await login(app(), admin.email);
      const h = authHeader(accessToken);

      const created = await request(app())
        .post('/api/v1/admin/users')
        .set(h)
        .send({ email: 'new@x.com', password: 'Password123', name: 'New', role: 'USER' });
      expect(created.status).toBe(201);
      expect(created.body.user.email).toBe('new@x.com');
      const id = created.body.user.id;

      const listed = await request(app()).get('/api/v1/admin/users').set(h);
      expect(listed.body.users.length).toBeGreaterThanOrEqual(2);

      const updated = await request(app())
        .patch(`/api/v1/admin/users/${id}`)
        .set(h)
        .send({ name: 'Renamed' });
      expect(updated.status).toBe(200);
      expect(updated.body.user.name).toBe('Renamed');

      const deleted = await request(app()).delete(`/api/v1/admin/users/${id}`).set(h);
      expect(deleted.status).toBe(204);
    });

    it('409 on duplicate email', async () => {
      const admin = await createUser({ email: 'admin@x.com', role: 'ADMIN' });
      const { accessToken } = await login(app(), admin.email);
      const res = await request(app())
        .post('/api/v1/admin/users')
        .set(authHeader(accessToken))
        .send({ email: 'admin@x.com', password: 'Password123' });
      expect(res.status).toBe(409);
    });

    it('404 when updating a missing user', async () => {
      const admin = await createUser({ email: 'admin@x.com', role: 'ADMIN' });
      const { accessToken } = await login(app(), admin.email);
      const res = await request(app())
        .patch('/api/v1/admin/users/nonexistent')
        .set(authHeader(accessToken))
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });

    it('409 when deleting the last admin', async () => {
      const admin = await createUser({ email: 'admin@x.com', role: 'ADMIN' });
      const { accessToken } = await login(app(), admin.email);
      const res = await request(app())
        .delete(`/api/v1/admin/users/${admin.id}`)
        .set(authHeader(accessToken));
      expect(res.status).toBe(409);
    });
  });
});
