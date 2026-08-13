package com.xgdesign.project;

import com.xgdesign.common.ApiResponse;
import com.xgdesign.project.dto.DocumentDto;
import com.xgdesign.project.dto.SaveDocumentRequest;
import com.xgdesign.project.dto.SaveResultDto;
import com.xgdesign.project.dto.ShareInfoDto;
import com.xgdesign.project.dto.UpdateShareRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    /** 打开文档 */
    @GetMapping("/{id}")
    public ApiResponse<DocumentDto> get(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.getDocument(id));
    }

    /** 保存文档（乐观锁：携带 version，冲突返回 409） */
    @PutMapping("/{id}")
    public ApiResponse<SaveResultDto> save(@PathVariable UUID id,
                                           @Valid @RequestBody SaveDocumentRequest request) {
        return ApiResponse.ok(documentService.saveDocument(id, request));
    }

    /** 创建/更新分享链接（已存在则旧链接失效，重新生成 token） */
    @PutMapping("/{id}/share")
    public ApiResponse<ShareInfoDto> updateShare(@PathVariable UUID id,
                                                 @Valid @RequestBody UpdateShareRequest request) {
        return ApiResponse.ok(documentService.createShare(id, request));
    }

    /** 撤销分享 */
    @DeleteMapping("/{id}/share")
    public ApiResponse<Void> revokeShare(@PathVariable UUID id) {
        documentService.revokeShare(id);
        return ApiResponse.ok();
    }
}
