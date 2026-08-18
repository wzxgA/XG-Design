package com.xgdesign.ai.tool;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 任务规划工具（Function Calling）。
 * <p>
 * AI 调用 {@code planTasks} 将复杂的用户需求拆解为任务列表，随后按 taskId 逐任务调用
 * generateDesign/editDesign，实现"先计划、逐个生成、每步打勾"的增量式执行，
 * 避免单次输出过大被截断（每次工具调用的参数是独立模型输出，各自享有独立输出预算）。
 * <p>
 * 每次对话请求创建新实例，避免并发会话共享状态。
 */
public class PlanToolCallback {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AtomicReference<String> planRef;

    public PlanToolCallback(AtomicReference<String> planRef) {
        this.planRef = planRef;
    }

    @Tool(description = "将复杂的用户需求拆解为任务列表（仅用于复杂/复合需求：多个独立界面/页面、多模块、多步骤、含跳转关系）。任务列表为 JSON 数组，每条: {\"taskId\":\"t1\",\"title\":\"登录页\",\"description\":\"生成登录页画板\",\"action\":\"generate|edit\"}。调用后必须按 taskId 逐任务调用 generateDesign/editDesign，一个任务只产出一个结果，禁止跨任务合并输出。简单需求（单个页面/组件/单次修改）不要调用本工具，直接 generateDesign/editDesign。")
    public PlanResult planTasks(
            @ToolParam(description = "任务列表 JSON 数组字符串，例如 [{\"taskId\":\"t1\",\"title\":\"登录页\",\"description\":\"生成登录页画板\",\"action\":\"generate\"},{\"taskId\":\"t2\",\"title\":\"注册页\",\"description\":\"生成注册页画板\",\"action\":\"generate\"}]") String taskListJson
    ) {
        String normalized = validateTaskList(taskListJson);
        planRef.set(normalized);
        return new PlanResult(normalized);
    }

    /** 校验任务列表：数组、每条含非空 taskId/title、action 枚举；非法条目静默丢弃（避免重试循环） */
    private String validateTaskList(String taskListJson) {
        if (taskListJson == null || taskListJson.isBlank()) {
            throw new IllegalArgumentException("任务列表 JSON 为空");
        }
        JsonNode parsed;
        try {
            parsed = MAPPER.readTree(taskListJson);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("任务列表 JSON 格式错误，请改为合法 JSON 数组后重试: " + e.getOriginalMessage(), e);
        }
        if (!parsed.isArray()) {
            throw new IllegalArgumentException("任务列表必须是 JSON 数组，请修正后重试。");
        }
        ArrayNode out = MAPPER.createArrayNode();
        Set<String> seen = new HashSet<>();
        for (JsonNode item : parsed) {
            if (!item.isObject()) continue;
            String taskId = item.path("taskId").asText("");
            String title = item.path("title").asText("");
            if (taskId.isBlank() || title.isBlank()) continue;
            if (!seen.add(taskId)) continue; // taskId 去重，避免结果冲突
            ObjectNode o = MAPPER.createObjectNode();
            o.put("taskId", taskId);
            o.put("title", title);
            o.put("description", item.path("description").asText(""));
            String action = item.path("action").asText("generate");
            if (!"edit".equals(action)) action = "generate";
            o.put("action", action);
            out.add(o);
        }
        if (out.isEmpty()) {
            throw new IllegalArgumentException("任务列表为空或全部条目非法，请输出至少 1 个合法任务（含 taskId 与 title）。");
        }
        try {
            return MAPPER.writeValueAsString(out);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("任务列表序列化失败，请重试。", e);
        }
    }

    public record PlanResult(String taskListJson) {}
}
