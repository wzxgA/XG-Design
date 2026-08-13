package com.xgdesign.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentMemberRepository extends JpaRepository<DocumentMemberEntity, UUID> {

    List<DocumentMemberEntity> findByDocumentId(UUID documentId);

    Optional<DocumentMemberEntity> findByDocumentIdAndUserId(UUID documentId, UUID userId);

    boolean existsByDocumentIdAndUserId(UUID documentId, UUID userId);

    void deleteByDocumentIdAndUserId(UUID documentId, UUID userId);
}
