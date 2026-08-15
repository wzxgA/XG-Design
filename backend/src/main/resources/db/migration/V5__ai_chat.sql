-- S5：AI 设计助手 — 对话会话与消息持久化

CREATE TABLE ai_chat_sessions (
    id              UUID        PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id     UUID        NULL REFERENCES documents(id) ON DELETE SET NULL,
    title           VARCHAR(200) NOT NULL DEFAULT '新对话',
    message_count   INT         NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_sessions_user     ON ai_chat_sessions(user_id);
CREATE INDEX idx_ai_sessions_document ON ai_chat_sessions(document_id);
CREATE INDEX idx_ai_sessions_last_msg ON ai_chat_sessions(user_id, last_message_at DESC);

CREATE TABLE ai_chat_messages (
    id                  UUID        PRIMARY KEY,
    session_id          UUID        NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role                VARCHAR(20) NOT NULL,
    content             TEXT        NOT NULL,
    design_suggestion   TEXT        NULL,
    design_description  VARCHAR(500) NULL,
    token_count         INT         NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_session ON ai_chat_messages(session_id, created_at);
