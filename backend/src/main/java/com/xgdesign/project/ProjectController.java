package com.xgdesign.project;

import com.xgdesign.common.ApiResponse;
import com.xgdesign.project.dto.CreateProjectRequest;
import com.xgdesign.project.dto.ProjectMetaDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final DocumentService documentService;

    public ProjectController(DocumentService documentService) {
        this.documentService = documentService;
    }

    /** 项目列表（未归档） */
    @GetMapping
    public ApiResponse<List<ProjectMetaDto>> list() {
        return ApiResponse.ok(documentService.listProjects());
    }

    /** 新建项目（使用 starter 模板） */
    @PostMapping
    public ApiResponse<ProjectMetaDto> create(@Valid @RequestBody(required = false) CreateProjectRequest request) {
        return ApiResponse.ok(documentService.createProject(request));
    }

    /** 复制项目 */
    @PostMapping("/{id}/duplicate")
    public ApiResponse<ProjectMetaDto> duplicate(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.duplicate(id));
    }

    /** 归档项目 */
    @PostMapping("/{id}/archive")
    public ApiResponse<ProjectMetaDto> archive(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.setArchived(id, true));
    }

    /** 取消归档 */
    @PostMapping("/{id}/unarchive")
    public ApiResponse<ProjectMetaDto> unarchive(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.setArchived(id, false));
    }
}
