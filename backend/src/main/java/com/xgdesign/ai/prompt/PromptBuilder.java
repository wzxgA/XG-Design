package com.xgdesign.ai.prompt;

import com.xgdesign.ai.AiProperties;
import com.xgdesign.ai.dto.ChatRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

/**
 * 动态构建系统提示词。
 */
@Component
public class PromptBuilder {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    /** 文档上下文压缩后允许的最大图层节点数，超限截断避免输入 token 膨胀 */
    private static final int MAX_CONTEXT_NODES = 60;
    /** style 中仅保留的关键字段 */
    private static final String[] STYLE_KEYS = {
            "fill", "color", "fontColor", "fontSize", "fontWeight", "cornerRadius",
            "opacity", "textAlign", "backgroundColor", "fillGradient", "effects"
    };

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
        sb.append(SystemPrompts.EDIT_RULES);
        sb.append("\n");
        sb.append(SystemPrompts.PROTO_LINK_RULES);
        sb.append("\n");
        sb.append(getDocumentContext(request));

        String extra = properties.getSystemPromptExtra();
        if (extra != null && !extra.isBlank()) {
            sb.append("\n## 补充说明\n").append(extra);
        }

        return sb.toString();
    }

    /**
     * 当前文档上下文 — 用户正在编辑的文档快照（压缩后）。
     */
    private String getDocumentContext(ChatRequest request) {
        if (request.currentDocument() == null || request.currentDocument().isBlank()) {
            return "## 当前文档\n用户当前没有打开文档。\n";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("## 当前文档\n");
        sb.append("用户正在编辑文档: ").append(request.documentTitle() != null ? request.documentTitle() : "未命名").append("\n");
        sb.append("文档内容 (JSON，已压缩关键字段):\n```json\n");
        sb.append(compactDocument(request.currentDocument()));
        sb.append("\n```\n");
        sb.append("选中图层: ").append(request.selectedLayerId() != null ? request.selectedLayerId() : "无").append("\n");
        return sb.toString();
    }

    /** 压缩文档快照：仅保留关键字段并限制总节点数，减小输入 token */
    private String compactDocument(String docJson) {
        if (docJson == null || docJson.isBlank()) return docJson;
        try {
            JsonNode root = MAPPER.readTree(docJson);
            if (!root.isObject()) return docJson;
            int[] counter = {0};
            boolean[] truncated = {false};
            ObjectNode out = MAPPER.createObjectNode();
            copyIf(out, root, "id");
            copyIf(out, root, "name");
            copyIf(out, root, "activePageId");
            JsonNode pages = root.path("pages");
            if (pages.isArray() && !pages.isEmpty()) {
                ArrayNode pa = MAPPER.createArrayNode();
                for (JsonNode p : pages) {
                    ObjectNode po = MAPPER.createObjectNode();
                    copyIf(po, p, "id");
                    copyIf(po, p, "name");
                    JsonNode layers = p.path("layers");
                    if (layers.isArray() && !layers.isEmpty()) {
                        ArrayNode la = MAPPER.createArrayNode();
                        for (JsonNode n : layers) {
                            if (truncated[0]) break;
                            la.add(compactNode(n, counter, truncated));
                        }
                        if (la.size() > 0) po.set("layers", la);
                    }
                    pa.add(po);
                    if (truncated[0]) break;
                }
                out.set("pages", pa);
            }
            if (truncated[0]) {
                out.put("_note", "文档过大，上下文已压缩（超过 " + MAX_CONTEXT_NODES + " 个图层被截断）");
            }
            return MAPPER.writeValueAsString(out);
        } catch (Exception e) {
            // 解析失败时原样返回，不阻断对话
            return docJson;
        }
    }

    /** 单节点压缩：保留编辑所需关键字段，丢弃无关样式细节 */
    private JsonNode compactNode(JsonNode n, int[] counter, boolean[] truncated) {
        counter[0]++;
        if (counter[0] > MAX_CONTEXT_NODES) {
            truncated[0] = true;
            return MAPPER.nullNode();
        }
        ObjectNode o = MAPPER.createObjectNode();
        for (String f : new String[]{"id", "type", "name", "x", "y", "width", "height",
                "rotation", "visible", "locked", "component", "componentProps", "imageUrl"}) {
            copyIf(o, n, f);
        }
        if ("text".equals(n.path("type").asText(""))) copyIf(o, n, "content");
        JsonNode style = n.path("style");
        if (style.isObject()) {
            ObjectNode so = MAPPER.createObjectNode();
            for (String k : STYLE_KEYS) {
                if (style.has(k)) so.set(k, style.get(k).deepCopy());
            }
            if (so.size() > 0) o.set("style", so);
        }
        JsonNode children = n.path("children");
        if (children.isArray() && !children.isEmpty()) {
            ArrayNode ca = MAPPER.createArrayNode();
            for (JsonNode c : children) {
                if (truncated[0]) break;
                ca.add(compactNode(c, counter, truncated));
            }
            if (ca.size() > 0) o.set("children", ca);
        }
        return o;
    }

    private void copyIf(ObjectNode target, JsonNode src, String field) {
        JsonNode v = src.get(field);
        if (v != null) target.set(field, v.deepCopy());
    }
}
