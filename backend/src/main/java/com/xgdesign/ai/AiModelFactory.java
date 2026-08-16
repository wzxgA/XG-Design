package com.xgdesign.ai;

import com.xgdesign.security.CurrentUserProvider;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Optional;
import java.util.UUID;

/**
 * 动态构建 AI 对话客户端。
 * <p>
 * 每请求按当前用户配置（ai_user_settings）构建 ChatClient；用户未配置时回退全局
 * application.yml 的 spring.ai.openai.* 配置。API Key 无效/占位时返回 null，调用方走 Mock。
 */
@Component
public class AiModelFactory {

    private final AiUserSettingsRepository settingsRepo;
    private final String globalApiKey;
    private final String globalBaseUrl;
    private final String globalModel;

    public AiModelFactory(AiUserSettingsRepository settingsRepo,
                          @Value("${spring.ai.openai.api-key:}") String globalApiKey,
                          @Value("${spring.ai.openai.base-url:https://api.deepseek.com}") String globalBaseUrl,
                          @Value("${spring.ai.openai.chat.options.model:deepseek-v4-flash}") String globalModel) {
        this.settingsRepo = settingsRepo;
        this.globalApiKey = globalApiKey;
        this.globalBaseUrl = globalBaseUrl;
        this.globalModel = globalModel;
    }

    /** 按当前登录用户的配置构建 ChatClient；无有效 Key（含回退全局）时返回 null → 走 Mock */
    public ChatClient buildForCurrentUser() {
        UUID userId = CurrentUserProvider.requireUserId();
        Optional<AiUserSettingsEntity> s = settingsRepo.findByUserId(userId);
        String apiKey = s.map(AiUserSettingsEntity::getApiKey).orElse(globalApiKey);
        if (!isValidKey(apiKey)) return null;
        String baseUrl = s.map(AiUserSettingsEntity::getBaseUrl)
                .filter(v -> v != null && !v.isBlank())
                .orElse(globalBaseUrl);
        String model = s.map(AiUserSettingsEntity::getModel)
                .filter(v -> v != null && !v.isBlank())
                .orElse(globalModel);
        return build(baseUrl, apiKey, model);
    }

    /** 用指定配置构建（测试连接用），Key 无效返回 null */
    public ChatClient buildForConfig(String baseUrl, String apiKey, String model) {
        if (!isValidKey(apiKey)) return null;
        return build(
                baseUrl != null && !baseUrl.isBlank() ? baseUrl : globalBaseUrl,
                apiKey,
                model != null && !model.isBlank() ? model : globalModel
        );
    }

    private ChatClient build(String baseUrl, String apiKey, String model) {
        String effectiveBase = baseUrl.trim();
        String completionsPath = null;
        try {
            URI uri = URI.create(effectiveBase);
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (!path.isEmpty() && !"/".equals(path)) {
                // 地址自带路径（如 https://host/api/coding/v3）时：baseUrl 只保留域部分，
                // 路径 + /chat/completions 放入 completionsPath，避免默认 /v1 前缀拼接导致 404
                effectiveBase = uri.getScheme() + "://" + uri.getAuthority();
                completionsPath = path.replaceAll("/+$", "") + "/chat/completions";
            }
        } catch (Exception ignored) {
            // URL 非法时保持原样，让请求自然报错
        }
        OpenAiApi.Builder apiBuilder = OpenAiApi.builder()
                .baseUrl(effectiveBase)
                .apiKey(apiKey);
        if (completionsPath != null) {
            apiBuilder.completionsPath(completionsPath);
        }
        OpenAiApi api = apiBuilder.build();
        OpenAiChatModel chatModel = OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder().model(model).build())
                .build();
        return ChatClient.builder(chatModel).build();
    }

    private boolean isValidKey(String apiKey) {
        return apiKey != null && !apiKey.isBlank() && !apiKey.startsWith("placeholder");
    }
}
