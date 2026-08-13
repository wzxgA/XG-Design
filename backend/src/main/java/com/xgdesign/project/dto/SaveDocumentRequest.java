package com.xgdesign.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * PUT /api/documents/{id} 请求体。
 */
public record SaveDocumentRequest(
        @NotBlank(message = "名称不能为空") @Size(max = 80, message = "名称不能超过 80 字") String name,
        @NotBlank(message = "content 不能为空") String content,
        long version
) {
}
