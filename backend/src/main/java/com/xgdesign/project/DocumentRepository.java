package com.xgdesign.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {

    List<DocumentEntity> findByOwnerIdAndArchivedFalseOrderByUpdatedAtDesc(UUID ownerId);

    Optional<DocumentEntity> findByIdAndOwnerId(UUID id, UUID ownerId);

    /**
     * 乐观锁保存：仅当 version 匹配时执行更新并自增版本。
     * 使用原生 SQL 并显式 CAST 为 jsonb，避免 Hibernate JPQL 对 jsonb 列绑定失败。
     *
     * @return 受影响行数；0 表示版本冲突或文档不存在
     */
    @Modifying
    @Query(value = """
            UPDATE documents
               SET name = :name, content = CAST(:content AS jsonb), version = version + 1, updated_at = :now
             WHERE id = :id AND version = :version
            """, nativeQuery = true)
    int saveWithVersion(@Param("id") UUID id,
                        @Param("name") String name,
                        @Param("content") String content,
                        @Param("version") long version,
                        @Param("now") Instant now);

    /**
     * 复制/归档不涉及并发编辑，直接覆盖。
     */
    @Modifying
    @Query(value = """
            UPDATE documents
               SET archived = :archived, updated_at = :now
             WHERE id = :id AND owner_id = :ownerId
            """, nativeQuery = true)
    int setArchived(@Param("id") UUID id,
                    @Param("ownerId") UUID ownerId,
                    @Param("archived") boolean archived,
                    @Param("now") Instant now);
}
