package com.xgdesign.project.dto;

/**
 * GET /api/documents/{id} 响应 data。
 * content 为前端 DesignDocument 整体 JSON。
 */
public record DocumentDto(ProjectMetaDto meta, Object content, long version) {
}
