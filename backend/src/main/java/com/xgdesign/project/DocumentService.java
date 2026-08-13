package com.xgdesign.project;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xgdesign.common.NotFoundException;
import com.xgdesign.common.PayloadTooLargeException;
import com.xgdesign.common.VersionConflictException;
import com.xgdesign.project.dto.CreateProjectRequest;
import com.xgdesign.project.dto.DocumentDto;
import com.xgdesign.project.dto.ProjectMetaDto;
import com.xgdesign.project.dto.SaveDocumentRequest;
import com.xgdesign.project.dto.SaveResultDto;
import com.xgdesign.security.CurrentUserProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentService {

    /** 单文档 content 上限：5MB */
    private static final long MAX_CONTENT_BYTES = 5L * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private final DocumentRepository documentRepository;
    private final OperationLogRepository operationLogRepository;
    private final ObjectMapper objectMapper;
    private final String starterDocumentJson;

    public DocumentService(DocumentRepository documentRepository,
                           OperationLogRepository operationLogRepository,
                           ObjectMapper objectMapper) {
        this.documentRepository = documentRepository;
        this.operationLogRepository = operationLogRepository;
        this.objectMapper = objectMapper;
        this.starterDocumentJson = loadStarterDocument();
    }

    private String loadStarterDocument() {
        try (InputStream in = new ClassPathResource("starter-document.json").getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("无法加载 starter-document.json", e);
        }
    }

    // ---------------------------------------------------------------- 查询

    @Transactional(readOnly = true)
    public List<ProjectMetaDto> listProjects() {
        UUID ownerId = CurrentUserProvider.currentUserId();
        return documentRepository.findByOwnerIdAndArchivedFalseOrderByUpdatedAtDesc(ownerId)
                .stream()
                .map(this::toMetaDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocument(UUID id) {
        DocumentEntity entity = requireOwned(id);
        return new DocumentDto(toMetaDto(entity), parseContent(entity.getContent()), entity.getVersion());
    }

    // ---------------------------------------------------------------- 写操作

    @Transactional
    public ProjectMetaDto createProject(CreateProjectRequest request) {
        UUID ownerId = CurrentUserProvider.currentUserId();
        String name = (request != null && request.name() != null && !request.name().isBlank())
                ? request.name().trim()
                : starterDocumentName();

        // 深拷贝模板并替换 id/name/updatedAt
        JsonNode template = parseContent(starterDocumentJson);
        String content = deepCopyWithMeta(template, name);

        DocumentEntity entity = new DocumentEntity();
        entity.setId(UUID.randomUUID());
        entity.setOwnerId(ownerId);
        entity.setName(name);
        entity.setContent(content);
        entity.setVersion(1L);
        entity.setArchived(false);
        Instant now = Instant.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        documentRepository.save(entity);
        logOperation(entity.getId(), "create");
        return toMetaDto(entity);
    }

    @Transactional
    public SaveResultDto saveDocument(UUID id, SaveDocumentRequest request) {
        requireOwned(id);
        validatePayload(request.content());

        Instant now = Instant.now();
        int updated = documentRepository.saveWithVersion(
                id, request.name().trim(), request.content(), request.version(), now);
        if (updated == 0) {
            // 版本冲突：文档仍存在但版本已变化
            throw new VersionConflictException("文档已被其他窗口修改，请刷新后重试");
        }
        logOperation(id, "update");
        return new SaveResultDto(request.version() + 1, now.toEpochMilli());
    }

    @Transactional
    public ProjectMetaDto duplicate(UUID id) {
        DocumentEntity source = requireOwned(id);

        String name = source.getName() + " 副本";
        String content = deepCopyWithMeta(parseContent(source.getContent()), name);

        DocumentEntity copy = new DocumentEntity();
        copy.setId(UUID.randomUUID());
        copy.setOwnerId(source.getOwnerId());
        copy.setName(name);
        copy.setContent(content);
        copy.setVersion(1L);
        copy.setArchived(false);
        Instant now = Instant.now();
        copy.setCreatedAt(now);
        copy.setUpdatedAt(now);
        documentRepository.save(copy);
        logOperation(copy.getId(), "duplicate");
        return toMetaDto(copy);
    }

    @Transactional
    public ProjectMetaDto setArchived(UUID id, boolean archived) {
        DocumentEntity entity = requireOwned(id);
        entity.setArchived(archived);
        entity.setUpdatedAt(Instant.now());
        documentRepository.save(entity);
        logOperation(id, archived ? "archive" : "unarchive");
        return toMetaDto(entity);
    }

    // ---------------------------------------------------------------- 内部

    private DocumentEntity requireOwned(UUID id) {
        UUID ownerId = CurrentUserProvider.currentUserId();
        return documentRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("文档不存在或无权访问"));
    }

    private ProjectMetaDto toMetaDto(DocumentEntity entity) {
        return new ProjectMetaDto(
                entity.getId(),
                entity.getName(),
                entity.getUpdatedAt().toEpochMilli(),
                entity.getArchived(),
                null);
    }

    private JsonNode parseContent(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("content 不是合法 JSON", e);
        }
    }

    private void validatePayload(String content) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("content 不能为空");
        }
        if (content.getBytes(StandardCharsets.UTF_8).length > MAX_CONTENT_BYTES) {
            throw new PayloadTooLargeException("文档内容超过 5MB 上限");
        }
        JsonNode node = parseContent(content);
        if (!node.has("id") || !node.has("pages") || !node.has("activePageId")) {
            throw new IllegalArgumentException("content 缺少基本结构：id / pages / activePageId");
        }
    }

    /** 深拷贝模板：替换 id / name / updatedAt，保持其它结构与值不变 */
    private String deepCopyWithMeta(JsonNode template, String name) {
        JsonNode copy = template.deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) copy).put("id", "doc-" + UUID.randomUUID());
        ((com.fasterxml.jackson.databind.node.ObjectNode) copy).put("name", name);
        ((com.fasterxml.jackson.databind.node.ObjectNode) copy).put("updatedAt", Instant.now().toEpochMilli());
        try {
            return objectMapper.writeValueAsString(copy);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("序列化 content 失败", e);
        }
    }

    private String starterDocumentName() {
        JsonNode template = parseContent(starterDocumentJson);
        return template.path("name").asText("未命名设计稿");
    }

    private void logOperation(UUID documentId, String action) {
        UUID userId = CurrentUserProvider.currentUserId();
        OperationLogEntity operation = new OperationLogEntity();
        operation.setDocumentId(documentId);
        operation.setUserId(userId);
        operation.setAction(action);
        operationLogRepository.save(operation);
        log.info("[operation] doc={} action={} user={}", documentId, action, userId);
    }
}
