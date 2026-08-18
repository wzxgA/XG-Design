package com.xgdesign.ai.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xgdesign.ai.prompt.AiComponentCatalog;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.List;
import java.util.Map;

/**
 * 设计修改工具（Function Calling）。
 * <p>
 * AI 调用 {@code editDesign} 方法修改当前画布上已有图层。工具接收操作指令数组的 JSON 字符串，
 * 每条指令为 update/delete/replace/insert 之一。与 {@link DesignToolCallback}（全量生成）并列，
 * LLM 按用户意图选择。
 * <p>
 * 每次对话请求创建新实例，避免并发会话共享状态。
 */
public class EditDesignCallback {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 按任务累计的工具结果（taskId → 结果）；插入顺序即工具调用顺序 */
    private final Map<String, TaskToolResult> results;
    private final AiComponentCatalog componentCatalog;
    /** 前端随请求发送的组件 schema（含完整 props 契约）；为空时仅做组件名白名单校验 */
    private final List<AiComponentCatalog.ComponentSpec> requestComponents;

    public EditDesignCallback(Map<String, TaskToolResult> results,
                              AiComponentCatalog componentCatalog,
                              List<AiComponentCatalog.ComponentSpec> requestComponents) {
        this.results = results;
        this.componentCatalog = componentCatalog;
        this.requestComponents = requestComponents;
    }

    @Tool(description = "在已有画布上原位修改：调整、删除、替换或新增元素/模块（如给已有界面加搜索框、导航栏、评论区、帖子卡片）。当用户要求修改已有界面或给已有界面增加内容时调用此工具；只有创建全新独立页面/组件时才用 generateDesign。operationsJson 是操作指令数组的 JSON 字符串。任务清单场景（先调用过 planTasks）必须携带 taskId，且每个 taskId 只调用一次、只产出一个结果。")
    public EditResult editDesign(
            @ToolParam(description = "操作指令数组的 JSON 字符串，例如 [{\"op\":\"update\",\"id\":\"layer-1\",\"patch\":{\"style\":{\"fill\":\"#ff0000\"}}},{\"op\":\"delete\",\"id\":\"layer-2\"},{\"op\":\"replace\",\"id\":\"old-btn\",\"node\":{\"type\":\"group\",\"name\":\"按钮\",\"component\":\"按钮\",\"componentProps\":{\"text\":\"提交\"},\"x\":0,\"y\":0,\"width\":140,\"height\":40,\"children\":[]}},{\"op\":\"insert\",\"parentId\":\"frame-1\",\"node\":{\"type\":\"text\",\"name\":\"Logo\",\"content\":\"B\",\"x\":24,\"y\":20,\"width\":40,\"height\":40,\"children\":[]}}]") String operationsJson,
            @ToolParam(description = "修改说明，简要描述做了哪些修改") String description,
            @ToolParam(required = false, description = "任务 ID（任务清单场景必填，对应 planTasks 输出的 taskId；简单需求不填）") String taskId
    ) {
        validateOperationsJson(operationsJson);
        String key = (taskId != null && !taskId.isBlank()) ? taskId : TaskToolResult.DEFAULT_TASK;
        results.put(key, new TaskToolResult(key, "edit", operationsJson, description, null));
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
            case "insert" -> {
                String parentId = op.path("parentId").asText("");
                if (parentId.isBlank()) {
                    throw new IllegalArgumentException("insert 操作缺少 parentId（目标容器图层 id 或页面 id）");
                }
                JsonNode node = op.get("node");
                if (node == null || !node.isObject()) {
                    throw new IllegalArgumentException("insert 操作缺少 node 对象 (parentId: " + parentId + ")");
                }
                String nodeType = node.path("type").asText("");
                if (nodeType.isBlank()) {
                    throw new IllegalArgumentException("insert 的 node 缺少 type 字段 (parentId: " + parentId + ")");
                }
                // 组件白名单校验（复用）
                validateComponentInNode(node);
            }
            default -> throw new IllegalArgumentException("未知操作类型: " + type + "（仅支持 update/delete/replace/insert）");
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
            if (!componentCatalog.isValidComponentName(requestComponents, name)) {
                throw new IllegalArgumentException("组件名 \"" + name + "\" 不在组件库中，可用组件: " + componentCatalog.componentNames());
            }
            // componentProps 契约校验（key 白名单 / select 枚举 / 数值范围），失败由上层转错误事件让模型自愈
            AiComponentCatalog.ComponentSpec spec = componentCatalog.findSpec(requestComponents, name);
            if (spec != null) {
                componentCatalog.validateComponentProps(spec, node);
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
