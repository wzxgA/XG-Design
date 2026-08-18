package com.xgdesign.ai;

import com.xgdesign.ai.dto.AiSettingsDtos.AiSettingsRequest;
import com.xgdesign.ai.dto.AiSettingsDtos.AiSettingsDto;
import com.xgdesign.ai.dto.AiSettingsDtos.AiTestResult;
import com.xgdesign.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 用户 AI 配置接口。
 */
@RestController
@RequestMapping("/api/ai/settings")
public class AiSettingsController {

    private final AiSettingsService settingsService;

    public AiSettingsController(AiSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ApiResponse<AiSettingsDto> get() {
        return ApiResponse.ok(settingsService.getSettings());
    }

    @PutMapping
    public ApiResponse<AiSettingsDto> save(@RequestBody AiSettingsRequest req) {
        return ApiResponse.ok(settingsService.save(req));
    }

    @PostMapping("/test")
    public ApiResponse<AiTestResult> test(@RequestBody AiSettingsRequest req) {
        return ApiResponse.ok(settingsService.test(req));
    }
}
