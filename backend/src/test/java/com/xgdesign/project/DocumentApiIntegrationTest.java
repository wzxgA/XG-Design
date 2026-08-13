package com.xgdesign.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 文档 API 集成测试：覆盖 创建 → 打开 → 保存 → 乐观锁 409 → 复制/归档 链路。
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

    @BeforeEach
    void clean() {
        jdbcTemplate.update("DELETE FROM operation_logs");
        jdbcTemplate.update("DELETE FROM share_links");
        jdbcTemplate.update("DELETE FROM document_members");
        jdbcTemplate.update("DELETE FROM documents");
    }

    /** MockMvc 默认按 ISO-8859-1 解码，需显式按 UTF-8 读取响应体 */
    private String body(MvcResult result) throws Exception {
        return new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    private String createProject(String payload) throws Exception {
        String response = body(mockMvc.perform(post("/api/projects")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andReturn());
        return objectMapper.readTree(response).path("data").path("id").asText();
    }

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
        MvcResult open = mockMvc.perform(get("/api/documents/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(1))
                .andExpect(jsonPath("$.data.meta.name").value("测试项目"))
                .andExpect(jsonPath("$.data.content.pages").isArray())
                .andReturn();
        JsonNode opened = objectMapper.readTree(body(open));
        assertThat(opened.path("data").path("content").has("activePageId")).isTrue();

        // 保存 v1 -> 200，version 变为 2（content 是 JSON 字符串字段）
        String saveBody = "{\"name\":\"测试项目\",\"content\":" + objectMapper.writeValueAsString(MIN_CONTENT) + ",\"version\":1}";
        mockMvc.perform(put("/api/documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.updatedAt").isNumber());

        // 用过期 version=1 再保存 -> 409 版本冲突
        mockMvc.perform(put("/api/documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("文档已被其他窗口修改，请刷新后重试"));

        // 复制 -> 新 id、名称带“副本”
        String dupBody = body(mockMvc.perform(post("/api/projects/{id}/duplicate", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("测试项目 副本"))
                .andReturn());
        String dupId = objectMapper.readTree(dupBody).path("data").path("id").asText();
        assertThat(dupId).isNotEqualTo(id);

        // 列表包含两个未归档项目
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));

        // 归档原项目 -> 列表只剩副本
        mockMvc.perform(post("/api/projects/{id}/archive", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(true));
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        // 取消归档 -> 恢复
        mockMvc.perform(post("/api/projects/{id}/unarchive", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(false));
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(2));
    }

    @Test
    void openMissingDocument_returns404() throws Exception {
        mockMvc.perform(get("/api/documents/{id}", "00000000-0000-0000-0000-000000000099"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    void saveInvalidContent_returns400() throws Exception {
        String id = createProject("{\"name\":\"x\"}");
        mockMvc.perform(put("/api/documents/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"content\":\"{\\\"id\\\":\\\"doc-1\\\"}\",\"version\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    @Test
    void createDefaultName_usesTemplateName() throws Exception {
        String body = body(mockMvc.perform(post("/api/projects")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").isNotEmpty())
                .andReturn());
        assertThat(objectMapper.readTree(body).path("data").path("name").asText()).isNotBlank();
    }

    @Test
    void saveWithStaleVersionReturns409() throws Exception {
        // 用相同 content 连续保存：第二次携带旧 version 必须 409
        String id = createProject("{\"name\":\"并发测试\"}");
        String saveBody = "{\"name\":\"并发测试\",\"content\":" + objectMapper.writeValueAsString(MIN_CONTENT) + ",\"version\":1}";
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(put("/api/documents/{id}", id)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(saveBody))
                    .andExpect(i == 0 ? status().isOk() : status().isConflict())
                    .andExpect(i == 0 ? jsonPath("$.data.version").value(2) : jsonPath("$.code").value(409));
        }
    }
}
