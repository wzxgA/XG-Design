package com.xgdesign.project.dto;

/**
 * 与前端 ShareInfo 对齐。
 * 本期分享仍为本地语义，服务端 share_links 暂无记录，返回 null；
 * S3 接入分享后再从 share_links 查询。
 */
public record ShareInfoDto(String link, String permission, boolean active, long createdAt) {
}
