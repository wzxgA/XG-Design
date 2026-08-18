package com.xgdesign.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.xgdesign.ai.dto.*;
import com.xgdesign.ai.prompt.PromptBuilder;
import com.xgdesign.ai.prompt.AiComponentCatalog;
import com.xgdesign.ai.tool.DesignToolCallback;
import com.xgdesign.ai.tool.EditDesignCallback;
import com.xgdesign.ai.tool.PlanToolCallback;
import com.xgdesign.ai.tool.TaskToolResult;
import com.xgdesign.security.CurrentUserProvider;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
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

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ChatSessionRepository sessionRepo;
    private final ChatMessageRepository messageRepo;
    private final PromptBuilder promptBuilder;
    private final AiComponentCatalog componentCatalog;
    private final AiProperties properties;
    private final AiModelFactory modelFactory;

    public AiService(ChatSessionRepository sessionRepo,
                     ChatMessageRepository messageRepo,
                     PromptBuilder promptBuilder,
                     AiComponentCatalog componentCatalog,
                     AiProperties properties,
                     AiModelFactory modelFactory) {
        this.sessionRepo = sessionRepo;
        this.messageRepo = messageRepo;
        this.promptBuilder = promptBuilder;
        this.componentCatalog = componentCatalog;
        this.properties = properties;
        this.modelFactory = modelFactory;
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

            // 2. 构建系统提示（优先用前端随请求发送的组件 schema，含完整 props 契约）
            List<AiComponentCatalog.ComponentSpec> requestComponents = componentCatalog.parseSchema(request.componentSchema());
            String systemPrompt = promptBuilder.buildSystemPrompt(request, requestComponents);

            // 3. 加载历史消息
            List<Message> history = loadHistory(sessionId);

            // 4. 持久化用户消息
            saveUserMessage(sessionId, request.message());
            updateSessionStats(sessionId);

            // 5. 按用户配置构建客户端；Mock 模式或用户/全局无有效 Key 时走 Mock
            ChatClient client = modelFactory.buildForCurrentUser();
            if (properties.isMockMode() || client == null) {
                return mockChat(request, sessionId, messageId);
            }

            // 6. 真实 LLM 调用
            // 结果按任务累计（taskId → 结果，插入顺序即工具调用顺序）；planTasks 拆解任务清单
            AtomicReference<String> planRef = new AtomicReference<>();
            Map<String, TaskToolResult> taskResults = Collections.synchronizedMap(new LinkedHashMap<>());
            DesignToolCallback toolCallback = new DesignToolCallback(taskResults, componentCatalog, requestComponents);
            // editDesign 工具：修改/删除/替换/新增图层
            EditDesignCallback editToolCallback = new EditDesignCallback(taskResults, componentCatalog, requestComponents);
            // planTasks 工具：复杂需求先拆解任务清单，再逐任务执行
            PlanToolCallback planToolCallback = new PlanToolCallback(planRef);

            StringBuilder aiReplyBuffer = new StringBuilder();
            String sid = sessionId.toString();
            String mid = messageId.toString();

            return client.prompt()
                    .system(systemPrompt)
                    .messages(history)
                    .user(request.message())
                    .tools(toolCallback, editToolCallback, planToolCallback)
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
                        String plan = planRef.get();
                        List<TaskToolResult> results = new ArrayList<>(taskResults.values());
                        if (plan != null) {
                            // 任务清单场景：plan 事件 + 逐任务 design/edit 事件（带 taskId），每任务独立小输出防截断
                            events.add(planEvent(plan, sid, mid));
                            for (TaskToolResult r : results) {
                                if ("edit".equals(r.kind())) {
                                    events.add(editEvent(r.content(), r.description(), r.taskId(), sid, mid));
                                } else {
                                    events.add(designEvent(r.content(), r.description(), r.linksJson(), r.taskId(), sid, mid));
                                }
                            }
                            saveAiMessage(sessionId, aiReplyBuffer.toString(), null, null, null, null,
                                    plan, toResultsJson(results));
                        } else {
                            // 简单场景：保持消息级建议（向后兼容），design/edit 各取最后一次调用结果
                            TaskToolResult design = lastResult(results, "design");
                            TaskToolResult edit = lastResult(results, "edit");
                            if (design != null) {
                                events.add(designEvent(design.content(), design.description(), design.linksJson(), null, sid, mid));
                            }
                            if (edit != null) {
                                events.add(editEvent(edit.content(), edit.description(), null, sid, mid));
                            }
                            saveAiMessage(sessionId, aiReplyBuffer.toString(),
                                    design != null ? design.content() : null,
                                    design != null ? design.description() : null,
                                    edit != null ? edit.content() : null,
                                    edit != null ? edit.description() : null,
                                    null, null);
                        }
                        updateSessionStats(sessionId);
                        events.add(doneEvent(sid, mid));
                        return Flux.fromIterable(events);
                    }))
                    .onErrorResume(e -> {
                        saveAiMessage(sessionId, aiReplyBuffer.toString(), null, null, null, null, null, null);
                        updateSessionStats(sessionId);
                        return Flux.just(errorEvent(e.getMessage(), sid));
                    });
        } catch (Exception e) {
            return Flux.just(errorEvent(e.getMessage(), null));
        }
    }

    // ==================== Mock 模式 ====================

    private Flux<ServerSentEvent<ChatStreamEvent>> mockChat(ChatRequest request, UUID sessionId, UUID messageId) {
        String mockText = "好的，我来帮你设计「" + request.message() + "」。我已将需求拆解为任务清单，正在逐个实现…";
        String mockDesign = MockDesignTemplates.getTemplate(request.message());
        String mockDesc = MockDesignTemplates.getDescription(request.message());
        // 单任务形态：planTasks 输出 1 个任务 + 对应 design 结果，保证无 Key 时任务清单功能可演示
        String taskId = "t1";
        String planJson = mockPlanJson(taskId, mockDesc);
        String resultsJson = mockResultsJson(taskId, mockDesign, mockDesc);

        saveAiMessage(sessionId, mockText, null, null, null, null, planJson, resultsJson);
        updateSessionStats(sessionId);

        String sid = sessionId.toString();
        String mid = messageId.toString();

        return Flux.just(
                textEvent(mockText, sid, mid),
                planEvent(planJson, sid, mid),
                designEvent(mockDesign, mockDesc, null, taskId, sid, mid),
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

    private void saveAiMessage(UUID sessionId, String content, String designSuggestion, String designDescription,
                               String editOperations, String editDescription, String taskPlan, String taskResults) {
        ChatMessageEntity msg = new ChatMessageEntity();
        msg.setSessionId(sessionId);
        msg.setRole("assistant");
        msg.setContent(content != null ? content : "");
        msg.setDesignSuggestion(designSuggestion);
        msg.setDesignDescription(designDescription);
        msg.setEditOperations(editOperations);
        msg.setEditDescription(editDescription);
        msg.setTaskPlan(taskPlan);
        msg.setTaskResults(taskResults);
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
                .data(new ChatStreamEvent("text", text, sessionId, messageId, null, null))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> planEvent(String plan, String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("plan", plan, sessionId, messageId, null, null))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> designEvent(String design, String description, String linksJson,
                                                         String taskId, String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("design", design, sessionId, messageId, linksJson, taskId))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> editEvent(String operations, String description,
                                                       String taskId, String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("edit", operations, sessionId, messageId, null, taskId))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> doneEvent(String sessionId, String messageId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("done", null, sessionId, messageId, null, null))
                .build();
    }

    private ServerSentEvent<ChatStreamEvent> errorEvent(String message, String sessionId) {
        return ServerSentEvent.<ChatStreamEvent>builder()
                .data(new ChatStreamEvent("error", message, sessionId, null, null, null))
                .build();
    }

    // ==================== 任务清单辅助 ====================

    /** 取结果列表中最后一个指定 kind 的结果（简单场景向后兼容：保留"最后一次调用"语义） */
    private TaskToolResult lastResult(List<TaskToolResult> results, String kind) {
        TaskToolResult found = null;
        for (TaskToolResult r : results) {
            if (kind.equals(r.kind())) found = r;
        }
        return found;
    }

    /** 任务结果列表序列化为 JSON 数组字符串（持久化用） */
    private String toResultsJson(List<TaskToolResult> results) {
        if (results == null || results.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(results);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /** Mock 单任务清单 JSON */
    private String mockPlanJson(String taskId, String title) {
        try {
            ObjectNode o = MAPPER.createObjectNode();
            o.put("taskId", taskId);
            o.put("title", "生成设计");
            o.put("description", title);
            o.put("action", "generate");
            ArrayNode arr = MAPPER.createArrayNode();
            arr.add(o);
            return MAPPER.writeValueAsString(arr);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    /** Mock 单任务结果 JSON */
    private String mockResultsJson(String taskId, String design, String description) {
        try {
            ObjectNode o = MAPPER.createObjectNode();
            o.put("taskId", taskId);
            o.put("kind", "design");
            o.put("content", design);
            o.put("description", description);
            o.put("linksJson", (String) null);
            ArrayNode arr = MAPPER.createArrayNode();
            arr.add(o);
            return MAPPER.writeValueAsString(arr);
        } catch (JsonProcessingException e) {
            return null;
        }
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
        EditOperationsDto editOps = null;
        if (entity.getEditOperations() != null) {
            editOps = new EditOperationsDto(
                    entity.getEditOperations(),
                    entity.getEditDescription()
            );
        }
        return new ChatMessageDto(
                entity.getId().toString(),
                entity.getSessionId().toString(),
                entity.getRole(),
                entity.getContent(),
                suggestion,
                editOps,
                entity.getTaskPlan(),
                entity.getTaskResults(),
                entity.getCreatedAt().toString()
        );
    }
}
