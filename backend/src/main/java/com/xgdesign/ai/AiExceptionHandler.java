package com.xgdesign.ai;

import com.xgdesign.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * AI 模块异常处理。
 */
@RestControllerAdvice
public class AiExceptionHandler {

    /** 503 AI 功能未启用 */
    @ExceptionHandler(AiDisabledException.class)
    public ResponseEntity<ApiResponse<Void>> handleDisabled(AiDisabledException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ApiResponse.error(5031, e.getMessage()));
    }

    /** 502 AI 服务调用失败（LLM 不可达 / 响应异常） */
    @ExceptionHandler(AiException.class)
    public ResponseEntity<ApiResponse<Void>> handleAiError(AiException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error(5021, e.getMessage()));
    }
}
