package com.xgdesign.ai.dto;

/**
 * AI 对话会话响应。
 */
public record ChatSessionDto(
        String id,
        String title,
        String documentId,
        int messageCount,
        String lastMessageAt,
        String createdAt
) {}
