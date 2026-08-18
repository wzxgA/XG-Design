package com.xgdesign.ai.dto;

/**
 * 用户 AI 配置相关 DTO。
 */
public final class AiSettingsDtos {

    private AiSettingsDtos() {}

    /** 保存请求：apiKey 留空表示保留原值；clearKey=true 清除已有 Key */
    public record AiSettingsRequest(String baseUrl, String apiKey, String model, Boolean clearKey) {}

    /** 配置回读：不回传 api_key，仅 hasKey 标记（避免 Key 泄漏到前端） */
    public record AiSettingsDto(String baseUrl, String model, boolean hasKey, boolean usingDefault) {}

    /** 测试连接结果 */
    public record AiTestResult(boolean ok, String message) {}
}
