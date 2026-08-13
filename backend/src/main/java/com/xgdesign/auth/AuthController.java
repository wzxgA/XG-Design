package com.xgdesign.auth;

import com.xgdesign.auth.dto.AuthResponse;
import com.xgdesign.auth.dto.LoginRequest;
import com.xgdesign.auth.dto.RegisterRequest;
import com.xgdesign.auth.dto.UserDto;
import com.xgdesign.common.ApiResponse;
import com.xgdesign.security.CurrentUserProvider;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** 注册并直接返回 token */
    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    /** 登录并返回 token */
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    /** 当前登录用户信息（前端恢复会话用） */
    @GetMapping("/me")
    public ApiResponse<UserDto> me() {
        return ApiResponse.ok(authService.me(CurrentUserProvider.requireUserId()));
    }
}
