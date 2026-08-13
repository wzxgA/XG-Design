package com.xgdesign.project.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 分享链接打开后的文档信息：{ meta, content, version, permission }。
 */
public record SharedDocumentDto(ProjectMetaDto meta, JsonNode content, long version, String permission) {
}
