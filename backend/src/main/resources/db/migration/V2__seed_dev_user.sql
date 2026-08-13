INSERT INTO users (id, email, password_hash, display_name)
VALUES ('00000000-0000-0000-0000-000000000001',
        'dev@xgdesign.local', '$2a$10$REPLACE_ME', '开发用户')
ON CONFLICT (id) DO NOTHING;
