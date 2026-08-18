package com.xgdesign.ai.tool;

/**
 * 单次工具调用结果（按任务累计）。
 *
 * @param taskId      任务 ID；为空或 {@link #DEFAULT_TASK} 表示消息级结果（非任务清单场景）
 * @param kind        结果类型: "design" | "edit"
 * @param content     生成的设计 JSON 或修改操作 JSON
 * @param description 结果描述
 * @param linksJson   design 结果的原型跳转声明 JSON（可空）
 */
public record TaskToolResult(String taskId, String kind, String content, String description, String linksJson) {

    /** 无 taskId 时的默认 key（保持对既有"单结果"调用的兼容） */
    public static final String DEFAULT_TASK = "__main__";
}
