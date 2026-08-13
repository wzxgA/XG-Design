package com.xgdesign.auth.dto;

import com.xgdesign.auth.UserEntity;

import java.util.UUID;

public record UserDto(UUID id, String email, String displayName) {

    public static UserDto from(UserEntity entity) {
        return new UserDto(entity.getId(), entity.getEmail(), entity.getDisplayName());
    }
}
