package com.xgdesign.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ShareLinkRepository extends JpaRepository<ShareLinkEntity, UUID> {

    Optional<ShareLinkEntity> findByTokenAndActiveTrue(String token);

    Optional<ShareLinkEntity> findByDocumentIdAndActiveTrue(UUID documentId);
}
