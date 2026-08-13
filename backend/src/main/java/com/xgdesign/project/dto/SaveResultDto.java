package com.xgdesign.project.dto;

/**
 * PUT /api/documents/{id} 响应 data：{ version, updatedAt }。
 */
public record SaveResultDto(long version, long updatedAt) {
}
