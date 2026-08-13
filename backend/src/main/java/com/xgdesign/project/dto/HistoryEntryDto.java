package com.xgdesign.project.dto;

import com.xgdesign.project.OperationLogEntity;

import java.util.UUID;

/**
 * 操作日志条目：{ id, userId, action, detail, createdAt }。
 * action 取值见 OperationLogEntity（create/update/duplicate/archive/…）。
 */
public record HistoryEntryDto(long id, UUID userId, String action, String detail, long createdAt) {

    public static HistoryEntryDto from(OperationLogEntity entity) {
        return new HistoryEntryDto(
                entity.getId(),
                entity.getUserId(),
                entity.getAction(),
                entity.getDetail(),
                entity.getCreatedAt().toEpochMilli());
    }
}
