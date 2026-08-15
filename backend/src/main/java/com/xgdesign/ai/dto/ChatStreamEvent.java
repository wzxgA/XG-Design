package com.xgdesign.ai.dto;

/**
 * SSE 流式事件。
 *
 * @param type       事件类型: "text" | "design" | "edit" | "done" | "error"
 * @param content    type=text: 文本片段; type=design: LayerNode[] JSON; type=edit: 操作指令 JSON; type=error: 错误信息
 * @param sessionId  会话 ID
 * @param messageId  消息 ID
 */
public record ChatStreamEvent(
        String type,
        String content,
        String sessionId,
        String messageId
) {}
