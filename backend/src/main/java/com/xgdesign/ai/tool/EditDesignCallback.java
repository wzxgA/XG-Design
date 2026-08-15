package com.xgdesign.ai.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xgdesign.ai.prompt.AiComponentCatalog;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.concurrent.atomic.AtomicReference;

/**
 * 设计修改工具（Function Calling）。
 * <p>
 * AI 调用 {@code editDesign} 方法修改当前画布上已有图层。工具接收操作指令数组的 JSON 字符串，
 * 每条指令为 update/delete/replace 之一。与 {@link DesignToolCallback}（全量生成）并列，
 * LLM 按用户意图选择。
 * <p>
 * 每次对话请求创建新实例，避免并发会话共享状态。
 */
public class EditDesignCallback {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AtomicReference<String> operationsRef;
    private final AtomicReference<String> descriptionRef;
    private final AiComponentCatalog componentCatalog;

    public EditDesignCallback(AtomicReference<String> operationsRef, AtomicReference<String> descriptionRef,
                              AiComponentCatalog componentCatalog) {
        this.operationsRef = operationsRef;
        this.descriptionRef = descriptionRef;
        this.componentCatalog = componentCatalog;
    }

    @Tool(description = "修改/删除/替换当前画布上已有图层。当用户要求修改、调整、删除或替换画布上的图层时调用此工具，不要用 generateDesign。operationsJson 是操作指令数组的 JSON 字符串。")
    public EditResult editDesign(
            @ToolParam(description = "操作指令数组的 JSON 字符串，例如 [{\"op\":\"update\",\"id\":\"layer-1\",\"patch\":{\"style\":{\"fill\":\"#ff0000\"}}},{\"op\":\"delete\",\"id\":\"layer-2\"},{\"op\":\"replace\",\"id\":\"old-btn\",\"node\":{\"type\":\"group\",\"name\":\"按钮\",\"component\":\"按钮\",\"componentProps\":{\"text\":\"提交\"},\"x\":0,\"y\":0,\"width\":140,\"height\":40,\"children\":[]}}]") String operationsJson,
            @ToolParam(description = "修改说明，简要描述做了哪些修改") String description
    ) {
        validateOperationsJson(operationsJson);
        operationsRef.set(operationsJson);
        descriptionRef.set(description);
        return new EditResult(operationsJson, description);
    }

    private void validateOperationsJson(String operationsJson) {
        if (operationsJson == null || operationsJson.isBlank()) {
            throw new IllegalArgumentException("修改操作 JSON 为空");
        }
        try {
            JsonNode node = MAPPER.readTree(operationsJson);
            if (!node.isArray()) {
                throw new IllegalArgumentException("修改操作 JSON 不是数组");
            }
            if (node.isEmpty()) {
                throw new IllegalArgumentException("修改操作数组为空，至少需要一条操作");
            }
            for (JsonNode op : node) {
                validateOperation(op);
            }
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("修改操作 JSON 不完整或格式错误，请重新生成: " + e.getOriginalMessage(), e);
        }
    }

    private void validateOperation(JsonNode op) {
        if (!op.isObject()) {
            throw new IllegalArgumentException("每条操作必须是对象");
        }
        String type = op.path("op").asText("");
        String id = op.path("id").asText("");
        if (id.isBlank()) {
            throw new IllegalArgumentException("操作缺少 id 字段（目标图层 id）");
        }
        switch (type) {
            case "update" -> {
                if (!op.has("patch") || !op.get("patch").isObject()) {
                    throw new IllegalArgumentException("update 操作缺少 patch 对象 (id: " + id + ")");
                }
            }
            case "delete" -> { /* 仅需 id */ }
            case "replace" -> {
                JsonNode node = op.get("node");
                if (node == null || !node.isObject()) {
                    throw new IllegalArgumentException("replace 操作缺少 node 对象 (id: " + id + ")");
                }
                String nodeType = node.path("type").asText("");
                if (nodeType.isBlank()) {
                    throw new IllegalArgumentException("replace 的 node 缺少 type 字段 (id: " + id + ")");
                }
                // 组件白名单校验（复用）
                validateComponentInNode(node);
            }
            default -> throw new IllegalArgumentException("未知操作类型: " + type + "（仅支持 update/delete/replace）");
        }
    }

    /** 若 node 带 component 字段，校验白名单（与 DesignToolCallback 一致） */
    private void validateComponentInNode(JsonNode node) {
        JsonNode component = node.get("component");
        if (component != null && component.isTextual() && !component.asText().isBlank()) {
            String type = node.path("type").asText("");
            String name = component.asText();
            if (!"group".equals(type)) {
                throw new IllegalArgumentException("组件节点 type 必须为 group，当前为 " + type + " (组件: " + name + ")");
            }
            if (!componentCatalog.isValidComponentName(name)) {
                throw new IllegalArgumentException("组件名 \"" + name + "\" 不在组件库中，可用组件: " + componentCatalog.componentNames());
            }
        }
        JsonNode children = node.get("children");
        if (children != null && children.isArray()) {
            for (JsonNode child : children) {
                if (child.isObject()) validateComponentInNode(child);
            }
        }
    }

    public record EditResult(String operationsJson, String description) {}
}
