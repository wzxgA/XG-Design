package com.xgdesign.security;

import java.util.UUID;

/**
 * 当前用户解析（本期开发态）。
 * <p>
 * 直接返回种子用户 dev-user，S3 接入 JWT 后替换为从 SecurityContext 读取真实用户，
 * Service 层接口不变。
 */
public final class CurrentUserProvider {

    public static final UUID DEV_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private CurrentUserProvider() {
    }

    public static UUID currentUserId() {
        return DEV_USER_ID;
    }
}
