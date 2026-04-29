USE grade_system;

-- 触发器：UPDATE时重算绩点
DELIMITER //
CREATE TRIGGER trg_update_grade_point
BEFORE UPDATE ON grades FOR EACH ROW
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

-- 审计日志表
CREATE TABLE IF NOT EXISTS grade_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    grade_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    course_id BIGINT NOT NULL,
    old_score DECIMAL(5,2) DEFAULT NULL,
    new_score DECIMAL(5,2) DEFAULT NULL,
    operation VARCHAR(10) NOT NULL,
    operated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_grade_id (grade_id),
    KEY idx_operated_at (operated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩变更审计日志';

-- 审计触发器
DELIMITER //
CREATE TRIGGER trg_audit_grade_insert AFTER INSERT ON grades FOR EACH ROW
BEGIN
    INSERT INTO grade_audit_log (grade_id,student_id,course_id,old_score,new_score,operation) VALUES (NEW.id,NEW.student_id,NEW.course_id,NULL,NEW.score,'INSERT');
END //

CREATE TRIGGER trg_audit_grade_update AFTER UPDATE ON grades FOR EACH ROW
BEGIN
    IF NEW.score != OLD.score THEN
        INSERT INTO grade_audit_log (grade_id,student_id,course_id,old_score,new_score,operation) VALUES (NEW.id,NEW.student_id,NEW.course_id,OLD.score,NEW.score,'UPDATE');
    END IF;
END //

CREATE TRIGGER trg_audit_grade_delete AFTER DELETE ON grades FOR EACH ROW
BEGIN
    INSERT INTO grade_audit_log (grade_id,student_id,course_id,old_score,new_score,operation) VALUES (OLD.id,OLD.student_id,OLD.course_id,OLD.score,NULL,'DELETE');
END //
DELIMITER ;

-- 存储过程：学生成绩单
DELIMITER //
CREATE PROCEDURE sp_student_transcript(IN p_student_id BIGINT)
BEGIN
    SELECT s.student_no,s.name,s.major,c.course_code,c.course_name,c.credits,g.score,g.grade_point,
        CASE WHEN g.score>=90 THEN '优秀' WHEN g.score>=80 THEN '良好' WHEN g.score>=70 THEN '中等' WHEN g.score>=60 THEN '及格' ELSE '不及格' END AS grade_level
    FROM grades g JOIN students s ON g.student_id=s.id JOIN courses c ON g.course_id=c.id
    WHERE g.student_id=p_student_id ORDER BY c.course_code;
END //
DELIMITER ;

-- 存储过程：课程分析
DELIMITER //
CREATE PROCEDURE sp_course_analysis(IN p_course_id BIGINT)
BEGIN
    SELECT c.course_name,COUNT(*) AS total_students,ROUND(AVG(g.score),1) AS avg_score,MAX(g.score) AS max_score,MIN(g.score) AS min_score,
        SUM(g.score>=90) AS excellent_count,SUM(g.score>=80 AND g.score<90) AS good_count,SUM(g.score>=70 AND g.score<80) AS medium_count,
        SUM(g.score>=60 AND g.score<70) AS pass_count,SUM(g.score<60) AS fail_count,ROUND(SUM(g.score>=60)/COUNT(*)*100,1) AS pass_rate
    FROM grades g JOIN courses c ON g.course_id=c.id WHERE g.course_id=p_course_id GROUP BY c.course_name;
END //
DELIMITER ;

-- 视图：课程成绩概览
CREATE OR REPLACE VIEW v_course_grade_overview AS
SELECT c.id AS course_id,c.course_code,c.course_name,c.credits,COUNT(g.id) AS student_count,
    ROUND(AVG(g.score),1) AS avg_score,MAX(g.score) AS max_score,MIN(g.score) AS min_score,
    ROUND(SUM(g.score>=60)/COUNT(*)*100,1) AS pass_rate
FROM courses c LEFT JOIN grades g ON c.id=g.course_id GROUP BY c.id,c.course_code,c.course_name,c.credits;
