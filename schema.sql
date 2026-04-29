-- 数据库课程设计：极简学生成绩管理系统方案 (Student Grade Management)
-- 特性：包含完善的外键约束、审计字段、简单的触发器（根据成绩自动算绩点）与聚合统计视图

-- 0. 创建并切换到数据库
CREATE DATABASE IF NOT EXISTS `grade_system`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `grade_system`;

-- 1. 创建学生表
CREATE TABLE `students` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `student_no` VARCHAR(20) NOT NULL COMMENT '学号',
  `name` VARCHAR(50) NOT NULL COMMENT '姓名',
  `major` VARCHAR(100) DEFAULT NULL COMMENT '专业名称',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '学籍状态: 1-在读, 2-休学, 3-毕业',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_no` (`student_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生信息表';

-- 2. 创建课程表
CREATE TABLE `courses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `course_code` VARCHAR(20) NOT NULL COMMENT '课程代码',
  `course_name` VARCHAR(100) NOT NULL COMMENT '课程名称',
  `credits` DECIMAL(3,1) NOT NULL DEFAULT 0.0 COMMENT '该课学分',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_course_code` (`course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程信息表';

-- 3. 创建成绩单表
CREATE TABLE `grades` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `course_id` BIGINT NOT NULL COMMENT '课程ID',
  `score` DECIMAL(5,2) DEFAULT NULL COMMENT '考试卷面成绩 (0-100)',
  `grade_point` DECIMAL(3,2) DEFAULT 0.00 COMMENT '绩点 (由触发器自动计算)',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 1-正常录入, 2-缓考, 3-缺考',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_student_course` (`student_id`, `course_id`) COMMENT '一个学生一门课只能有一条正式成绩',
  KEY `idx_course_id` (`course_id`),
  CONSTRAINT `fk_grade_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_grade_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩记录表';


-- ==========================================
-- 工程化加分项 (数据库对象编排)
-- ==========================================

-- A. 高级应用：自动计算绩点的触发器 (Trigger)
-- 策略：(成绩-50)/10，例如考85分，绩点是3.5；低于60分为0绩点。
DELIMITER //
CREATE TRIGGER `trg_calc_grade_point` 
BEFORE INSERT ON `grades`
FOR EACH ROW 
BEGIN
    IF NEW.score IS NOT NULL THEN
        IF NEW.score >= 60.00 THEN
            SET NEW.grade_point = (NEW.score - 50.00) / 10.00;
        ELSE
            SET NEW.grade_point = 0.00;
        END IF;
    END IF;
END //
DELIMITER ;


-- B. 高级应用：视图 (View) - 统计每个学生的总学分与平均绩点 (GPA)
CREATE OR REPLACE VIEW `v_student_gpa_stats` AS
SELECT 
    s.id AS student_id,
    s.student_no,
    s.name,
    s.major,
    COUNT(g.id) AS course_count,
    SUM(c.credits) AS total_credits,
    -- 加权平均绩点 = SUM(对应课程绩点 * 对应课程学分) / 总学分
    CAST(IFNULL(SUM(g.grade_point * c.credits) / NULLIF(SUM(c.credits), 0), 0) AS DECIMAL(4,2)) AS final_gpa
FROM `students` s
LEFT JOIN `grades` g ON s.id = g.student_id AND g.status = 1
LEFT JOIN `courses` c ON g.course_id = c.id
GROUP BY s.id, s.student_no, s.name, s.major;


-- C. 触发器2：修改成绩时也自动重算绩点 (BEFORE UPDATE)
DELIMITER //
CREATE TRIGGER `trg_update_grade_point`
BEFORE UPDATE ON `grades`
FOR EACH ROW
BEGIN
    IF NEW.score IS NOT NULL AND NEW.score != OLD.score THEN
        IF NEW.score >= 60.00 THEN
            SET NEW.grade_point = (NEW.score - 50.00) / 10.00;
        ELSE
            SET NEW.grade_point = 0.00;
        END IF;
    END IF;
END //
DELIMITER ;


-- D. 审计日志表 + 触发器：记录每次成绩变更
CREATE TABLE `grade_audit_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `grade_id` BIGINT NOT NULL COMMENT '成绩记录ID',
    `student_id` BIGINT NOT NULL,
    `course_id` BIGINT NOT NULL,
    `old_score` DECIMAL(5,2) DEFAULT NULL COMMENT '修改前的分数',
    `new_score` DECIMAL(5,2) DEFAULT NULL COMMENT '修改后的分数',
    `operation` VARCHAR(10) NOT NULL COMMENT 'INSERT/UPDATE/DELETE',
    `operated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
    PRIMARY KEY (`id`),
    KEY `idx_grade_id` (`grade_id`),
    KEY `idx_operated_at` (`operated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩变更审计日志';

DELIMITER //
CREATE TRIGGER `trg_audit_grade_insert`
AFTER INSERT ON `grades`
FOR EACH ROW
BEGIN
    INSERT INTO `grade_audit_log` (grade_id, student_id, course_id, old_score, new_score, operation)
    VALUES (NEW.id, NEW.student_id, NEW.course_id, NULL, NEW.score, 'INSERT');
END //

CREATE TRIGGER `trg_audit_grade_update`
AFTER UPDATE ON `grades`
FOR EACH ROW
BEGIN
    IF NEW.score != OLD.score THEN
        INSERT INTO `grade_audit_log` (grade_id, student_id, course_id, old_score, new_score, operation)
        VALUES (NEW.id, NEW.student_id, NEW.course_id, OLD.score, NEW.score, 'UPDATE');
    END IF;
END //

CREATE TRIGGER `trg_audit_grade_delete`
AFTER DELETE ON `grades`
FOR EACH ROW
BEGIN
    INSERT INTO `grade_audit_log` (grade_id, student_id, course_id, old_score, new_score, operation)
    VALUES (OLD.id, OLD.student_id, OLD.course_id, OLD.score, NULL, 'DELETE');
END //
DELIMITER ;


-- E. 存储过程1：查询某学生的完整成绩单
DELIMITER //
CREATE PROCEDURE `sp_student_transcript`(IN p_student_id BIGINT)
BEGIN
    SELECT 
        s.student_no, s.name, s.major,
        c.course_code, c.course_name, c.credits,
        g.score, g.grade_point,
        CASE 
            WHEN g.score >= 90 THEN '优秀'
            WHEN g.score >= 80 THEN '良好'
            WHEN g.score >= 70 THEN '中等'
            WHEN g.score >= 60 THEN '及格'
            ELSE '不及格'
        END AS grade_level
    FROM grades g
    JOIN students s ON g.student_id = s.id
    JOIN courses c ON g.course_id = c.id
    WHERE g.student_id = p_student_id
    ORDER BY c.course_code;
END //
DELIMITER ;


-- F. 存储过程2：统计某课程的成绩分布
DELIMITER //
CREATE PROCEDURE `sp_course_analysis`(IN p_course_id BIGINT)
BEGIN
    SELECT 
        c.course_name,
        COUNT(*) AS total_students,
        ROUND(AVG(g.score), 1) AS avg_score,
        MAX(g.score) AS max_score,
        MIN(g.score) AS min_score,
        SUM(g.score >= 90) AS excellent_count,
        SUM(g.score >= 80 AND g.score < 90) AS good_count,
        SUM(g.score >= 70 AND g.score < 80) AS medium_count,
        SUM(g.score >= 60 AND g.score < 70) AS pass_count,
        SUM(g.score < 60) AS fail_count,
        ROUND(SUM(g.score >= 60) / COUNT(*) * 100, 1) AS pass_rate
    FROM grades g
    JOIN courses c ON g.course_id = c.id
    WHERE g.course_id = p_course_id
    GROUP BY c.course_name;
END //
DELIMITER ;


-- G. 视图2：课程成绩概览视图（带等级分布）
CREATE OR REPLACE VIEW `v_course_grade_overview` AS
SELECT 
    c.id AS course_id,
    c.course_code,
    c.course_name,
    c.credits,
    COUNT(g.id) AS student_count,
    ROUND(AVG(g.score), 1) AS avg_score,
    MAX(g.score) AS max_score,
    MIN(g.score) AS min_score,
    ROUND(SUM(g.score >= 60) / COUNT(*) * 100, 1) AS pass_rate
FROM courses c
LEFT JOIN grades g ON c.id = g.course_id
GROUP BY c.id, c.course_code, c.course_name, c.credits;


-- ==========================================
-- 演示用初始化数据 (Seed Data)
-- ==========================================

-- 学生样本
INSERT INTO `students` (student_no, name, major) VALUES
  ('2024001', '李雷',  '计算机科学与技术'),
  ('2024002', '韩梅梅','软件工程'),
  ('2024003', '林涛',  '网络安全'),
  ('2024004', '陈雨',  '数据科学'),
  ('2024005', '吉姆',  '人工智能');

-- 课程样本
INSERT INTO `courses` (course_code, course_name, credits) VALUES
  ('CS101', '数据库原理',       4.0),
  ('CS102', '数据结构',         3.5),
  ('CS103', '操作系统',         3.0),
  ('CS104', '计算机网络',       3.0),
  ('CS105', '软件工程方法论',   2.5);

-- 成绩样本（Trigger 会自动在 INSERT 时计算 grade_point）
INSERT INTO `grades` (student_id, course_id, score) VALUES
  (1, 1, 88),
  (1, 2, 92),
  (2, 1, 95),
  (2, 2, 78),
  (2, 3, 85),
  (3, 1, 72),
  (3, 3, 65),
  (4, 2, 55),
  (4, 4, 81),
  (5, 1, 90),
  (5, 5, 76);

