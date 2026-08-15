package com.xgdesign.ai;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AI 模块配置：注册 ChatClient Bean 和 AiProperties。
 */
@Configuration
@EnableConfigurationProperties(AiProperties.class)
public class AiConfig {

    /**
     * ChatClient — Spring AI 的核心客户端，由 OpenAiChatModel 自动配置构建。
     * 即使未配置有效 API Key，Bean 仍可创建；实际请求在 mock-mode 下不会发起。
     */
    @Bean
    public ChatClient chatClient(org.springframework.ai.chat.model.ChatModel chatModel) {
        return ChatClient.builder(chatModel).build();
    }
}
