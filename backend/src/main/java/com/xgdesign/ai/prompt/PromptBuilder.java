package com.xgdesign.ai.prompt;

import com.xgdesign.ai.AiProperties;
import com.xgdesign.ai.dto.ChatRequest;
import org.springframework.stereotype.Component;

/**
 * 动态构建系统提示词。
 */
@Component
public class PromptBuilder {

    private final AiProperties properties;
    private final AiComponentCatalog componentCatalog;

    public PromptBuilder(AiProperties properties, AiComponentCatalog componentCatalog) {
        this.properties = properties;
        this.componentCatalog = componentCatalog;
    }

    /**
     * 构建系统提示词。
     * 结构: 角色定义 → 能力说明 → 设计系统 → 图层 Schema → 组件库 → 画布信息 → 行为规范 → 组件使用规则 → 当前文档上下文
     */
    public String buildSystemPrompt(ChatRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append(SystemPrompts.ROLE_DEFINITION);
        sb.append("\n");
        sb.append(SystemPrompts.CAPABILITIES);
        sb.append("\n");
        sb.append(SystemPrompts.DESIGN_SYSTEM);
        sb.append("\n");
        sb.append(DesignSchemaProvider.getLayerSchemaDescription());
        sb.append("\n");
        sb.append(componentCatalog.buildPromptSection());
        sb.append("\n");
        sb.append(SystemPrompts.CANVAS_INFO);
        sb.append("\n");
        sb.append(SystemPrompts.BEHAVIOR_RULES);
        sb.append("\n");
        sb.append(SystemPrompts.COMPONENT_RULES);
        sb.append("\n");
        sb.append(getDocumentContext(request));

        String extra = properties.getSystemPromptExtra();
        if (extra != null && !extra.isBlank()) {
            sb.append("\n## 补充说明\n").append(extra);
        }

        return sb.toString();
    }

    /**
     * 当前文档上下文 — 用户正在编辑的文档快照。
     */
    private String getDocumentContext(ChatRequest request) {
        if (request.currentDocument() == null || request.currentDocument().isBlank()) {
            return "## 当前文档\n用户当前没有打开文档。\n";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("## 当前文档\n");
        sb.append("用户正在编辑文档: ").append(request.documentTitle() != null ? request.documentTitle() : "未命名").append("\n");
        sb.append("文档内容 (JSON):\n```json\n");
        sb.append(request.currentDocument());
        sb.append("\n```\n");
        sb.append("选中图层: ").append(request.selectedLayerId() != null ? request.selectedLayerId() : "无").append("\n");
        return sb.toString();
    }
}
