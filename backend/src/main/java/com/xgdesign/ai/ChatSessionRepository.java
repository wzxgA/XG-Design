package com.xgdesign.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, UUID> {

    List<ChatSessionEntity> findByUserIdOrderByLastMessageAtDesc(UUID userId);

    List<ChatSessionEntity> findByUserIdAndDocumentIdOrderByLastMessageAtDesc(UUID userId, UUID documentId);
}
