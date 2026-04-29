-- 迁移脚本：新增学院(college)和任课教师(teacher)字段
USE `grade_system`;

-- 1. 学生表新增学院字段（在 major 后面）
ALTER TABLE `students`
  ADD COLUMN `college` VARCHAR(100) DEFAULT NULL COMMENT '所属学院' AFTER `major`;

-- 2. 课程表新增任课教师字段（在 course_name 后面）
ALTER TABLE `courses`
  ADD COLUMN `teacher` VARCHAR(50) DEFAULT NULL COMMENT '任课教师' AFTER `course_name`;

-- 3. 同步更新 GPA 视图，加入 college 字段
CREATE OR REPLACE VIEW `v_student_gpa_stats` AS
SELECT
    s.id AS student_id,
    s.student_no,
    s.name,
    s.major,
    s.college,
    COUNT(g.id) AS course_count,
    SUM(c.credits) AS total_credits,
    CAST(IFNULL(SUM(g.grade_point * c.credits) / NULLIF(SUM(c.credits), 0), 0) AS DECIMAL(4,2)) AS final_gpa
FROM `students` s
LEFT JOIN `grades` g ON s.id = g.student_id AND g.status = 1
LEFT JOIN `courses` c ON g.course_id = c.id
GROUP BY s.id, s.student_no, s.name, s.major, s.college;

-- 4. 同步更新课程概览视图，加入 teacher 字段
CREATE OR REPLACE VIEW `v_course_grade_overview` AS
SELECT
    c.id AS course_id,
    c.course_code,
    c.course_name,
    c.teacher,
    c.credits,
    COUNT(g.id) AS student_count,
    ROUND(AVG(g.score), 1) AS avg_score,
    MAX(g.score) AS max_score,
    MIN(g.score) AS min_score,
    ROUND(SUM(g.score >= 60) / COUNT(*) * 100, 1) AS pass_rate
FROM courses c
LEFT JOIN grades g ON c.id = g.course_id
GROUP BY c.id, c.course_code, c.course_name, c.teacher, c.credits;

-- 5. 补充示例数据：给现有学生赋学院
UPDATE `students` SET `college` = '信息工程学院' WHERE `student_no` IN ('2024001','2024002','2024003','2024004','2024005');

-- 6. 补充示例数据：给现有课程赋任课教师
UPDATE `courses` SET `teacher` = '张伟' WHERE `course_code` = 'CS101';
UPDATE `courses` SET `teacher` = '李娜' WHERE `course_code` = 'CS102';
UPDATE `courses` SET `teacher` = '王强' WHERE `course_code` = 'CS103';
UPDATE `courses` SET `teacher` = '刘芳' WHERE `course_code` = 'CS104';
UPDATE `courses` SET `teacher` = '陈磊' WHERE `course_code` = 'CS105';
