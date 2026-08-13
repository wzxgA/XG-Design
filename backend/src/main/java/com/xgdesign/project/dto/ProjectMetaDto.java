package com.xgdesign.project.dto;

import java.util.UUID;

/**
 * 与前端 ProjectMeta 对齐：{ id, name, updatedAt, archived, share? }。
 * updatedAt 使用 epoch 毫秒（前端为 number）。
 */
public record ProjectMetaDto(UUID id, String name, long updatedAt, boolean archived, ShareInfoDto share) {
}
