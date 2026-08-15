package com.xgdesign.ai.dto;

/**
 * AI 生成的设计建议。
 */
public record DesignSuggestionDto(
        String documentJson,
        String description
) {}
