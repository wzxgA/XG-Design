package com.xgdesign.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 功能配置项，对应 application.yml 中 xgdesign.ai.* 前缀。
 */
@ConfigurationProperties(prefix = "xgdesign.ai")
public class AiProperties {

    private boolean enabled = true;
    private boolean mockMode = false;
    private int maxHistoryMessages = 20;
    private String systemPromptExtra = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isMockMode() {
        return mockMode;
    }

    public void setMockMode(boolean mockMode) {
        this.mockMode = mockMode;
    }

    public int getMaxHistoryMessages() {
        return maxHistoryMessages;
    }

    public void setMaxHistoryMessages(int maxHistoryMessages) {
        this.maxHistoryMessages = maxHistoryMessages;
    }

    public String getSystemPromptExtra() {
        return systemPromptExtra;
    }

    public void setSystemPromptExtra(String systemPromptExtra) {
        this.systemPromptExtra = systemPromptExtra;
    }
}
