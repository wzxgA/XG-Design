package com.xgdesign.project;

import com.xgdesign.auth.UserEntity;
import com.xgdesign.auth.UserRepository;
import com.xgdesign.common.ForbiddenException;
import com.xgdesign.common.NotFoundException;
import com.xgdesign.project.dto.MemberDto;
import com.xgdesign.security.CurrentUserProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 成员管理（S4）：邀请 / 改角色 / 移除，均需文档写权限（owner 或 editor）。
 * 规则：owner 不可被改角色或移除；邀请与改角色只允许 editor/viewer。
 */
@Service
public class MemberService {

    private static final Logger log = LoggerFactory.getLogger(MemberService.class);

    private final DocumentMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final AccessService accessService;
    private final OperationLogRepository operationLogRepository;

    public MemberService(DocumentMemberRepository memberRepository,
                         UserRepository userRepository,
                         AccessService accessService,
                         OperationLogRepository operationLogRepository) {
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.accessService = accessService;
        this.operationLogRepository = operationLogRepository;
    }

    @Transactional(readOnly = true)
    public List<MemberDto> list(UUID documentId) {
        accessService.check(documentId, CurrentUserProvider.requireUserId(), false);
        List<DocumentMemberEntity> members = memberRepository.findByDocumentId(documentId);
        Map<UUID, UserEntity> users = userRepository
                .findAllById(members.stream().map(DocumentMemberEntity::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(UserEntity::getId, u -> u));
        return members.stream()
                .map(m -> MemberDto.from(m, users.get(m.getUserId())))
                .toList();
    }

    /** 邀请：邮箱 → userId，角色 editor/viewer；已存在则返回 409 冲突语义（抛 VersionConflictException）。 */
    @Transactional
    public MemberDto invite(UUID documentId, String email, String role) {
        accessService.check(documentId, CurrentUserProvider.requireUserId(), true);
        UserEntity user = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new NotFoundException("该邮箱尚未注册"));
        if (memberRepository.existsByDocumentIdAndUserId(documentId, user.getId())) {
            throw new com.xgdesign.common.VersionConflictException("该用户已是协作者");
        }
        DocumentMemberEntity member = new DocumentMemberEntity();
        member.setDocumentId(documentId);
        member.setUserId(user.getId());
        member.setRole(role);
        memberRepository.save(member);
        logOperation(documentId, "member.invite", "{\"user\":\"" + user.getEmail() + "\",\"role\":\"" + role + "\"}");
        return MemberDto.from(member, user);
    }

    /** 改角色：仅 editor/viewer；owner 角色不可改动。 */
    @Transactional
    public void updateRole(UUID documentId, UUID userId, String role) {
        accessService.check(documentId, CurrentUserProvider.requireUserId(), true);
        DocumentMemberEntity member = requireMember(documentId, userId);
        if ("owner".equals(member.getRole())) {
            throw new ForbiddenException("不能修改 owner 角色");
        }
        member.setRole(role);
        memberRepository.save(member);
        logOperation(documentId, "member.role", "{\"user\":\"" + userId + "\",\"role\":\"" + role + "\"}");
    }

    /** 移除成员：owner 不可移除。 */
    @Transactional
    public void remove(UUID documentId, UUID userId) {
        accessService.check(documentId, CurrentUserProvider.requireUserId(), true);
        DocumentMemberEntity member = requireMember(documentId, userId);
        if ("owner".equals(member.getRole())) {
            throw new ForbiddenException("不能移除 owner");
        }
        memberRepository.deleteByDocumentIdAndUserId(documentId, userId);
        logOperation(documentId, "member.remove", "{\"user\":\"" + userId + "\"}");
    }

    private DocumentMemberEntity requireMember(UUID documentId, UUID userId) {
        return memberRepository.findByDocumentIdAndUserId(documentId, userId)
                .orElseThrow(() -> new NotFoundException("该用户不是协作者"));
    }

    private void logOperation(UUID documentId, String action, String detail) {
        OperationLogEntity operation = new OperationLogEntity();
        operation.setDocumentId(documentId);
        operation.setUserId(CurrentUserProvider.currentUserId());
        operation.setAction(action);
        operation.setDetail(detail);
        operationLogRepository.save(operation);
        log.info("[operation] doc={} action={}", documentId, action);
    }
}
