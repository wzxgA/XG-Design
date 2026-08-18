-- V6: AI 消息表增加 editDesign 工具产生的修改操作字段
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS edit_operations TEXT;
ALTER TABLE ai_chat_messages ADD COLUMN IF NOT EXISTS edit_description VARCHAR(500);
