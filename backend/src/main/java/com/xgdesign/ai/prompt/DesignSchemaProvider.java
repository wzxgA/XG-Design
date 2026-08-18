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
            - 单个页面/组件：顶层输出 1 个 frame（完整页面）或 1 个 group（组件/局部修改），禁止输出多个散开的普通图层
            - 多个独立界面/页面（如"登录页+首页+注册页"）：顶层输出多个 frame，每个 frame 代表一个独立页面（画板），frame 的 name 用作页面名
            - 单页内多区块不要输出多个顶层 frame，应放在同一个 frame 的 children 内

             editDesign 工具操作指令格式（operationsJson 是 JSON 数组，每条一个操作）:
            - update: {"op":"update","id":"目标图层id","patch":{"style":{"fill":"#ff0000"},"content":"新文字"}}
              patch 只放需要改的字段；style 是浅合并（只改指定属性）
            - delete: {"op":"delete","id":"目标图层id"}
            - replace: {"op":"replace","id":"目标图层id","node":{...完整图层节点...}}
              node 必须含 type；若为组件节点需带 component/componentProps；替换后保留原 id
            - insert: {"op":"insert","parentId":"目标容器id","node":{...新图层节点...}}
              parentId 为页面内 frame/group 图层 id（推荐，品牌元素插进画板 children）或页面 id（page-xxx，加到该页顶层）；
              node 必须含 type 与 x/y/width/height（坐标相对父容器左上角）；新节点 id 由系统自动生成，无需提供

            generateDesign 的 linksJson 示例（多界面跳转）:
            ```json
            [{"sourceLayerId": "btn-login", "targetFrameId": "frame-home", "transition": "instant"}]
            ```

            linksJson 进阶示例（Smart Animate 列表项→详情，同名图层流动）:
            ```json
            [
              {
                "sourceLayerId": "item-1", "targetFrameId": "frame-detail", "transition": "smart",
                "duration": 500, "easing": "easeInOut"
              },
              {
                "sourceLayerId": "btn-profile", "targetFrameId": "frame-profile", "transition": "push",
                "direction": "left", "trigger": "afterDelay", "delay": 2000
              },
              {
                "sourceLayerId": "btn-open-dialog", "targetFrameId": "frame-dialog", "transition": "overlay",
                "overlay": {"position": "center", "backdrop": "rgba(0,0,0,0.45)", "closeOnBackdrop": true, "closeOnEsc": true}
              }
            ]
            ```
            注意：smart 要求源/目标 frame 中对应图层 name 完全一致。
            """;
    }
}
