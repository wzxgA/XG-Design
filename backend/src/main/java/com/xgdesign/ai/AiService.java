package com.xgdesign.ai;

import com.xgdesign.ai.dto.*;
import com.xgdesign.ai.prompt.PromptBuilder;
import com.xgdesign.ai.tool.DesignToolCallback;
import com.xgdesign.security.CurrentUserProvider;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

/**
 * AI 核心编排服务：会话管理 + 流式对话 + 设计生成 + Mock 模式。
 */
@Service
public class AiService {

    private final ChatClient chatClient;
    private final ChatSessionRepository sessionRepo;
    private final ChatMessageRepository messageRepo;
    private final PromptBuilder promptBuilder;
    private final AiProperties properties;
    private final String apiKey;

    public AiService(ChatClient chatClient,
                     ChatSessionRepository sessionRepo,
                     ChatMessageRepository messageRepo,
                     PromptBuilder promptBuilder,
                     AiProperties properties,
                     @Value("${spring.ai.openai.api-key:}") String apiKey) {
        this.chatClient = chatClient;
        this.sessionRepo = sessionRepo;
        this.messageRepo = messageRepo;
        this.promptBuilder = promptBuilder;
        this.properties = properties;
        this.apiKey = apiKey;
    }

    // ==================== 会话管理 ====================

    public ChatSessionDto createSession(UUID documentId) {
        ChatSessionEntity session = new ChatSessionEntity();
        session.setUserId(CurrentUserProvider.requireUserId());
        session.setDocumentId(documentId);
        session = sessionRepo.save(session);
        return toSessionDto(session);
    }

    public List<ChatSessionDto> listSessions(UUID documentId) {
        UUID userId = CurrentUserProvider.requireUserId();
        List<ChatSessionEntity> sessions = (documentId != null)
                ? sessionRepo.findByUserIdAndDocumentIdOrderByLastMessageAtDesc(userId, documentId)
                : sessionRepo.findByUserIdOrderByLastMessageAtDesc(userId);
        return sessions.stream().map(this::toSessionDto).toList();
    }

    public List<ChatMessageDto> getMessages(UUID sessionId) {
        verifySessionOwnership(sessionId);
        return messageRepo.findBySessionIdOrderByCreatedAtAsc(sessionId).stream()
                .map(this::toMessageDto)
                .toList();
    }

    public void deleteSession(UUID sessionId) {
        verifySessionOwnership(sessionId);
        sessionRepo.deleteById(sessionId);
    }

    public ChatSessionDto updateTitle(UUID sessionId, String title) {
        verifySessionOwnership(sessionId);
        ChatSessionEntity session = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("会话不存在"));
        session.setTitle(title != null && !title.isBlank() ? title : "新对话");
        session.setUpdatedAt(Instant.now());
        session = sessionRepo.save(session);
        return toSessionDto(session);
    }

    // ==================== 核心对话 ====================

    public Flux<ServerSentEvent<ChatStreamEvent>> chat(ChatRequest request) {
        try {
            if (!properties.isEnabled()) {
                return Flux.just(errorEvent("AI 功能未启用", null));
            }

            // 1. 获取或创建会话
            ChatSessionEntity session = resolveSession(request);
            UUID sessionId = session.getId();
            UUID messageId = UUID.randomUUID();

            // 2. 构建系统提示
            String systemPrompt = promptBuilder.buildSystemPrompt(request);

            // 3. 加载历史消息
            List<Message> history = loadHistory(sessionId);

            // 4. 持久化用户消息
            saveUserMessage(sessionId, request.message());
            updateSessionStats(sessionId);

            // 5. Mock 模式（配置开启 或 未配置真实 API Key 时自动降级）
            boolean noRealKey = apiKey == null || apiKey.isBlank() || apiKey.startsWith("placeholder");
            if (properties.isMockMode() || noRealKey) {
                return mockChat(request, sessionId, messageId);
            }

            // 6. 真实 LLM 调用
            AtomicReference<String> designRef = new AtomicReference<>();
            AtomicReference<String> descRef = new AtomicReference<>();
            DesignToolCallback toolCallback = new DesignToolCallback(designRef, descRef);

            StringBuilder aiReplyBuffer = new StringBuilder();
            String sid = sessionId.toString();
            String mid = messageId.toString();

            return chatClient.prompt()
                    .system(systemPrompt)
                    .messages(history)
                    .user(request.message())
                    .tools(toolCallback)
                    .stream()
                    .chatResponse()
                    .<ServerSentEvent<ChatStreamEvent>>handle((resp, sink) -> {
                        ServerSentEvent<ChatStreamEvent> event = extractText(resp, aiReplyBuffer, sid, mid);
                        if (event != null) {
                            sink.next(event);
                        }
                    })
                    .concatWith(Flux.defer(() -> {
                        List<ServerSentEvent<ChatStreamEvent>> events = new ArrayList<>();
                        String design = designRef.get();
                        if (design != null) {
                            events.add(designEvent(design, descRef.get(), sid, mid));
                        }
                        saveAiMessage(sessionId, aiReplyBuffer.toString(), design, descRef.get());
                        updateSessionStats(sessionId);
                        events.add(doneEvent(sid, mid));
                        return Flux.fromIterable(events);
                    }))
                    .onErrorResume(e -> {
                        saveAiMessage(sessionId, aiReplyBuffer.toString(), null, null);
                        updateSessionStats(sessionId);
                        return Flux.just(errorEvent(e.getMessage(), sid));
                    });
        } catch (Exception e) {
            return Flux.just(errorEvent(e.getMessage(), null));
        }
    }

    // ==================== Mock 模式 ====================

    private Flux<ServerSentEvent<ChatStreamEvent>> mockChat(ChatRequest request, UUID sessionId, UUID messageId) {
        String mockText = "好的，我来帮你设计「" + request.message() + "」。以下是我生成的设计方案，你可以预览后应用到画布。";
        String mockDesign = MockDesignTemplates.getTemplate(request.message());
        String mockDesc = MockDesignTemplates.getDescription(request.message());

        saveAiMessage(sessionId, mockText, mockDesign, mockDesc);
        updateSessionStats(sessionId);

        String sid = sessionId.toString();
        String mid = messageId.toString();

        return Flux.just(
                textEvent(mockText, sid, mid),
                designEvent(mockDesign, mockDesc, sid, mid),
                doneEvent(sid, mid)
        );
    }

    // ==================== 内部方法 ====================

    private ChatSessionEntity resolveSession(ChatRequest request) {
        if (request.sessionId() != null && !request.sessionId().isBlank()) {
            UUID sid = UUID.fromString(request.sessionId());
            return sessionRepo.findById(sid)
                    .orElseThrow(() -> new IllegalArgumentException("会话不存在: " + sid));
        }
        ChatSessionEntity session = new ChatSessionEntity();
        session.setUserId(CurrentUserProvider.requireUserId());
        if (request.documentId() != null && !request.documentId().isBlank()) {
            session.setDocumentId(parseUuidOrNull(request.documentId()));
        }
        return sessionRepo.save(session);
    }

    private List<Message> loadHistory(UUID sessionId) {
        List<ChatMessageEntity> messages = messageRepo.findBySessionIdOrderByCreatedAtAsc(sessionId);
        int max = properties.getMaxHistoryMessages();
        if (messages.size() > max) {
            messages = messages.subList(messages.size() - max, messages.size());
        }
        return messages.stream()
                .map(m -> switch (m.getRole()) {
                    case "user" -> (Message) new UserMessage(m.getContent());
                    case "assistant" -> (Message) new AssistantMessage(m.getContent());
                    default -> (Message) new UserMessage(m.getContent());
                })
                .toList();
    }

    private void saveUserMessage(UUID sessionId, String content) {
        ChatMessageEntity msg = new ChatMessageEntity();
        msg.setSessionId(sessionId);
        msg.setRole("user");
        msg.setContent(content);
        messageRepo.save(msg);
    }

    private void saveAiMessage(UUID sessionId, String content, String designSuggestion, String designDescription) {
        ChatMessageEntity msg = new ChatMessageEntity();
        msg.setSessionId(sessionId);
        msg.setRole("assistant");
        msg.setContent(content != null ? content : "");
        msg.setDesignSuggestion(designSuggestion);
        msg.setDesignDescription(designDescription);
        messageRepo.save(msg);
    }

    private void updateSessionStats(UUID sessionId) {
        sessionRepo.findById(sessionId).ifPresent(session -> {
            session.setMessageCount((int) messageRepo.countBySessionId(sessionId));
            session.setLastMessageAt(Instant.now());
            session.setUpdatedAt(Instant.now());
            sessionRepo.save(session);
        });
    }

    private void verifySessionOwnership(UUID sessionId) {
        UUID userId = CurrentUserProvider.requireUserId();
        ChatSessionEntity session = sessionRepo.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("会话不存在"));
        if (!session.getUserId().equals(userId)) {
            throw new IllegalArgumentException("无权访问此会话");
        }
    }

    private ServerSentEvent<ChatStreamEvent> extractText(ChatResponse resp, StringBuilder buffer, String sid, String mid) {
        if (resp.getResult() != null && resp.getResult().getOutput() != null) {
            String text = resp.getResult().getOutput().getText();
            if (text != null && !text.isEmpty()) {
                buffer.append(text);
                return textEvent(text, sid, mid);
            }
        }
        return null;
    }

    // ==================== SSE 事件构建 ====================

    /** 尝试解析 UUID，非合法格式返回 null（前端可能传 doc-xxx 格式的非 UUID ID） */
    private UUID parseUuidOrNull(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private ServerSentEvent<ChatStreamEvent> textEvent(String text, String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("text", text, sessionId, messageId))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> designEvent(String design, String description, String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("design", design, sessionId, messageId))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> doneEvent(String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("done", null, sessionId, messageId))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> errorEvent(String message, String sessionId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("error", message, sessionId, null))
                .build();
    }

    // ==================== DTO 转换 ====================

    private ChatSessionDto toSessionDto(ChatSessionEntity entity) {
        return new ChatSessionDto(
                entity.getId().toString(),
                entity.getTitle(),
                entity.getDocumentId() != null ? entity.getDocumentId().toString() : null,
                entity.getMessageCount(),
                entity.getLastMessageAt().toString(),
                entity.getCreatedAt().toString()
        );
    }

    private ChatMessageDto toMessageDto(ChatMessageEntity entity) {
        DesignSuggestionDto suggestion = null;
        if (entity.getDesignSuggestion() != null) {
            suggestion = new DesignSuggestionDto(
                    entity.getDesignSuggestion(),
                    entity.getDesignDescription()
            );
        }
        return new ChatMessageDto(
                entity.getId().toString(),
                entity.getSessionId().toString(),
                entity.getRole(),
                entity.getContent(),
                suggestion,
                entity.getCreatedAt().toString()
        );
    }
}
