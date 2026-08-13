package com.xgdesign.project;

import com.xgdesign.common.ForbiddenException;
import com.xgdesign.common.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 文档级权限判定（S3）：owner 全权限；member 按 role（S4 接入 document_members）；
 * 其余 403。
 */
@Service
public class AccessService {

    private final DocumentRepository documentRepository;

    public AccessService(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    /**
     * 校验访问权并返回文档实体。
     *
     * @param write true 表示需要写权限（保存/归档/分享等）
     */
    public DocumentEntity check(UUID documentId, UUID userId, boolean write) {
        DocumentEntity document = documentRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("文档不存在或无权访问"));
        if (userId == null) {
            throw new ForbiddenException("请先登录");
        }
        if (userId.equals(document.getOwnerId())) {
            return document;
        }
        // TODO(S4): document_members 协作权限，editor 可写 / viewer 只读
        throw new ForbiddenException("无权访问该文档");
    }
}
