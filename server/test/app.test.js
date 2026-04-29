const test = require('node:test');
const assert = require('node:assert/strict');

const request = require('supertest');

const { createApp } = require('../app');

const adminHeaders = { 'x-user-role': 'admin' };
const studentHeaders = { 'x-user-role': 'student', 'x-student-id': '1' };

test('PUT /api/grades/:id validates score and avoids database writes on invalid payload', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .put('/api/grades/8')
    .set(adminHeaders)
    .send({ score: 180 });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(calls.length, 0);
});

test('PUT /api/grades/:id rejects blank score strings', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .put('/api/grades/8')
    .set(adminHeaders)
    .send({ score: '' });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(calls.length, 0);
});

test('PUT /api/grades/:id updates score only and returns trigger-computed row', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });

      if (sql.includes('UPDATE grades SET score=? WHERE id=?')) {
        return [{ affectedRows: 1 }];
      }

      if (sql.includes('FROM grades g') && sql.includes('WHERE g.id = ?')) {
        return [[{
          id: 9,
          student_id: 2,
          course_id: 4,
          student_no: '2024002',
          student_name: '韩梅梅',
          course_code: 'CS104',
          course_name: '计算机网络',
          credits: 3,
          score: 88,
          grade_point: 3.8,
        }]];
      }

      return [[]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .put('/api/grades/9')
    .set(adminHeaders)
    .send({ score: 88 });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data.grade_point, 3.8);
  assert.equal(calls[0].sql, 'UPDATE grades SET score=? WHERE id=?');
  assert.deepEqual(calls[0].params, [88, 9]);
});

test('PUT /api/grades/:id rejects malformed id strings', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .put('/api/grades/9abc')
    .set(adminHeaders)
    .send({ score: 88 });

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(calls.length, 0);
});

test('GET /api/export/students.csv returns utf-8 csv payload', async () => {
  const mockPool = {
    query: async () => [[
      {
        student_no: '2024001',
        name: '李雷',
        college: '计算机学院',
        major: '数据科学,实验班',
        status: '在读',
      },
    ]],
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .get('/api/export/students.csv')
    .set(adminHeaders);

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /text\/csv/);
  assert.match(response.text, /学号,姓名,学院,专业,状态/);
  assert.match(response.text, /"数据科学,实验班"/);
});

test('student role cannot access the admin student list', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .get('/api/students')
    .set(studentHeaders);

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
  assert.equal(calls.length, 0);
});

test('student role can load only its own transcript', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[[
        {
          student_no: '2024001',
          name: '李雷',
          major: '数据科学',
          course_code: 'CS101',
          course_name: '数据库原理',
          credits: 4,
          score: 90,
          grade_point: 4,
        },
      ]]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .get('/api/transcript/1')
    .set(studentHeaders);

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.data[0].student_no, '2024001');
  assert.deepEqual(calls[0].params, [1]);
});

test('student role cannot load another student transcript', async () => {
  const calls = [];
  const mockPool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  };

  const app = createApp(mockPool);
  const response = await request(app)
    .get('/api/transcript/2')
    .set(studentHeaders);

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
  assert.equal(calls.length, 0);
});
