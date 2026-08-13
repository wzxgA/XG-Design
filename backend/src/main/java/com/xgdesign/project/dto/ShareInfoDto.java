package com.xgdesign.project.dto;

import com.xgdesign.project.ShareLinkEntity;

/**
 * 分享状态摘要：{ token, permission, active, createdAt }。
 * token 为高熵随机串（32 字节 Base64URL），前端拼完整 URL：{origin}/#/share/{token}。
 */
public record ShareInfoDto(String token, String permission, boolean active, long createdAt) {

    public static ShareInfoDto from(ShareLinkEntity entity) {
        return new ShareInfoDto(
                entity.getToken(),
                entity.getPermission(),
                entity.isActive(),
                entity.getCreatedAt().toEpochMilli());
    }
}
