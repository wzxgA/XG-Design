package com.xgdesign.auth;

import java.util.UUID;

/**
 * SecurityContext 中携带的当前用户主体（轻量，仅 userId）。
 */
public record AuthPrincipal(UUID userId) {
}
