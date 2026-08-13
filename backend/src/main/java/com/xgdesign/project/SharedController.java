package com.xgdesign.project;

import com.xgdesign.common.ApiResponse;
import com.xgdesign.project.dto.SaveDocumentRequest;
import com.xgdesign.project.dto.SaveResultDto;
import com.xgdesign.project.dto.SharedDocumentDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 分享链接入口：token 本身即访问凭证，匿名可访问。
 * Security 规则已放行 GET/PUT /api/shared/**。
 */
@RestController
@RequestMapping("/api/shared")
public class SharedController {

    private final DocumentService documentService;

    public SharedController(DocumentService documentService) {
        this.documentService = documentService;
    }

    /** 打开分享文档（view/edit 由返回的 permission 决定前端行为） */
    @GetMapping("/{token}")
    public ApiResponse<SharedDocumentDto> open(@PathVariable String token) {
        return ApiResponse.ok(documentService.openShared(token));
    }

    /** 通过 edit 分享链接保存（乐观锁，仅 permission=edit 可用） */
    @PutMapping("/{token}")
    public ApiResponse<SaveResultDto> save(@PathVariable String token,
                                           @Valid @RequestBody SaveDocumentRequest request) {
        return ApiResponse.ok(documentService.saveShared(token, request));
    }
}
