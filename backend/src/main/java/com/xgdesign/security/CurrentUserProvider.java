package com.xgdesign.security;

import com.xgdesign.auth.AuthPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/**
 * 当前用户解析：从 SecurityContext 读取 JwtAuthFilter 写入的 AuthPrincipal。
 */
public final class CurrentUserProvider {

    private CurrentUserProvider() {
    }

    /** 当前登录用户 id；未认证（匿名分享编辑）返回 null。 */
    public static UUID currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal) {
            return principal.userId();
        }
        return null;
    }

    /** 必须登录的上下文使用；未认证抛 IllegalStateException。 */
    public static UUID requireUserId() {
        UUID userId = currentUserId();
        if (userId == null) {
            throw new IllegalStateException("未认证用户");
        }
        return userId;
    }
}
