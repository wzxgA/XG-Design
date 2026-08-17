package com.xgdesign.ai.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xgdesign.ai.prompt.AiComponentCatalog;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 设计生成工具（Function Calling）。
 * <p>
 * AI 调用 {@code generateDesign} 方法生成设计稿。工具接收 JSON 字符串参数，
 * 避免 Spring AI 对复杂嵌套 record 做 JSON 反序列化时因 token 截断而失败。
 * <p>
 * 每次对话请求创建新实例，避免并发会话共享状态。
 */
public class DesignToolCallback {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AtomicReference<String> designRef;
    private final AtomicReference<String> descriptionRef;
    private final AtomicReference<String> linksRef;
    private final AiComponentCatalog componentCatalog;
    /** 本次请求内连续校验失败次数，≥2 次时输出更激进的精简指令 */
    private final AtomicInteger failCount = new AtomicInteger();

    public DesignToolCallback(AtomicReference<String> designRef, AtomicReference<String> descriptionRef,
                              AtomicReference<String> linksRef, AiComponentCatalog componentCatalog) {
        this.designRef = designRef;
        this.descriptionRef = descriptionRef;
        this.linksRef = linksRef;
        this.componentCatalog = componentCatalog;
    }

    @Tool(description = "生成或修改设计稿。当用户要求创建页面、组件或修改设计时调用此工具。layersJson 是图层数组的 JSON 字符串，每个图层包含 id/type/name/x/y/width/height/style/children 等属性。若用户要求按钮/元素点击跳转到另一界面，用 linksJson 声明跳转关系。")
    public DesignResult generateDesign(
            @ToolParam(description = "图层数组的 JSON 字符串，例如 [{\"id\":\"layer-1\",\"type\":\"frame\",\"name\":\"容器\",\"x\":0,\"y\":0,\"width\":400,\"height\":600,\"style\":{\"fill\":\"#fff\"},\"children\":[]}]") String layersJson,
            @ToolParam(description = "设计描述/标题，简要说明这个设计的内容") String description,
            @ToolParam(description = "原型跳转关系的 JSON 数组字符串（可选，默认空），每条: {\"sourceLayerId\":\"可点击节点id\",\"targetFrameId\":\"目标顶层frame的id\",\"transition\":\"instant|dissolve|slide\"}。只有多界面（多个顶层 frame）时可用") String linksJson
    ) {
        // 校验 JSON 合法性；截断、格式错误或组件名非法时抛明确异常，由 AiService 转为 SSE error 事件并让模型自愈
        validateLayersJson(layersJson);
        String normalizedLinks = validateLinksJson(linksJson, layersJson);
        designRef.set(layersJson);
        descriptionRef.set(description);
        linksRef.set(normalizedLinks);
        return new DesignResult(layersJson, description, normalizedLinks);
    }

    /** 校验 linksJson：解析为数组、source/target 存在性校验；非法条目静默丢弃（避免重试循环），返回规范化 JSON 字符串 */
    private String validateLinksJson(String linksJson, String layersJson) {
        if (linksJson == null || linksJson.isBlank()) return "[]";
        JsonNode parsed;
        try {
            parsed = MAPPER.readTree(linksJson);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("linksJson 格式错误，请改为合法 JSON 数组后重试: " + e.getOriginalMessage(), e);
        }
        if (!parsed.isArray()) {
            throw new IllegalArgumentException("linksJson 必须是 JSON 数组，请修正后重试。");
        }
        // 收集全部节点 id 与顶层 frame id
        JsonNode layers;
        try {
            layers = MAPPER.readTree(layersJson);
        } catch (JsonProcessingException e) {
            layers = MAPPER.createArrayNode();
        }
        java.util.Set<String> allIds = new HashSet<>();
        Set<String> topFrameIds = new HashSet<>();
        collectIds(layers, 0, allIds, topFrameIds);

        com.fasterxml.jackson.databind.node.ArrayNode out = MAPPER.createArrayNode();
        for (JsonNode link : parsed) {
            if (!link.isObject()) continue;
            String source = link.path("sourceLayerId").asText("");
            String target = link.path("targetFrameId").asText("");
            if (source.isBlank() || target.isBlank()) continue;
            if (!allIds.contains(source)) continue;            // 源节点不存在 → 丢弃
            if (!topFrameIds.contains(target)) continue;       // 目标不是顶层 frame → 丢弃
            ObjectNode o = MAPPER.createObjectNode();
            o.put("sourceLayerId", source);
            o.put("targetFrameId", target);
            String trans = link.path("transition").asText("instant");
            if (!"dissolve".equals(trans) && !"slide".equals(trans)) trans = "instant";
            o.put("transition", trans);
            out.add(o);
        }
        try {
            return MAPPER.writeValueAsString(out);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    /** 收集全部节点 id（allIds）与顶层 frame id（topFrameIds） */
    private void collectIds(JsonNode node, int depth, Set<String> allIds, Set<String> topFrameIds) {
        if (node.isArray()) {
            for (JsonNode child : node) {
                collectIds(child, depth, allIds, topFrameIds);
            }
        } else if (node.isObject()) {
            String id = node.path("id").asText("");
            if (!id.isBlank()) {
                allIds.add(id);
                if (depth == 0 && "frame".equals(node.path("type").asText(""))) {
                    topFrameIds.add(id);
                }
            }
            JsonNode children = node.get("children");
            if (children != null) {
                collectIds(children, depth + 1, allIds, topFrameIds);
            }
        }
    }

    private void validateLayersJson(String layersJson) {
        if (layersJson == null || layersJson.isBlank()) {
            throw new IllegalArgumentException("生成的设计 JSON 为空");
        }
        try {
            JsonNode node = MAPPER.readTree(layersJson);
            if (!node.isArray()) {
                throw new IllegalArgumentException("生成的设计 JSON 不是数组");
            }
            // 顶层必须恰好一个 frame 或 group 作为唯一父节点，避免散开图层或 frame 嵌套
            validateTopLevel(node);
            validateComponents(node);
        } catch (JsonProcessingException e) {
            // JSON 截断/格式错误是超 max-tokens 的最常见表现：报错附带精简要求，并按失败次数逐级收紧
            int fail = failCount.incrementAndGet();
            throw new IllegalArgumentException(buildTruncatedRetryMessage("生成的设计 JSON 不完整或格式错误，请重新生成: " + e.getOriginalMessage(), fail), e);
        }
    }

    /** 截断重试消息：第 1 次给普通精简要求，连续失败 ≥2 次给激进精简要求 */
    private String buildTruncatedRetryMessage(String base, int fail) {
        if (fail >= 2) {
            return base + "。若输出长度受限导致截断，请严格按要求重试: 仅输出 5 个图层以内、必须使用组件库组件、省略所有可选字段、组件 children 留空 []、使用单行紧凑 JSON";
        }
        return base + "。注意控制输出长度: 图层控制在 8 个以内、省略可选字段（rotation=0/visible=true/opacity=1/fontWeight=400 不写）、组件 children 留空 []、使用单行紧凑 JSON";
    }

    /** 校验顶层结构：1 个 frame/group（单页/组件），或 2+ 个 frame（多界面/多页面，每 frame 一个页面） */
    private void validateTopLevel(JsonNode node) {
        if (node.isEmpty()) {
            throw new IllegalArgumentException("layers 顶层不能为空，请至少输出 1 个 frame 或 group 节点。");
        }
        if (node.size() == 1) {
            String type = node.get(0).path("type").asText("");
            if (!"frame".equals(type) && !"group".equals(type)) {
                throw new IllegalArgumentException("layers 顶层节点 type 必须为 frame 或 group，当前为 " + type + "。请用 frame（生成页面）或 group（生成组件/局部）包裹后重新生成。");
            }
            return;
        }
        // 2+ 顶层节点：多界面/多页面场景，必须全部是 frame（每个 frame 一个独立页面）
        for (JsonNode n : node) {
            String type = n.path("type").asText("");
            if (!"frame".equals(type)) {
                throw new IllegalArgumentException("顶层输出多个节点时，每个节点 type 必须为 frame（每个 frame 代表一个独立页面/界面，frame 的 name 用作页面名），当前包含 " + type + "。请全部改为 frame 后重新生成。");
            }
        }
    }

    /** 递归校验组件节点：component 仅允许用于 group 类型，且名称必须在组件库白名单内 */
    private void validateComponents(JsonNode node) {
        if (node.isArray()) {
            for (JsonNode child : node) {
                validateComponents(child);
            }
        } else if (node.isObject()) {
            JsonNode component = node.get("component");
            if (component != null && component.isTextual() && !component.asText().isBlank()) {
                String type = node.path("type").asText("");
                String name = component.asText();
                if (!"group".equals(type)) {
                    throw new IllegalArgumentException("组件节点 type 必须为 group，当前为 " + type + " (组件: " + name + ")。请修正后重新生成。");
                }
                if (!componentCatalog.isValidComponentName(name)) {
                    throw new IllegalArgumentException("组件名 \"" + name + "\" 不在组件库中，相近可用组件: " + componentCatalog.suggestSimilarText(name) + "。请改用上述名称重新生成。");
                }
            }
            JsonNode children = node.get("children");
            if (children != null) {
                validateComponents(children);
            }
        }
    }

    public record DesignResult(String documentJson, String description, String linksJson) {}
}
