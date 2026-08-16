package com.xgdesign.ai;

import com.xgdesign.ai.dto.AiSettingsDtos.AiSettingsRequest;
import com.xgdesign.ai.dto.AiSettingsDtos.AiSettingsDto;
import com.xgdesign.ai.dto.AiSettingsDtos.AiTestResult;
import com.xgdesign.security.CurrentUserProvider;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * 用户 AI 配置服务：读取 / 保存 / 测试连接。
 */
@Service
public class AiSettingsService {

    private final AiUserSettingsRepository settingsRepo;
    private final AiModelFactory modelFactory;

    public AiSettingsService(AiUserSettingsRepository settingsRepo, AiModelFactory modelFactory) {
        this.settingsRepo = settingsRepo;
        this.modelFactory = modelFactory;
    }

    /** 当前用户配置（key 不回传） */
    public AiSettingsDto getSettings() {
        UUID userId = CurrentUserProvider.requireUserId();
        Optional<AiUserSettingsEntity> s = settingsRepo.findByUserId(userId);
        if (s.isEmpty()) {
            return new AiSettingsDto(null, null, false, true);
        }
        AiUserSettingsEntity e = s.get();
        return new AiSettingsDto(e.getBaseUrl(), e.getModel(),
                e.getApiKey() != null && !e.getApiKey().isBlank(), false);
    }

    /** 保存：apiKey 留空=保留原值；clearKey=true 清空 */
    public AiSettingsDto save(AiSettingsRequest req) {
        UUID userId = CurrentUserProvider.requireUserId();
        AiUserSettingsEntity e = settingsRepo.findByUserId(userId).orElseGet(() -> {
            AiUserSettingsEntity n = new AiUserSettingsEntity();
            n.setUserId(userId);
            return n;
        });
        if (req.baseUrl() != null) e.setBaseUrl(req.baseUrl().trim());
        if (req.model() != null) e.setModel(req.model().trim());
        if (Boolean.TRUE.equals(req.clearKey())) {
            e.setApiKey(null);
        } else if (req.apiKey() != null && !req.apiKey().isBlank()) {
            e.setApiKey(req.apiKey().trim());
        }
        settingsRepo.save(e);
        return getSettings();
    }

    /** 测试连接：用提交的配置发一次轻量对话 */
    public AiTestResult test(AiSettingsRequest req) {
        ChatClient client = modelFactory.buildForConfig(req.baseUrl(), req.apiKey(), req.model());
        if (client == null) {
            return new AiTestResult(false, "API Key 无效（为空或占位符）");
        }
        try {
            String reply = client.prompt().user("回复 OK 即可").call().content();
            return new AiTestResult(true, "连接成功" + (reply != null && !reply.isBlank() ? "：" + reply.trim() : ""));
        } catch (Exception e) {
            return new AiTestResult(false, "连接失败：" + e.getMessage());
        }
    }
}
