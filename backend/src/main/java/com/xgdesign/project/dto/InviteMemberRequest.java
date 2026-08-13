package com.xgdesign.project.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * 邀请成员：按邮箱定位用户，指定角色（editor/viewer；owner 只能由系统写入）。
 */
public record InviteMemberRequest(
        @NotBlank(message = "邮箱不能为空")
        @Email(message = "邮箱格式不正确")
        String email,

        @NotBlank(message = "角色不能为空")
        @Pattern(regexp = "editor|viewer", message = "角色只能是 editor 或 viewer")
        String role
) {
}
