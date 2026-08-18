-- V8: AI 对话消息增加任务清单（planTasks 工具）与逐任务结果（任务清单增量执行）
ALTER TABLE ai_chat_messages
    ADD COLUMN IF NOT EXISTS task_plan    TEXT NULL,
    ADD COLUMN IF NOT EXISTS task_results TEXT NULL;
