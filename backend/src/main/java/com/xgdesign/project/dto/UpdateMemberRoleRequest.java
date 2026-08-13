package com.xgdesign.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 修改成员角色：仅允许 editor / viewer；owner 不可被改动。
 */
public record UpdateMemberRoleRequest(
        @NotBlank(message = "角色不能为空")
        @Pattern(regexp = "editor|viewer", message = "角色只能是 editor 或 viewer")
        String role
) {
}
