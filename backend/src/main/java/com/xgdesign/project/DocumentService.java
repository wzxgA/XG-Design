package com.xgdesign.project;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xgdesign.common.ForbiddenException;
import com.xgdesign.common.NotFoundException;
import com.xgdesign.common.PayloadTooLargeException;
import com.xgdesign.common.VersionConflictException;
import com.xgdesign.project.dto.CreateProjectRequest;
import com.xgdesign.project.dto.DocumentDto;
import com.xgdesign.project.dto.ProjectMetaDto;
import com.xgdesign.project.dto.SaveDocumentRequest;
import com.xgdesign.project.dto.SaveResultDto;
import com.xgdesign.project.dto.ShareInfoDto;
import com.xgdesign.project.dto.SharedDocumentDto;
import com.xgdesign.project.dto.UpdateShareRequest;
import com.xgdesign.security.CurrentUserProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
public class DocumentService {

    /** 单文档 content 上限：5MB */
    private static final long MAX_CONTENT_BYTES = 5L * 1024 * 1024;

    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final DocumentRepository documentRepository;
    private final OperationLogRepository operationLogRepository;
    private final ShareLinkRepository shareLinkRepository;
    private final AccessService accessService;
    private final ObjectMapper objectMapper;
    private final String starterDocumentJson;

    public DocumentService(DocumentRepository documentRepository,
                           OperationLogRepository operationLogRepository,
                           ShareLinkRepository shareLinkRepository,
                           AccessService accessService,
                           ObjectMapper objectMapper) {
        this.documentRepository = documentRepository;
        this.operationLogRepository = operationLogRepository;
        this.shareLinkRepository = shareLinkRepository;
        this.accessService = accessService;
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
        UUID ownerId = CurrentUserProvider.requireUserId();
        return documentRepository.findByOwnerIdAndArchivedFalseOrderByUpdatedAtDesc(ownerId)
                .stream()
                .map(this::toMetaDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocument(UUID id) {
        DocumentEntity entity = accessService.check(id, CurrentUserProvider.requireUserId(), false);
        return new DocumentDto(toMetaDto(entity), parseContent(entity.getContent()), entity.getVersion());
    }

    // ---------------------------------------------------------------- 写操作

    @Transactional
    public ProjectMetaDto createProject(CreateProjectRequest request) {
        UUID ownerId = CurrentUserProvider.requireUserId();
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
        accessService.check(id, CurrentUserProvider.requireUserId(), true);
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
        DocumentEntity source = accessService.check(id, CurrentUserProvider.requireUserId(), false);

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
        DocumentEntity entity = accessService.check(id, CurrentUserProvider.requireUserId(), true);
        entity.setArchived(archived);
        entity.setUpdatedAt(Instant.now());
        documentRepository.save(entity);
        logOperation(id, archived ? "archive" : "unarchive");
        return toMetaDto(entity);
    }

    // ---------------------------------------------------------------- 分享

    /** 创建/更新分享链接：已存在则旧链接失效，重新生成 token */
    @Transactional
    public ShareInfoDto createShare(UUID id, UpdateShareRequest request) {
        accessService.check(id, CurrentUserProvider.requireUserId(), true);

        shareLinkRepository.findByDocumentIdAndActiveTrue(id).ifPresent(old -> {
            old.setActive(false);
            shareLinkRepository.save(old);
        });

        ShareLinkEntity link = new ShareLinkEntity();
        link.setDocumentId(id);
        link.setToken(generateToken());
        link.setPermission(request.permission());
        link.setActive(true);
        shareLinkRepository.save(link);

        logOperation(id, "share.create");
        return ShareInfoDto.from(link);
    }

    /** 撤销分享：active=false，链接即刻失效 */
    @Transactional
    public void revokeShare(UUID id) {
        accessService.check(id, CurrentUserProvider.requireUserId(), true);
        shareLinkRepository.findByDocumentIdAndActiveTrue(id).ifPresent(link -> {
            link.setActive(false);
            shareLinkRepository.save(link);
        });
        logOperation(id, "share.revoke");
    }

    /** 按 token 打开分享文档（匿名可访问；链接即凭证） */
    @Transactional(readOnly = true)
    public SharedDocumentDto openShared(String token) {
        ShareLinkEntity link = shareLinkRepository.findByTokenAndActiveTrue(token)
                .orElseThrow(() -> new NotFoundException("分享链接不存在或已失效"));
        DocumentEntity document = documentRepository.findById(link.getDocumentId())
                .orElseThrow(() -> new NotFoundException("文档不存在或已删除"));
        return new SharedDocumentDto(
                toMetaDto(document),
                parseContent(document.getContent()),
                document.getVersion(),
                link.getPermission());
    }

    /** 通过 edit 分享链接匿名保存（乐观锁 + 版本递增） */
    @Transactional
    public SaveResultDto saveShared(String token, SaveDocumentRequest request) {
        ShareLinkEntity link = shareLinkRepository.findByTokenAndActiveTrue(token)
                .orElseThrow(() -> new NotFoundException("分享链接不存在或已失效"));
        if (!"edit".equals(link.getPermission())) {
            throw new ForbiddenException("该分享链接为只读，不允许编辑");
        }
        // 文档存在性由 share_links.document_id 外键(ON DELETE CASCADE)保证
        validatePayload(request.content());

        Instant now = Instant.now();
        int updated = documentRepository.saveWithVersion(
                link.getDocumentId(), request.name().trim(), request.content(), request.version(), now);
        if (updated == 0) {
            throw new VersionConflictException("文档已被其他窗口修改，请刷新后重试");
        }
        logOperation(link.getDocumentId(), "shared.edit",
                "{\"token\":\"" + token.substring(0, Math.min(8, token.length())) + "...\"}");
        return new SaveResultDto(request.version() + 1, now.toEpochMilli());
    }

    // ---------------------------------------------------------------- 内部

    /** 32 字节 SecureRandom → Base64URL（43 字符），不可枚举 */
    private static String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private ProjectMetaDto toMetaDto(DocumentEntity entity) {
        ShareInfoDto share = shareLinkRepository.findByDocumentIdAndActiveTrue(entity.getId())
                .map(ShareInfoDto::from)
                .orElse(null);
        return new ProjectMetaDto(
                entity.getId(),
                entity.getName(),
                entity.getUpdatedAt().toEpochMilli(),
                entity.getArchived(),
                share);
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
        logOperation(documentId, action, null);
    }

    private void logOperation(UUID documentId, String action, String detail) {
        UUID userId = CurrentUserProvider.currentUserId();
        OperationLogEntity operation = new OperationLogEntity();
        operation.setDocumentId(documentId);
        operation.setUserId(userId);
        operation.setAction(action);
        operation.setDetail(detail);
        operationLogRepository.save(operation);
        log.info("[operation] doc={} action={} user={}", documentId, action, userId);
    }
}
