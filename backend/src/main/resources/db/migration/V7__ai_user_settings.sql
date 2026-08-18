-- V7: 用户自配 AI 服务配置表（每用户一行；未配置时回退全局 application.yml）
CREATE TABLE IF NOT EXISTS ai_user_settings (
    user_id    UUID PRIMARY KEY,
    base_url   VARCHAR(500),
    api_key    VARCHAR(500),
    model      VARCHAR(100),
    updated_at TIMESTAMP
);
