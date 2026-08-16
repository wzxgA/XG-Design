package com.xgdesign.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/**
 * 用户 AI 配置仓储。
 */
public interface AiUserSettingsRepository extends JpaRepository<AiUserSettingsEntity, UUID> {

    Optional<AiUserSettingsEntity> findByUserId(UUID userId);
}
