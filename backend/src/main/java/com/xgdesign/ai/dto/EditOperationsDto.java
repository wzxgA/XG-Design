package com.xgdesign.ai.dto;

/**
 * AI 修改操作建议（editDesign 工具产生）。
 */
public record EditOperationsDto(
        String operationsJson,
        String description
) {}
