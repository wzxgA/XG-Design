package com.xgdesign.ai.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * AI 对话请求。
 */
public record ChatRequest(
        String sessionId,
        @NotBlank(message = "消息内容不能为空") String message,
        String documentId,
        String documentTitle,
        String currentDocument,
        String selectedLayerId,
        String componentSchema
) {}
