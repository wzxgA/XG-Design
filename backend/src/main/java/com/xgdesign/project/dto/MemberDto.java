package com.xgdesign.project.dto;

import com.xgdesign.auth.UserEntity;
import com.xgdesign.project.DocumentMemberEntity;

import java.util.UUID;

/**
 * 成员摘要：{ userId, email, displayName, role, createdAt }。
 * role ∈ {owner, editor, viewer}。
 */
public record MemberDto(UUID userId, String email, String displayName, String role, long createdAt) {

    public static MemberDto from(DocumentMemberEntity member, UserEntity user) {
        return new MemberDto(
                member.getUserId(),
                user.getEmail(),
                user.getDisplayName(),
                member.getRole(),
                member.getCreatedAt().toEpochMilli());
    }
}
