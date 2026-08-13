package com.xgdesign.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OperationLogRepository extends JpaRepository<OperationLogEntity, Long> {

    /** 文档操作日志，按时间倒序（历史版本接口） */
    List<OperationLogEntity> findByDocumentIdOrderByCreatedAtDesc(UUID documentId);
}
