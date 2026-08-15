package com.xgdesign.ai.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xgdesign.ai.prompt.AiComponentCatalog;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

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
    private final AiComponentCatalog componentCatalog;

    public DesignToolCallback(AtomicReference<String> designRef, AtomicReference<String> descriptionRef,
                              AiComponentCatalog componentCatalog) {
        this.designRef = designRef;
        this.descriptionRef = descriptionRef;
        this.componentCatalog = componentCatalog;
    }

    @Tool(description = "生成或修改设计稿。当用户要求创建页面、组件或修改设计时调用此工具。layersJson 是图层数组的 JSON 字符串，每个图层包含 id/type/name/x/y/width/height/style/children 等属性。")
    public DesignResult generateDesign(
            @ToolParam(description = "图层数组的 JSON 字符串，例如 [{\"id\":\"layer-1\",\"type\":\"frame\",\"name\":\"容器\",\"x\":0,\"y\":0,\"width\":400,\"height\":600,\"style\":{\"fill\":\"#fff\"},\"children\":[]}]") String layersJson,
            @ToolParam(description = "设计描述/标题，简要说明这个设计的内容") String description
    ) {
        // 校验 JSON 合法性；截断、格式错误或组件名非法时抛明确异常，由 AiService 转为 SSE error 事件并让模型自愈
        validateLayersJson(layersJson);
        designRef.set(layersJson);
        descriptionRef.set(description);
        return new DesignResult(layersJson, description);
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
            throw new IllegalArgumentException("生成的设计 JSON 不完整或格式错误，请重新生成: " + e.getOriginalMessage(), e);
        }
    }

    /** 校验顶层结构：数组长度必须为 1，且元素 type 为 frame 或 group（页面用 frame，组件/局部用 group） */
    private void validateTopLevel(JsonNode node) {
        if (node.size() != 1) {
            throw new IllegalArgumentException("layers 数组顶层必须恰好 1 个 frame 或 group 节点，当前有 " + node.size() + " 个。请用单个 frame（生成页面）或 group（生成组件/局部）包裹所有图层后重新生成。");
        }
        String type = node.get(0).path("type").asText("");
        if (!"frame".equals(type) && !"group".equals(type)) {
            throw new IllegalArgumentException("layers 顶层节点 type 必须为 frame 或 group，当前为 " + type + "。请用 frame（生成页面）或 group（生成组件/局部）包裹后重新生成。");
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
                    throw new IllegalArgumentException("组件名 \"" + name + "\" 不在组件库中，可用组件: " + componentCatalog.componentNames() + "。请改用上述名称重新生成。");
                }
            }
            JsonNode children = node.get("children");
            if (children != null) {
                validateComponents(children);
            }
        }
    }

    public record DesignResult(String documentJson, String description) {}
}
