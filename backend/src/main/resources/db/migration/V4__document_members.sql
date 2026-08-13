-- S4：成员管理 document_members 落地。
-- V1 建的表结构（PK(document_id,user_id)）无 id/created_at，且从未有任何代码写入，
-- 直接重建为带 id 的新结构并回填现有文档的 owner 成员。

DROP TABLE IF EXISTS document_members;

CREATE TABLE document_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(8) NOT NULL CHECK (role IN ('owner','editor','viewer')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, user_id)
);
CREATE INDEX idx_document_members_doc ON document_members(document_id);

-- 为现有文档回填 owner 成员记录
INSERT INTO document_members (document_id, user_id, role)
SELECT id, owner_id, 'owner' FROM documents;
