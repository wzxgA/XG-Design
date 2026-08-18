package com.xgdesign.ai.prompt;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
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

    /** 组件属性定义（key/类型/默认值/范围/选项；来自前端 COMPONENT_TEMPLATES 的 props schema） */
    public record PropDef(String key, String label, String type, Object defaultValue,
                          Number min, Number max, List<String> options) {}

    /** 组件规格（静态目录仅含 props 字符串列表；请求 schema 提供完整 propDefs） */
    public record ComponentSpec(String name, List<String> keywords, List<String> props,
                                List<PropDef> propDefs, int width, int height, String note) {}

    private final ObjectMapper objectMapper;
    private final Resource catalogResource;
    private volatile List<ComponentSpec> specs = List.of();
    private volatile boolean loaded = false;

    public AiComponentCatalog(ObjectMapper objectMapper,
                              @Value("classpath:ai/component-catalog.json") Resource catalogResource) {
        this.objectMapper = objectMapper;
        this.catalogResource = catalogResource;
    }

    /** 生成提示词「组件库」片段（静态目录）；目录为空时返回空字符串 */
    public String buildPromptSection() {
        return buildPromptSection(ensureLoaded());
    }

    /** 基于指定组件列表生成提示词「组件库」片段；带 propDefs（请求 schema）时输出完整个性化 schema */
    public String buildPromptSection(List<ComponentSpec> list) {
        if (list == null || list.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("## 组件库\n");
        sb.append("设计时优先使用以下组件，节点格式: {\"type\":\"group\",\"name\":\"组件名\",\"component\":\"组件名\",\"componentProps\":{...},\"x\":..,\"y\":..,\"width\":..,\"height\":..,\"children\":[]}\n");
        sb.append("component 名称必须严格使用下列清单，禁止自创；componentProps 只放需要的属性，其余用默认值；\n");
        sb.append("组件视觉（背景色、圆角、描边、文字颜色、字号等）只能通过 componentProps 修改，组件节点的 style 与 children 会被渲染器忽略，不要修改它们；\n");
        sb.append("若 componentProps 含 width/height，节点 width/height 必须与之一致；组件交互状态可用节点 componentState 设置: default/hover/pressed/disabled/loading/error。\n");
        for (ComponentSpec s : list) {
            sb.append("- ").append(s.name()).append(": ");
            sb.append(s.note() == null || s.note().isBlank() ? "无描述" : s.note());
            if (s.keywords() != null && !s.keywords().isEmpty()) {
                sb.append("。关键词: ").append(String.join(", ", s.keywords()));
            }
            if (s.propDefs() != null && !s.propDefs().isEmpty()) {
                sb.append("。可配置:");
                for (PropDef d : s.propDefs()) {
                    sb.append(" ").append(propPrompt(d)).append(";");
                }
            } else if (s.props() != null && !s.props().isEmpty()) {
                sb.append("。可配置: ").append(String.join(", ", s.props()));
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    /** 单个 prop 的紧凑描述: key(类型 [默认x] [min~max] [可选a/b]) */
    private String propPrompt(PropDef d) {
        StringBuilder b = new StringBuilder(d.key()).append("(").append(d.type());
        if (d.defaultValue() != null) b.append(" 默认").append(d.defaultValue());
        if (d.min() != null || d.max() != null) {
            b.append(" ").append(d.min() == null ? "-∞" : d.min())
             .append("~").append(d.max() == null ? "∞" : d.max());
        }
        if (d.options() != null && !d.options().isEmpty()) {
            b.append(" 可选[").append(String.join("/", d.options())).append("]");
        }
        b.append(")");
        return b.toString();
    }

    /** 组件名白名单校验 */
    public boolean isValidComponentName(String name) {
        if (name == null || name.isBlank()) return false;
        for (ComponentSpec s : ensureLoaded()) {
            if (s.name().equals(name)) return true;
        }
        return false;
    }

    /**
     * 组件名白名单校验（请求 schema 感知）：优先在请求组件列表（含前端自定义组件）中匹配，
     * 未命中时回退静态目录。避免新增组件未同步静态目录时被误拒。
     */
    public boolean isValidComponentName(List<ComponentSpec> requestComponents, String name) {
        if (name == null || name.isBlank()) return false;
        if (requestComponents != null) {
            for (ComponentSpec s : requestComponents) {
                if (name.equals(s.name())) return true;
            }
        }
        return isValidComponentName(name);
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
                        null,
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

    // ==================== 请求 schema 支持（前端随请求发送的组件 props 契约） ====================

    /** 返回当前加载的静态组件列表 */
    public List<ComponentSpec> loadAll() {
        return ensureLoaded();
    }

    /** 解析前端随请求发送的组件 schema JSON，返回带完整 propDefs 的组件列表；缺失/非法时返回空列表（回退静态目录） */
    public List<ComponentSpec> parseSchema(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) return List.of();
        try {
            return parseRich(objectMapper.readTree(schemaJson));
        } catch (Exception e) {
            System.err.println("[AiComponentCatalog] 请求组件 schema 解析失败，回退静态目录: " + e.getMessage());
            return List.of();
        }
    }

    /** 在组件列表中按名称查找（供 props 校验使用） */
    public ComponentSpec findSpec(List<ComponentSpec> list, String name) {
        if (list == null || name == null) return null;
        for (ComponentSpec s : list) if (name.equals(s.name())) return s;
        return null;
    }

    /**
     * 校验组件节点的 componentProps：key 必须存在于 schema、select 取值必须合法、数值必须在范围内。
     * 仅当组件带 propDefs（请求 schema）时严格校验；无 schema 时不做 props 校验（兼容旧客户端）。
     * 校验失败抛 IllegalArgumentException，由上层转成 SSE error 事件让模型自愈。
     */
    public void validateComponentProps(ComponentSpec spec, JsonNode node) {
        if (spec == null || spec.propDefs() == null || spec.propDefs().isEmpty()) return;
        JsonNode props = node.get("componentProps");
        if (props == null || !props.isObject() || props.isEmpty()) return;
        Map<String, PropDef> defs = new HashMap<>();
        for (PropDef d : spec.propDefs()) defs.put(d.key(), d);
        java.util.Iterator<Map.Entry<String, JsonNode>> it = props.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            String key = e.getKey();
            JsonNode val = e.getValue();
            PropDef def = defs.get(key);
            if (def == null) {
                throw new IllegalArgumentException("组件 \"" + spec.name() + "\" 的 componentProps 包含未知属性 \"" + key
                        + "\"，可用属性: " + String.join(", ", defs.keySet()));
            }
            if ("select".equals(def.type()) && def.options() != null && !def.options().isEmpty()
                    && val.isTextual() && !def.options().contains(val.asText())) {
                throw new IllegalArgumentException("组件 \"" + spec.name() + "\" 的 " + key + " 取值 \"" + val.asText()
                        + "\" 非法，可选值: " + String.join(", ", def.options()));
            }
            if (("number".equals(def.type()) || "slider".equals(def.type())) && (def.min() != null || def.max() != null)) {
                Double v = numericValue(val);
                if (v != null) {
                    if (def.min() != null && v < def.min().doubleValue()) {
                        throw new IllegalArgumentException("组件 \"" + spec.name() + "\" 的 " + key + " 取值 " + v + " 小于最小值 " + def.min());
                    }
                    if (def.max() != null && v > def.max().doubleValue()) {
                        throw new IllegalArgumentException("组件 \"" + spec.name() + "\" 的 " + key + " 取值 " + v + " 大于最大值 " + def.max());
                    }
                }
            }
        }
    }

    private Double numericValue(JsonNode val) {
        if (val.isNumber()) return val.asDouble();
        if (val.isTextual()) {
            try {
                return Double.parseDouble(val.asText().trim());
            } catch (NumberFormatException ignored) {
                // 非数值字符串不校验范围
            }
        }
        return null;
    }

    /** 解析请求 schema（props 为对象数组，含 key/type/default/min/max/options） */
    private List<ComponentSpec> parseRich(JsonNode root) {
        List<ComponentSpec> list = new ArrayList<>();
        JsonNode comps = root.get("components");
        if (comps == null || !comps.isArray()) return list;
        for (JsonNode n : comps) {
            String name = n.path("name").asText(null);
            if (name == null || name.isBlank()) continue;
            List<String> keywords = textList(n.get("keywords"));
            List<PropDef> propDefs = parsePropDefs(n.get("props"));
            List<String> props = new ArrayList<>();
            for (PropDef d : propDefs) props.add(d.key());
            list.add(new ComponentSpec(name, keywords, props, propDefs,
                    n.path("width").asInt(0), n.path("height").asInt(0), n.path("note").asText("")));
        }
        return list;
    }

    private List<PropDef> parsePropDefs(JsonNode arr) {
        List<PropDef> out = new ArrayList<>();
        if (arr == null || !arr.isArray()) return out;
        for (JsonNode p : arr) {
            String key = p.path("key").asText(null);
            if (key == null || key.isBlank()) continue;
            out.add(new PropDef(
                    key,
                    p.path("label").asText(""),
                    p.path("type").asText("text"),
                    plainValue(p.get("default")),
                    p.has("min") ? p.get("min").numberValue() : null,
                    p.has("max") ? p.get("max").numberValue() : null,
                    textList(p.get("options"))
            ));
        }
        return out;
    }

    /** JsonNode → 适合提示词展示的普通值 */
    private Object plainValue(JsonNode v) {
        if (v == null || v.isNull()) return null;
        if (v.isTextual()) return v.asText();
        if (v.isNumber()) return v.numberValue();
        if (v.isBoolean()) return v.asBoolean();
        return v.toString();
    }
}
