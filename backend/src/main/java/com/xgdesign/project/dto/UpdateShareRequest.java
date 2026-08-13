package com.xgdesign.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateShareRequest(
        @NotBlank(message = "permission 不能为空")
        @Pattern(regexp = "view|edit", message = "permission 必须为 view 或 edit")
        String permission
) {
}
