package com.xgdesign.ai.dto;

/**
 * AI 对话消息响应。
 */
public record ChatMessageDto(
        String id,
        String sessionId,
        String role,
        String content,
        DesignSuggestionDto designSuggestion,
        String createdAt
) {}
