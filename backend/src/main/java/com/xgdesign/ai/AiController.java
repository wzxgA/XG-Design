package com.xgdesign.ai;

import com.xgdesign.ai.dto.*;
import com.xgdesign.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.UUID;

/**
 * AI 对话 REST + SSE 端点。
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    /** 创建会话 */
    @PostMapping("/sessions")
    public ApiResponse<ChatSessionDto> createSession(
            @RequestParam(required = false) String documentId) {
        return ApiResponse.ok(aiService.createSession(parseUuidOrNull(documentId)));
    }

    /** 获取会话列表 */
    @GetMapping("/sessions")
    public ApiResponse<List<ChatSessionDto>> listSessions(
            @RequestParam(required = false) String documentId) {
        return ApiResponse.ok(aiService.listSessions(parseUuidOrNull(documentId)));
    }

    /** 获取会话消息历史 */
    @GetMapping("/sessions/{sessionId}/messages")
    public ApiResponse<List<ChatMessageDto>> getMessages(
            @PathVariable UUID sessionId) {
        return ApiResponse.ok(aiService.getMessages(sessionId));
    }

    /** 对话（SSE 流式） */
    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<ChatStreamEvent>> chat(
            @Valid @RequestBody ChatRequest request) {
        // 最外层兜底：确保任何异常都转化为 SSE error 事件，不传播到 servlet 容器
        return aiService.chat(request)
                .onErrorResume(e -> Flux.just(
                        ServerSentEvent.<ChatStreamEvent>builder()
                                .data(new ChatStreamEvent("error", e.getMessage(), null, null, null, null))
                                .build()
                ));
    }

    /** 删除会话 */
    @DeleteMapping("/sessions/{sessionId}")
    public ApiResponse<Void> deleteSession(@PathVariable UUID sessionId) {
        aiService.deleteSession(sessionId);
        return ApiResponse.ok();
    }

    /** 修改会话标题 */
    @PutMapping("/sessions/{sessionId}/title")
    public ApiResponse<ChatSessionDto> updateTitle(
            @PathVariable UUID sessionId,
            @RequestBody UpdateTitleRequest request) {
        return ApiResponse.ok(aiService.updateTitle(sessionId, request.title()));
    }

    /** 尝试解析 UUID，非合法格式返回 null */
    private static java.util.UUID parseUuidOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return java.util.UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
