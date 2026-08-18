package com.xgdesign.ai.dto;

/**
 * SSE 流式事件。
 *
 * @param type       事件类型: "text" | "plan" | "design" | "edit" | "done" | "error"
 * @param content    type=text: 文本片段; type=plan: 任务列表 JSON; type=design: LayerNode[] JSON; type=edit: 操作指令 JSON; type=error: 错误信息
 * @param sessionId  会话 ID
 * @param messageId  消息 ID
 * @param linksJson  type=design 时的原型跳转声明 JSON 数组（可空）
 * @param taskId     任务清单场景下的任务 ID；为空表示消息级结果（非任务清单场景）
 */
public record ChatStreamEvent(
        String type,
        String content,
        String sessionId,
        String messageId,
        String linksJson,
        String taskId
) {}
