package com.xgdesign.project.dto;

import jakarta.validation.constraints.Size;

/**
 * POST /api/projects 请求体；name 可选（缺省用模板默认名）。
 */
public record CreateProjectRequest(
        @Size(max = 80, message = "名称不能超过 80 字") String name
) {
}
