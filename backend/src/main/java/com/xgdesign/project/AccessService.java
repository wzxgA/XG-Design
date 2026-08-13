package com.xgdesign.project;

import com.xgdesign.common.ForbiddenException;
import com.xgdesign.common.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 文档级权限判定（S3+S4）：owner 全权限；member 按 role（editor 可写 / viewer 只读）；
 * 分享链接权限仅作用于匿名访问，登录用户一律走成员判定。
 */
@Service
public class AccessService {

    private final DocumentRepository documentRepository;
    private final DocumentMemberRepository memberRepository;

    public AccessService(DocumentRepository documentRepository,
                         DocumentMemberRepository memberRepository) {
        this.documentRepository = documentRepository;
        this.memberRepository = memberRepository;
    }

    /**
     * 校验访问权并返回文档实体。
     *
     * @param write true 表示需要写权限（保存/归档/分享/成员管理等）
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
        DocumentMemberEntity member = memberRepository.findByDocumentIdAndUserId(documentId, userId)
                .orElseThrow(() -> new ForbiddenException("无访问权限"));
        if (write && "viewer".equals(member.getRole())) {
            throw new ForbiddenException("只读权限，不能编辑");
        }
        return document;
    }
}
