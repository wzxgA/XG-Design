-- S3：认证与分享
-- 1) operation_logs.document_id 改为可空：auth 的 register/login 等非文档操作也需落日志
ALTER TABLE operation_logs ALTER COLUMN document_id DROP NOT NULL;

-- 2) S2 种子用户下线说明：
--    V2 创建的 dev@xgdesign.local 密码哈希为占位符（非合法 BCrypt），无法登录，
--    S3 起用户体系切换为真实注册用户。保留该行以维持外键完整性，不参与任何业务。
--    不在此删除，避免级联影响 S2 遗留数据。
