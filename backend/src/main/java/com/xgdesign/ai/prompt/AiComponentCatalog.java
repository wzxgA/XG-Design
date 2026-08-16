package com.xgdesign.ai.prompt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

/**
 * 组件库目录：从 classpath 的 {@code ai/component-catalog.json} 加载前端可配置组件清单。
 * <p>
 * 用途：
 * <ol>
 *   <li>构建系统提示词中的「组件库」片段，让 LLM 知道可引用的组件名、props 与默认尺寸；</li>
 *   <li>校验 LLM 生成的 component 名是否真实存在（白名单）。</li>
 * </ol>
 * 加载失败时降级为空目录，不影响应用启动。
 */
@Component
public class AiComponentCatalog {

    /** 组件规格（与前端 COMPONENT_TEMPLATES 中有 render 函数的可配置组件一一对应） */
    public record ComponentSpec(String name, List<String> keywords, List<String> props,
                                int width, int height, String note) {}

    private final ObjectMapper objectMapper;
    private final Resource catalogResource;
    private volatile List<ComponentSpec> specs = List.of();
    private volatile boolean loaded = false;

    public AiComponentCatalog(ObjectMapper objectMapper,
                              @Value("classpath:ai/component-catalog.json") Resource catalogResource) {
        this.objectMapper = objectMapper;
        this.catalogResource = catalogResource;
    }

    /** 生成提示词「组件库」片段；目录为空时返回空字符串 */
    public String buildPromptSection() {
        List<ComponentSpec> list = ensureLoaded();
        if (list.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("## 组件库\n");
        sb.append("设计时优先使用以下组件，节点格式: {\"type\":\"group\",\"name\":\"组件名\",\"component\":\"组件名\",\"componentProps\":{...},\"x\":..,\"y\":..,\"width\":..,\"height\":..,\"children\":[]}\n");
        sb.append("component 名称必须严格使用下列清单，禁止自创；componentProps 只放需要的属性，其余用默认值；\n");
        sb.append("节点 width/height 必须与组件默认尺寸或 componentProps 中 width/height 一致。\n");
        for (ComponentSpec s : list) {
            sb.append("- ").append(s.name()).append(" (").append(s.width()).append("x").append(s.height()).append("): ");
            sb.append(s.note() == null || s.note().isBlank() ? "无描述" : s.note()).append("。");
            if (s.keywords() != null && !s.keywords().isEmpty()) {
                sb.append(" 关键词: ").append(String.join(", ", s.keywords())).append("。");
            }
            if (s.props() != null && !s.props().isEmpty()) {
                sb.append(" 可配置: ").append(String.join(", ", s.props()));
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    /** 组件名白名单校验 */
    public boolean isValidComponentName(String name) {
        if (name == null || name.isBlank()) return false;
        for (ComponentSpec s : ensureLoaded()) {
            if (s.name().equals(name)) return true;
        }
        return false;
    }

    /** 相近组件建议：按名称/关键词匹配度排序，返回最多 3 个；无匹配返回空列表 */
    public List<String> suggestSimilar(String name) {
        if (name == null || name.isBlank()) return List.of();
        String q = name.toLowerCase();
        return ensureLoaded().stream()
                .map(s -> Map.entry(s.name(), matchScore(s, q)))
                .filter(e -> e.getValue() > 0)
                .sorted((a, b) -> b.getValue() - a.getValue())
                .limit(3)
                .map(Map.Entry::getKey)
                .toList();
    }

    /** 相近组件建议文案：有匹配输出建议清单，否则输出全部组件名 */
    public String suggestSimilarText(String name) {
        List<String> sim = suggestSimilar(name);
        if (sim.isEmpty()) return componentNames();
        return String.join("、", sim);
    }

    /** 名称/关键词匹配得分 */
    private int matchScore(ComponentSpec s, String q) {
        String n = s.name().toLowerCase();
        if (n.equals(q)) return 100;
        if (n.contains(q) || q.contains(n)) return 80;
        for (String k : s.keywords()) {
            if (k == null || k.isBlank()) continue;
            String kk = k.toLowerCase();
            if (kk.equals(q)) return 90;
            if (kk.contains(q) || q.contains(kk)) return 60;
        }
        return 0;
    }

    /** 白名单组件名列表（逗号分隔），用于错误提示 */
    public String componentNames() {
        List<ComponentSpec> list = ensureLoaded();
        if (list.isEmpty()) return "（组件库未加载）";
        StringJoiner joiner = new StringJoiner(", ");
        for (ComponentSpec s : list) joiner.add(s.name());
        return joiner.toString();
    }

    private List<ComponentSpec> ensureLoaded() {
        if (!loaded) {
            synchronized (this) {
                if (!loaded) {
                    try {
                        specs = parse(objectMapper.readTree(catalogResource.getInputStream()));
                    } catch (IOException e) {
                        // 目录缺失/损坏时降级为空，仅记日志，不阻断启动
                        System.err.println("[AiComponentCatalog] 组件目录加载失败，AI 将不使用组件库: " + e.getMessage());
                        specs = List.of();
                    }
                    loaded = true;
                }
            }
        }
        return specs;
    }

    private List<ComponentSpec> parse(JsonNode root) {
        List<ComponentSpec> list = new ArrayList<>();
        JsonNode comps = root.get("components");
        if (comps != null && comps.isArray()) {
            for (JsonNode n : comps) {
                String name = n.path("name").asText(null);
                if (name == null || name.isBlank()) continue;
                List<String> keywords = textList(n.get("keywords"));
                List<String> props = textList(n.get("props"));
                list.add(new ComponentSpec(
                        name,
                        keywords,
                        props,
                        n.path("width").asInt(0),
                        n.path("height").asInt(0),
                        n.path("note").asText("")
                ));
            }
        }
        return list;
    }

    private List<String> textList(JsonNode node) {
        List<String> list = new ArrayList<>();
        if (node != null && node.isArray()) {
            for (JsonNode item : node) {
                if (item.isTextual()) list.add(item.asText());
            }
        }
        return list;
    }
}
