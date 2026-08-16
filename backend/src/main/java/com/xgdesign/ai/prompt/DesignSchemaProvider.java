package com.xgdesign.ai.prompt;

/**
 * 提供 DesignDocument / LayerNode 的 JSON Schema 描述，用于系统提示词中。
 */
public final class DesignSchemaProvider {

    private DesignSchemaProvider() {}

    /**
     * 返回 LayerNode 的 JSON Schema 描述（简化版，用于提示词上下文）。
     */
    public static String getLayerSchemaDescription() {
        return """
            ## 图层数据结构
            generateDesign 工具的 layers 参数是一个 JSON 数组，每个元素结构如下:

            ```json
            {
              "id": "layer-1",
              "type": "frame",
              "name": "容器名称",
              "x": 0, "y": 0, "width": 400, "height": 600,
              "rotation": 0,
              "visible": true,
              "locked": false,
              "style": {
                "fill": "#ffffff",
                "opacity": 1,
                "cornerRadius": 12,
                "fontSize": 16,
                "fontWeight": 400,
                "color": "#333333",
                "textAlign": "center"
              },
              "content": "文本内容（仅 text 类型）",
              "imageUrl": "图片地址（仅 image 类型）",
              "children": []
            }
            ```

            注意:
            - style 中的属性都是可选的，按需填写
            - children 是递归的 LayerSpec 数组
            - content 仅对 text 类型有效
            - imageUrl 仅对 image 类型有效

            ### 组件节点（可选，仅 type=group 时使用）
            - component: 组件库中的组件名（严格使用组件库清单中的名称，如 "按钮"）
            - componentProps: 组件可配置属性对象，key 对应该组件的 props，如 {"text":"登录","bg":"#1890ff"}
            - 使用组件时 children 可留空 []
            - 节点的 width/height 必须与组件默认尺寸或 componentProps 中的 width/height 一致

            组件节点示例（搜索框/搜索场景必须用组件，不要手写矩形+文字）:
            ```json
            {
              "id": "search-1",
              "type": "group",
              "name": "搜索框",
              "component": "搜索框",
              "componentProps": {"placeholder": "搜索商品…", "width": 260},
              "x": 32, "y": 40, "width": 260, "height": 32,
              "children": []
            }
            ```

            顶层结构（重要）:
            - layers 数组顶层必须恰好一个节点，用 frame 或 group 包裹全部图层，禁止输出多个散开的顶层图层
            - 生成完整页面 → 顶层用 frame（画板），其 children 放所有图层
            - 生成组件/局部修改 → 顶层用 group，其 children 放图层

            editDesign 工具操作指令格式（operationsJson 是 JSON 数组，每条一个操作）:
            - update: {"op":"update","id":"目标图层id","patch":{"style":{"fill":"#ff0000"},"content":"新文字"}}
              patch 只放需要改的字段；style 是浅合并（只改指定属性）
            - delete: {"op":"delete","id":"目标图层id"}
            - replace: {"op":"replace","id":"目标图层id","node":{...完整图层节点...}}
              node 必须含 type；若为组件节点需带 component/componentProps；替换后保留原 id
            """;
    }
}
