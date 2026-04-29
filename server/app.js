const express = require('express');
const cors = require('cors');
const path = require('path');

const pool = require('./db');
const {
  normalizeScore,
  parsePositiveInteger,
  sendError,
  toCsv,
} = require('./utils');

const gradeSelect = `
  SELECT g.id, g.student_id, g.course_id,
         s.student_no, s.name AS student_name,
         c.course_code, c.course_name, c.credits,
         g.score, g.grade_point, g.status, g.created_at, g.updated_at
  FROM grades g
  JOIN students s ON g.student_id = s.id
  JOIN courses c ON g.course_id = c.id
`;

const roles = {
  admin: 'admin',
  student: 'student',
};

function getRequestActor(req) {
  const requestedRole = String(req.get('x-user-role') || '').trim().toLowerCase();
  const studentId = parsePositiveInteger(req.get('x-student-id'));

  if (requestedRole === roles.admin) {
    return { role: roles.admin, studentId: null };
  }

  if (requestedRole === roles.student && studentId) {
    return { role: roles.student, studentId };
  }

  return { role: 'guest', studentId: null };
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    const actor = getRequestActor(req);
    req.actor = actor;

    if (!allowedRoles.includes(actor.role)) {
      return sendError(res, 403, '权限不足');
    }

    return next();
  };
}

const requireAdmin = requireRoles(roles.admin);
const requireSignedIn = requireRoles(roles.admin, roles.student);

function requireTranscriptAccess(req, res, next) {
  const actor = getRequestActor(req);
  const studentId = parsePositiveInteger(req.params.studentId);
  req.actor = actor;

  if (!studentId) {
    return sendError(res, 400, '无效的学生 ID');
  }

  if (actor.role === roles.admin) {
    return next();
  }

  if (actor.role === roles.student && actor.studentId === studentId) {
    return next();
  }

  return sendError(res, 403, '学生只能查看自己的成绩单');
}

async function fetchGradeById(dbPool, gradeId) {
  const [rows] = await dbPool.query(
    `${gradeSelect} WHERE g.id = ? LIMIT 1`,
    [gradeId]
  );

  return rows[0] || null;
}

function createApp(dbPool = pool) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..')));

  app.get('/api/session-options', async (req, res) => {
    try {
      const [students] = await dbPool.query(
        'SELECT id, student_no, name, major, college FROM students ORDER BY id LIMIT 200'
      );

      res.json({
        ok: true,
        data: {
          roles: [
            { value: roles.admin, label: '管理员' },
            { value: roles.student, label: '学生' },
          ],
          students,
        },
      });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/me', requireSignedIn, async (req, res) => {
    if (req.actor.role === roles.admin) {
      return res.json({ ok: true, data: { role: roles.admin } });
    }

    try {
      const [rows] = await dbPool.query(
        'SELECT id, student_no, name, major, college, status FROM students WHERE id=? LIMIT 1',
        [req.actor.studentId]
      );

      if (!rows.length) {
        return sendError(res, 404, '学生不存在');
      }

      return res.json({
        ok: true,
        data: {
          role: roles.student,
          student: rows[0],
        },
      });
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  });

  app.get('/api/students', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(
        'SELECT id, student_no, name, major, college, status, created_at, updated_at FROM students ORDER BY id'
      );
      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/search/students', requireAdmin, async (req, res) => {
    const keyword = String(req.query.q || '').trim();
    if (!keyword) {
      return res.json({ ok: true, data: [] });
    }

    const likeKeyword = `%${keyword}%`;

    try {
      const [rows] = await dbPool.query(
        `
          SELECT id, student_no, name, major, college, status
          FROM students
          WHERE student_no LIKE ?
             OR name LIKE ?
             OR major LIKE ?
          ORDER BY
            CASE
              WHEN student_no = ? THEN 0
              WHEN name = ? THEN 1
              WHEN student_no LIKE ? THEN 2
              WHEN name LIKE ? THEN 3
              ELSE 4
            END,
            id
          LIMIT 8
        `,
        [
          likeKeyword,
          likeKeyword,
          likeKeyword,
          keyword,
          keyword,
          `${keyword}%`,
          `${keyword}%`,
        ]
      );

      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.post('/api/students', requireAdmin, async (req, res) => {
    const studentNo = String(req.body.student_no || '').trim();
    const name = String(req.body.name || '').trim();
    const major = String(req.body.major || '').trim();
    const college = String(req.body.college || '').trim();

    if (!studentNo || !name) {
      return sendError(res, 400, '学号和姓名必填');
    }

    try {
      const [result] = await dbPool.query(
        'INSERT INTO students (student_no, name, major, college) VALUES (?, ?, ?, ?)',
        [studentNo, name, major || null, college || null]
      );

      res.json({
        ok: true,
        data: {
          id: result.insertId,
          student_no: studentNo,
          name,
          major: major || null,
          college: college || null,
        },
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 409, '学号已存在');
      }

      sendError(res, 500, err.message);
    }
  });

  app.put('/api/students/:id', requireAdmin, async (req, res) => {
    const studentId = parsePositiveInteger(req.params.id);
    const name = String(req.body.name || '').trim();
    const major = String(req.body.major || '').trim();
    const college = String(req.body.college || '').trim();
    const status = parsePositiveInteger(req.body.status);

    if (!studentId) {
      return sendError(res, 400, '无效的学生 ID');
    }

    if (!name || !status || status > 3) {
      return sendError(res, 400, '姓名和状态不合法');
    }

    try {
      const [result] = await dbPool.query(
        'UPDATE students SET name=?, major=?, college=?, status=? WHERE id=?',
        [name, major || null, college || null, status, studentId]
      );

      if (!result.affectedRows) {
        return sendError(res, 404, '学生不存在');
      }

      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.delete('/api/students/:id', requireAdmin, async (req, res) => {
    const studentId = parsePositiveInteger(req.params.id);
    if (!studentId) {
      return sendError(res, 400, '无效的学生 ID');
    }

    try {
      await dbPool.query('DELETE FROM students WHERE id=?', [studentId]);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/courses', requireSignedIn, async (req, res) => {
    try {
      const [rows] = await dbPool.query(
        'SELECT id, course_code, course_name, teacher, credits, created_at, updated_at FROM courses ORDER BY id'
      );
      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.post('/api/courses', requireAdmin, async (req, res) => {
    const courseCode = String(req.body.course_code || '').trim();
    const courseName = String(req.body.course_name || '').trim();
    const teacher = String(req.body.teacher || '').trim();
    const credits = Number(req.body.credits);

    if (!courseCode || !courseName) {
      return sendError(res, 400, '课程代码和名称必填');
    }

    if (!Number.isFinite(credits) || credits < 0) {
      return sendError(res, 400, '学分不合法');
    }

    try {
      const [result] = await dbPool.query(
        'INSERT INTO courses (course_code, course_name, teacher, credits) VALUES (?, ?, ?, ?)',
        [courseCode, courseName, teacher || null, credits]
      );

      res.json({
        ok: true,
        data: {
          id: result.insertId,
          course_code: courseCode,
          course_name: courseName,
          teacher: teacher || null,
          credits,
        },
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 409, '课程代码已存在');
      }

      sendError(res, 500, err.message);
    }
  });

  app.put('/api/courses/:id', requireAdmin, async (req, res) => {
    const courseId = parsePositiveInteger(req.params.id);
    const courseName = String(req.body.course_name || '').trim();
    const teacher = String(req.body.teacher || '').trim();
    const credits = Number(req.body.credits);

    if (!courseId) {
      return sendError(res, 400, '无效的课程 ID');
    }

    if (!courseName || !Number.isFinite(credits) || credits < 0) {
      return sendError(res, 400, '课程名称或学分不合法');
    }

    try {
      const [result] = await dbPool.query(
        'UPDATE courses SET course_name=?, teacher=?, credits=? WHERE id=?',
        [courseName, teacher || null, credits, courseId]
      );

      if (!result.affectedRows) {
        return sendError(res, 404, '课程不存在');
      }

      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.delete('/api/courses/:id', requireAdmin, async (req, res) => {
    const courseId = parsePositiveInteger(req.params.id);
    if (!courseId) {
      return sendError(res, 400, '无效的课程 ID');
    }

    try {
      await dbPool.query('DELETE FROM courses WHERE id=?', [courseId]);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/grades', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(
        `${gradeSelect} ORDER BY g.updated_at DESC, g.id DESC`
      );
      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.post('/api/grades', requireAdmin, async (req, res) => {
    const studentId = parsePositiveInteger(req.body.student_id);
    const courseId = parsePositiveInteger(req.body.course_id);
    const score = normalizeScore(req.body.score);

    if (!studentId || !courseId || score == null) {
      return sendError(res, 400, '学生、课程和分数必填，且分数需在 0 到 100 之间');
    }

    try {
      const [result] = await dbPool.query(
        'INSERT INTO grades (student_id, course_id, score, status) VALUES (?, ?, ?, 1)',
        [studentId, courseId, score]
      );
      const insertedGrade = await fetchGradeById(dbPool, result.insertId);

      res.json({ ok: true, data: insertedGrade });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 409, '该学生该课程已有成绩');
      }

      sendError(res, 500, err.message);
    }
  });

  app.put('/api/grades/:id', requireAdmin, async (req, res) => {
    const gradeId = parsePositiveInteger(req.params.id);
    const score = normalizeScore(req.body.score);

    if (!gradeId) {
      return sendError(res, 400, '无效的成绩 ID');
    }

    if (score == null) {
      return sendError(res, 400, '分数需在 0 到 100 之间');
    }

    try {
      const [result] = await dbPool.query(
        'UPDATE grades SET score=? WHERE id=?',
        [score, gradeId]
      );

      if (!result.affectedRows) {
        return sendError(res, 404, '成绩不存在');
      }

      const updatedGrade = await fetchGradeById(dbPool, gradeId);
      res.json({ ok: true, data: updatedGrade });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.delete('/api/grades/:id', requireAdmin, async (req, res) => {
    const gradeId = parsePositiveInteger(req.params.id);
    if (!gradeId) {
      return sendError(res, 400, '无效的成绩 ID');
    }

    try {
      await dbPool.query('DELETE FROM grades WHERE id=?', [gradeId]);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/gpa', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(
        'SELECT * FROM v_student_gpa_stats ORDER BY final_gpa DESC, student_no'
      );
      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/stats', requireAdmin, async (req, res) => {
    try {
      const [[{ student_count }]] = await dbPool.query(
        'SELECT COUNT(*) AS student_count FROM students'
      );
      const [[{ course_count }]] = await dbPool.query(
        'SELECT COUNT(*) AS course_count FROM courses'
      );
      const [[{ grade_count }]] = await dbPool.query(
        'SELECT COUNT(*) AS grade_count FROM grades'
      );
      const [[{ fail_count }]] = await dbPool.query(
        'SELECT COUNT(*) AS fail_count FROM grades WHERE score < 60'
      );
      const [[{ avg_score }]] = await dbPool.query(
        'SELECT ROUND(AVG(score), 1) AS avg_score FROM grades'
      );
      res.json({
        ok: true,
        data: {
          student_count,
          course_count,
          grade_count,
          fail_count,
          avg_score: avg_score ?? 0,
        },
      });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/charts/score-distribution', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(`
        SELECT
          SUM(score >= 90) AS excellent,
          SUM(score >= 80 AND score < 90) AS good,
          SUM(score >= 70 AND score < 80) AS medium,
          SUM(score >= 60 AND score < 70) AS pass,
          SUM(score < 60) AS fail
        FROM grades
      `);
      res.json({ ok: true, data: rows[0] || {} });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/charts/course-stats', requireSignedIn, async (req, res) => {
    try {
      const [rows] = await dbPool.query(`
        SELECT c.id, c.course_code, c.course_name,
          ROUND(AVG(g.score), 1) AS avg_score,
          MAX(g.score) AS max_score,
          MIN(g.score) AS min_score,
          COUNT(*) AS student_count
        FROM grades g
        JOIN courses c ON g.course_id = c.id
        GROUP BY c.id, c.course_code, c.course_name
        ORDER BY avg_score DESC
      `);
      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/charts/major-stats', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(`
        SELECT s.major,
          ROUND(AVG(g.score), 1) AS avg_score,
          COUNT(DISTINCT s.id) AS student_count,
          SUM(g.score < 60) AS fail_count
        FROM grades g
        JOIN students s ON g.student_id = s.id
        GROUP BY s.major
        ORDER BY avg_score DESC
      `);
      res.json({ ok: true, data: rows });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/audit-log', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(`
        SELECT l.*, s.name AS student_name, c.course_name
        FROM grade_audit_log l
        LEFT JOIN students s ON l.student_id = s.id
        LEFT JOIN courses c ON l.course_id = c.id
        ORDER BY l.operated_at DESC
        LIMIT 50
      `);
      res.json({ ok: true, data: rows });
    } catch (err) {
      res.json({ ok: true, data: [] });
    }
  });

  app.get('/api/transcript/:studentId', requireTranscriptAccess, async (req, res) => {
    const studentId = parsePositiveInteger(req.params.studentId);
    if (!studentId) {
      return sendError(res, 400, '无效的学生 ID');
    }

    try {
      const [rows] = await dbPool.query('CALL sp_student_transcript(?)', [
        studentId,
      ]);
      res.json({ ok: true, data: rows[0] || [] });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/course-analysis/:courseId', requireSignedIn, async (req, res) => {
    const courseId = parsePositiveInteger(req.params.courseId);
    if (!courseId) {
      return sendError(res, 400, '无效的课程 ID');
    }

    try {
      const [rows] = await dbPool.query('CALL sp_course_analysis(?)', [
        courseId,
      ]);
      res.json({ ok: true, data: rows[0] || [] });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/export/students.csv', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(`
        SELECT student_no, name, college, major,
          CASE status
            WHEN 1 THEN '在读'
            WHEN 2 THEN '休学'
            WHEN 3 THEN '毕业'
            ELSE '未知'
          END AS status
        FROM students
        ORDER BY id
      `);

      const csvContent = toCsv(
        [
          { key: 'student_no', label: '学号' },
          { key: 'name', label: '姓名' },
          { key: 'college', label: '学院' },
          { key: 'major', label: '专业' },
          { key: 'status', label: '状态' },
        ],
        rows
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="students-export.csv"'
      );
      res.send(csvContent);
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/export/grades.csv', requireAdmin, async (req, res) => {
    try {
      const [rows] = await dbPool.query(`
        SELECT s.student_no, s.name AS student_name, c.course_code, c.course_name,
          c.credits, g.score, g.grade_point,
          CASE
            WHEN g.score >= 90 THEN '优秀'
            WHEN g.score >= 80 THEN '良好'
            WHEN g.score >= 70 THEN '中等'
            WHEN g.score >= 60 THEN '及格'
            ELSE '不及格'
          END AS level
        FROM grades g
        JOIN students s ON g.student_id = s.id
        JOIN courses c ON g.course_id = c.id
        ORDER BY s.student_no, c.course_code
      `);

      const csvContent = toCsv(
        [
          { key: 'student_no', label: '学号' },
          { key: 'student_name', label: '姓名' },
          { key: 'course_code', label: '课程代码' },
          { key: 'course_name', label: '课程名称' },
          { key: 'credits', label: '学分' },
          { key: 'score', label: '分数' },
          { key: 'grade_point', label: '绩点' },
          { key: 'level', label: '等级' },
        ],
        rows
      );

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="grades-export.csv"'
      );
      res.send(csvContent);
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  app.get('/api/db-objects', requireAdmin, async (req, res) => {
    try {
      const [tables] = await dbPool.query(
        "SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA='grade_system' AND TABLE_TYPE='BASE TABLE'"
      );
      const [triggers] = await dbPool.query(
        "SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='grade_system'"
      );
      const [views] = await dbPool.query(
        "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA='grade_system'"
      );
      const [procedures] = await dbPool.query(
        "SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='grade_system'"
      );
      const [indexes] = await dbPool.query(
        "SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='grade_system' ORDER BY TABLE_NAME, INDEX_NAME"
      );

      res.json({
        ok: true,
        data: { tables, triggers, views, procedures, indexes },
      });
    } catch (err) {
      sendError(res, 500, err.message);
    }
  });

  return app;
}

module.exports = {
  createApp,
};
