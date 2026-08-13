package com.xgdesign.auth;

import com.xgdesign.auth.dto.AuthResponse;
import com.xgdesign.auth.dto.LoginRequest;
import com.xgdesign.auth.dto.RegisterRequest;
import com.xgdesign.auth.dto.UserDto;
import com.xgdesign.common.EmailAlreadyRegisteredException;
import com.xgdesign.common.InvalidCredentialsException;
import com.xgdesign.common.NotFoundException;
import com.xgdesign.project.OperationLogEntity;
import com.xgdesign.project.OperationLogRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OperationLogRepository operationLogRepository;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       OperationLogRepository operationLogRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.operationLogRepository = operationLogRepository;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new EmailAlreadyRegisteredException("该邮箱已注册");
        }

        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        userRepository.save(user);

        logAuth("register", user);
        return toAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();
        UserEntity user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new InvalidCredentialsException("邮箱或密码错误"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("邮箱或密码错误");
        }

        logAuth("login", user);
        return toAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("用户不存在"));
        return UserDto.from(user);
    }

    private AuthResponse toAuthResponse(UserEntity user) {
        return new AuthResponse(jwtService.issueToken(user.getId()), UserDto.from(user));
    }

    private void logAuth(String action, UserEntity user) {
        OperationLogEntity logEntity = new OperationLogEntity();
        logEntity.setUserId(user.getId());
        logEntity.setAction(action);
        logEntity.setDetail("{\"email\":\"" + user.getEmail() + "\"}");
        operationLogRepository.save(logEntity);
    }
}
