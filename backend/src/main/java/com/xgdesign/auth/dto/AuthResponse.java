package com.xgdesign.auth.dto;

public record AuthResponse(String token, UserDto user) {
}
