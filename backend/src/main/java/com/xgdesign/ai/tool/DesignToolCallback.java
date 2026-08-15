package com.xgdesign.ai.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

    public DesignToolCallback(AtomicReference<String> designRef, AtomicReference<String> descriptionRef) {
        this.designRef = designRef;
        this.descriptionRef = descriptionRef;
    }

    @Tool(description = "生成或修改设计稿。当用户要求创建页面、组件或修改设计时调用此工具。layersJson 是图层数组的 JSON 字符串，每个图层包含 id/type/name/x/y/width/height/style/children 等属性。")
    public DesignResult generateDesign(
            @ToolParam(description = "图层数组的 JSON 字符串，例如 [{\"id\":\"layer-1\",\"type\":\"frame\",\"name\":\"容器\",\"x\":0,\"y\":0,\"width\":400,\"height\":600,\"style\":{\"fill\":\"#fff\"},\"children\":[]}]") String layersJson,
            @ToolParam(description = "设计描述/标题，简要说明这个设计的内容") String description
    ) {
        // 校验 JSON 合法性；截断或格式错误时抛明确异常，由 AiService 转为 SSE error 事件
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
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("生成的设计 JSON 不完整或格式错误，请重新生成: " + e.getOriginalMessage(), e);
        }
    }

    public record DesignResult(String documentJson, String description) {}
}
