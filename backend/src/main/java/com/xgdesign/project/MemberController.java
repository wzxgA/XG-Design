package com.xgdesign.project;

import com.xgdesign.common.ApiResponse;
import com.xgdesign.project.dto.InviteMemberRequest;
import com.xgdesign.project.dto.MemberDto;
import com.xgdesign.project.dto.UpdateMemberRoleRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents/{id}/members")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    /** 成员列表 */
    @GetMapping
    public ApiResponse<List<MemberDto>> list(@PathVariable UUID id) {
        return ApiResponse.ok(memberService.list(id));
    }

    /** 邀请（邮箱 → userId，角色 editor/viewer） */
    @PostMapping
    public ApiResponse<MemberDto> invite(@PathVariable UUID id,
                                         @Valid @RequestBody InviteMemberRequest request) {
        return ApiResponse.ok(memberService.invite(id, request.email(), request.role()));
    }

    /** 改角色（仅 editor/viewer） */
    @PutMapping("/{userId}")
    public ApiResponse<Void> updateRole(@PathVariable UUID id,
                                        @PathVariable UUID userId,
                                        @Valid @RequestBody UpdateMemberRoleRequest request) {
        memberService.updateRole(id, userId, request.role());
        return ApiResponse.ok();
    }

    /** 移除成员（owner 不可移除） */
    @DeleteMapping("/{userId}")
    public ApiResponse<Void> remove(@PathVariable UUID id, @PathVariable UUID userId) {
        memberService.remove(id, userId);
        return ApiResponse.ok();
    }
}
