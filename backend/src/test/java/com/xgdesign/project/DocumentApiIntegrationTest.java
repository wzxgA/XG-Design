package com.xgdesign.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 文档 API 集成测试（S3：JWT 认证 + 分享）：
 * 认证 → 创建/打开/保存/乐观锁 → 分享全链路（匿名 view/edit、重新分享失效、撤销）。
 * 依赖本地 PostgreSQL（容器 xg-design-db-1），使用独立库 xgdesign_test。
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DocumentApiIntegrationTest {

    private static final String MIN_CONTENT =
            "{\"id\":\"doc-test-1\",\"name\":\"测试文档\",\"pages\":[],\"activePageId\":\"page-1\"}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String token;

    @BeforeEach
    void setUp() throws Exception {
        jdbcTemplate.update("DELETE FROM operation_logs");
        jdbcTemplate.update("DELETE FROM share_links");
        jdbcTemplate.update("DELETE FROM document_members");
        jdbcTemplate.update("DELETE FROM documents");
        jdbcTemplate.update("DELETE FROM users");

        // 注册测试用户并持有 token
        String email = "test-" + System.nanoTime() + "@xgdesign.local";
        MvcResult reg = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\",\"displayName\":\"测试用户\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andReturn();
        this.token = objectMapper.readTree(body(reg)).path("data").path("token").asText();
    }

    /** MockMvc 默认按 ISO-8859-1 解码，需显式按 UTF-8 读取响应体 */
    private String body(MvcResult result) throws Exception {
        return new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    private String auth() {
        return "Bearer " + token;
    }

    private String createProject(String payload) throws Exception {
        String response = body(mockMvc.perform(post("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andReturn());
        return objectMapper.readTree(response).path("data").path("id").asText();
    }

    // ---------------------------------------------------------------- 认证

    @Test
    void registerLoginMe_flow() throws Exception {
        String email = "flow-" + System.nanoTime() + "@xgdesign.local";

        // 重复注册 → 40901
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\",\"displayName\":\"流程用户\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.token").isNotEmpty());
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\",\"displayName\":\"流程用户\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(40901));

        // 登录成功
        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.user.email").value(email))
                .andReturn();
        String loginToken = objectMapper.readTree(body(login)).path("data").path("token").asText();

        // 密码错误 → 40101
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"wrongpass1\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(40101));

        // me 恢复会话
        mockMvc.perform(get("/api/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + loginToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));
    }

    @Test
    void accessWithoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void anotherUser_cannotAccessDocument() throws Exception {
        String id = createProject("{\"name\":\"私有文档\"}");

        String email2 = "other-" + System.nanoTime() + "@xgdesign.local";
        MvcResult reg = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email2 + "\",\"password\":\"password123\",\"displayName\":\"他人\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token2 = objectMapper.readTree(body(reg)).path("data").path("token").asText();

        mockMvc.perform(get("/api/documents/{id}", id).header(HttpHeaders.AUTHORIZATION, "Bearer " + token2))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    // ---------------------------------------------------------------- 文档主链路

    @Test
    void createOpenSaveConflictArchive_fullFlow() throws Exception {
        // 创建项目
        String id = createProject("{\"name\":\"测试项目\"}");

        // 创建后 operation_logs 应有 create 记录
        Integer createLogs = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM operation_logs WHERE document_id = CAST(? AS uuid) AND action = 'create'",
                Integer.class, id);
        assertThat(createLogs).isEqualTo(1);

        // 打开文档：version 初始为 1，content 为模板结构
        MvcResult open = mockMvc.perform(get("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.meta.name").value("测试项目"))
                .andExpect(jsonPath("$.data.content.pages").isArray())
                .andReturn();
        JsonNode opened = objectMapper.readTree(body(open));
        assertThat(opened.path("data").path("content").has("activePageId")).isTrue();

        // 保存 v1 -> 200，version 变为 2
        String saveBody = "{\"name\":\"测试项目\",\"content\":" + objectMapper.writeValueAsString(MIN_CONTENT) + ",\"version\":1}";
        mockMvc.perform(put("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.updatedAt").isNumber());

        // 用过期 version=1 再保存 -> 409 版本冲突
        mockMvc.perform(put("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("文档已被其他窗口修改，请刷新后重试"));

        // 复制 -> 新 id、名称带“副本”
        String dupBody = body(mockMvc.perform(post("/api/projects/{id}/duplicate", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("测试项目 副本"))
                .andReturn());
        String dupId = objectMapper.readTree(dupBody).path("data").path("id").asText();
        assertThat(dupId).isNotEqualTo(id);

        // 列表包含两个未归档项目
        mockMvc.perform(get("/api/projects").header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));

        // 归档原项目 -> 列表只剩副本
        mockMvc.perform(post("/api/projects/{id}/archive", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(true));
        mockMvc.perform(get("/api/projects").header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        // 取消归档 -> 恢复
        mockMvc.perform(post("/api/projects/{id}/unarchive", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(false));
        mockMvc.perform(get("/api/projects").header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void openMissingDocument_returns404() throws Exception {
        mockMvc.perform(get("/api/documents/{id}", "00000000-0000-0000-0000-000000000099")
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void saveInvalidContent_returns400() throws Exception {
        String id = createProject("{\"name\":\"x\"}");
        mockMvc.perform(put("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"content\":\"{\\\"id\\\":\\\"doc-1\\\"}\",\"version\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void createDefaultName_usesTemplateName() throws Exception {
        String response = body(mockMvc.perform(post("/api/projects")
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").isNotEmpty())
                .andReturn());
        assertThat(objectMapper.readTree(response).path("data").path("name").asText()).isNotBlank();
    }

    @Test
    void saveWithStaleVersionReturns409() throws Exception {
        String id = createProject("{\"name\":\"并发测试\"}");
        String saveBody = "{\"name\":\"并发测试\",\"content\":" + objectMapper.writeValueAsString(MIN_CONTENT) + ",\"version\":1}";
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(put("/api/documents/{id}", id)
                            .header(HttpHeaders.AUTHORIZATION, auth())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(saveBody))
                    .andExpect(i == 0 ? status().isOk() : status().isConflict())
                    .andExpect(i == 0 ? jsonPath("$.data.version").value(2) : jsonPath("$.code").value(409));
        }
    }

    // ---------------------------------------------------------------- 分享

    @Test
    void share_link_fullFlow() throws Exception {
        String id = createProject("{\"name\":\"分享测试\"}");

        // 创建 edit 分享（token 为 43 字符 Base64URL）
        MvcResult share = mockMvc.perform(put("/api/documents/{id}/share", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permission\":\"edit\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permission").value("edit"))
                .andReturn();
        String token1 = objectMapper.readTree(body(share)).path("data").path("token").asText();
        assertThat(token1).hasSize(43);

        // 匿名打开（无 token 也允许）
        mockMvc.perform(get("/api/shared/{token}", token1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permission").value("edit"))
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.meta.name").value("分享测试"));

        // 匿名编辑保存（乐观锁 v1 → v2）
        String saveBody = "{\"name\":\"分享测试\",\"content\":" + objectMapper.writeValueAsString(MIN_CONTENT) + ",\"version\":1}";
        mockMvc.perform(put("/api/shared/{token}", token1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2));

        // shared.edit 落库（user_id 可空）
        Integer sharedLogs = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM operation_logs WHERE document_id = CAST(? AS uuid) AND action = 'shared.edit'",
                Integer.class, id);
        assertThat(sharedLogs).isEqualTo(1);

        // 重新分享（view）→ 旧 token 立即失效
        mockMvc.perform(put("/api/documents/{id}/share", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"permission\":\"view\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.permission").value("view"));
        mockMvc.perform(get("/api/shared/{token}", token1))
                .andExpect(status().isNotFound());

        // 新 token 通过文档 meta.share 暴露
        MvcResult open = mockMvc.perform(get("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.meta.share.token").isNotEmpty())
                .andReturn();
        String token2 = objectMapper.readTree(body(open)).path("data").path("meta").path("share").path("token").asText();
        assertThat(token2).isNotEqualTo(token1);

        // view 链接匿名保存 → 403
        mockMvc.perform(put("/api/shared/{token}", token2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        // 撤销分享 → token 失效
        mockMvc.perform(delete("/api/documents/{id}/share", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0));
        mockMvc.perform(get("/api/shared/{token}", token2))
                .andExpect(status().isNotFound());
    }

    @Test
    void openInvalidShareToken_returns404() throws Exception {
        mockMvc.perform(get("/api/shared/not-a-real-token"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    // ---------------------------------------------------------------- S4 成员与历史

    @Test
    void member_inviteRoleRemove_fullFlow() throws Exception {
        String id = createProject("{\"name\":\"协作项目\"}");

        // 创建文档时自动写入 owner 成员
        Integer ownerRows = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM document_members WHERE document_id = CAST(? AS uuid) AND role = 'owner'",
                Integer.class, id);
        assertThat(ownerRows).isEqualTo(1);

        // 注册协作者
        String email2 = "member-" + System.nanoTime() + "@xgdesign.local";
        MvcResult reg = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email2 + "\",\"password\":\"password123\",\"displayName\":\"协作者\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data2 = objectMapper.readTree(body(reg)).path("data");
        String token2 = data2.path("token").asText();
        String uid2 = data2.path("user").path("id").asText();

        // 非成员访问成员列表 → 403
        mockMvc.perform(get("/api/documents/{id}/members", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2))
                .andExpect(status().isForbidden());

        // 邀请为 editor
        mockMvc.perform(post("/api/documents/{id}/members", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email2 + "\",\"role\":\"editor\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("editor"));

        // 成员列表返回 2 人
        mockMvc.perform(get("/api/documents/{id}/members", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));

        // editor 可保存
        String saveBody = "{\"name\":\"协作项目\",\"content\":" + objectMapper.writeValueAsString(MIN_CONTENT) + ",\"version\":1}";
        mockMvc.perform(put("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isOk());

        // 改角色 viewer → 保存 403、读取 200
        mockMvc.perform(put("/api/documents/{id}/members/{userId}", id, uid2)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"viewer\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(put("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2))
                .andExpect(status().isOk());

        // 历史接口：含 member.invite 与 member.role 日志
        String hist = body(mockMvc.perform(get("/api/documents/{id}/history", id)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk())
                .andReturn());
        var actions = objectMapper.readTree(hist).path("data").findValuesAsText("action");
        assertThat(actions).contains("create", "member.invite", "member.role");

        // 移除成员 → 协作者失去访问权
        mockMvc.perform(delete("/api/documents/{id}/members/{userId}", id, uid2)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/documents/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2))
                .andExpect(status().isForbidden());
    }

    @Test
    void member_ownerCannotBeRemovedOrDowngraded() throws Exception {
        String id = createProject("{\"name\":\"owner 保护\"}");

        // 尝试移除 owner（即当前用户）→ 403
        String ownerId = jdbcTemplate.queryForObject(
                "SELECT user_id FROM document_members WHERE document_id = CAST(? AS uuid) AND role = 'owner'",
                String.class, id);
        mockMvc.perform(delete("/api/documents/{id}/members/{userId}", id, ownerId)
                        .header(HttpHeaders.AUTHORIZATION, auth()))
                .andExpect(status().isForbidden());

        // 尝试把 owner 改为 viewer → 403
        mockMvc.perform(put("/api/documents/{id}/members/{userId}", id, ownerId)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"viewer\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void member_inviteUnknownEmail_returns404() throws Exception {
        String id = createProject("{\"name\":\"邀请失败\"}");
        mockMvc.perform(post("/api/documents/{id}/members", id)
                        .header(HttpHeaders.AUTHORIZATION, auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody@xgdesign.local\",\"role\":\"viewer\"}"))
                .andExpect(status().isNotFound());
    }
}
