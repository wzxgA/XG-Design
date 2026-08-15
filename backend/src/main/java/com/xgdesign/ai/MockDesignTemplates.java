package com.xgdesign.ai;

/**
 * Mock 模式预置设计模板（无 API Key 时返回模拟数据）。
 */
final class MockDesignTemplates {

    private MockDesignTemplates() {}

    /**
     * 根据用户消息匹配最接近的模板，返回 LayerNode[] JSON 字符串。
     */
    static String getTemplate(String message) {
        if (message == null) return GENERIC;
        String lower = message.toLowerCase();
        if (lower.contains("登录") || lower.contains("login") || lower.contains("signin")) {
            return LOGIN_PAGE;
        }
        if (lower.contains("仪表") || lower.contains("dashboard") || lower.contains("后台") || lower.contains("管理")) {
            return DASHBOARD;
        }
        if (lower.contains("卡片") || lower.contains("card")) {
            return CARD;
        }
        return GENERIC;
    }

    static String getDescription(String message) {
        if (message == null) return "AI 生成的设计";
        String lower = message.toLowerCase();
        if (lower.contains("登录") || lower.contains("login")) return "登录页面设计";
        if (lower.contains("dashboard") || lower.contains("仪表")) return "仪表盘设计";
        if (lower.contains("卡片") || lower.contains("card")) return "卡片设计";
        return "AI 生成的设计";
    }

    private static final String LOGIN_PAGE = """
            [
              {
                "id": "frame-login",
                "type": "frame",
                "name": "登录页面",
                "x": 420, "y": 80,
                "width": 600, "height": 740,
                "rotation": 0,
                "visible": true,
                "locked": false,
                "style": { "fill": "#ffffff", "opacity": 1, "cornerRadius": 16 },
                "children": [
                  {
                    "id": "text-title",
                    "type": "text",
                    "name": "标题",
                    "x": 200, "y": 60,
                    "width": 200, "height": 48,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 32, "fontWeight": 700, "color": "#1a1a1a", "textAlign": "center" },
                    "content": "欢迎登录",
                    "children": []
                  },
                  {
                    "id": "rect-email-bg",
                    "type": "rectangle",
                    "name": "邮箱输入框",
                    "x": 100, "y": 160,
                    "width": 400, "height": 48,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#f5f5f5", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  },
                  {
                    "id": "text-email",
                    "type": "text",
                    "name": "邮箱占位文字",
                    "x": 120, "y": 172,
                    "width": 200, "height": 24,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 15, "fontWeight": 400, "color": "#999999" },
                    "content": "请输入邮箱地址",
                    "children": []
                  },
                  {
                    "id": "rect-pwd-bg",
                    "type": "rectangle",
                    "name": "密码输入框",
                    "x": 100, "y": 230,
                    "width": 400, "height": 48,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#f5f5f5", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  },
                  {
                    "id": "text-pwd",
                    "type": "text",
                    "name": "密码占位文字",
                    "x": 120, "y": 242,
                    "width": 200, "height": 24,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 15, "fontWeight": 400, "color": "#999999" },
                    "content": "请输入密码",
                    "children": []
                  },
                  {
                    "id": "rect-btn",
                    "type": "rectangle",
                    "name": "登录按钮",
                    "x": 100, "y": 310,
                    "width": 400, "height": 48,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#1890ff", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  },
                  {
                    "id": "text-btn",
                    "type": "text",
                    "name": "按钮文字",
                    "x": 250, "y": 322,
                    "width": 100, "height": 24,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 16, "fontWeight": 600, "color": "#ffffff", "textAlign": "center" },
                    "content": "登录",
                    "children": []
                  }
                ]
              }
            ]""";

    private static final String DASHBOARD = """
            [
              {
                "id": "frame-dashboard",
                "type": "frame",
                "name": "仪表盘",
                "x": 120, "y": 50,
                "width": 1200, "height": 800,
                "rotation": 0,
                "visible": true,
                "locked": false,
                "style": { "fill": "#f0f2f5", "opacity": 1 },
                "children": [
                  {
                    "id": "rect-sidebar",
                    "type": "rectangle",
                    "name": "侧边栏",
                    "x": 0, "y": 0,
                    "width": 200, "height": 800,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#001529", "opacity": 1 },
                    "children": []
                  },
                  {
                    "id": "text-sidebar-title",
                    "type": "text",
                    "name": "侧边栏标题",
                    "x": 24, "y": 24,
                    "width": 152, "height": 32,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 18, "fontWeight": 700, "color": "#ffffff" },
                    "content": "管理后台",
                    "children": []
                  },
                  {
                    "id": "rect-card1",
                    "type": "rectangle",
                    "name": "数据卡片1",
                    "x": 230, "y": 30,
                    "width": 300, "height": 120,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#ffffff", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  },
                  {
                    "id": "text-card1-label",
                    "type": "text",
                    "name": "卡片1标签",
                    "x": 250, "y": 50,
                    "width": 200, "height": 20,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 14, "fontWeight": 400, "color": "#999999" },
                    "content": "总用户数",
                    "children": []
                  },
                  {
                    "id": "text-card1-value",
                    "type": "text",
                    "name": "卡片1数值",
                    "x": 250, "y": 80,
                    "width": 200, "height": 36,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 28, "fontWeight": 700, "color": "#1a1a1a" },
                    "content": "12,848",
                    "children": []
                  },
                  {
                    "id": "rect-card2",
                    "type": "rectangle",
                    "name": "数据卡片2",
                    "x": 550, "y": 30,
                    "width": 300, "height": 120,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#ffffff", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  },
                  {
                    "id": "rect-card3",
                    "type": "rectangle",
                    "name": "数据卡片3",
                    "x": 870, "y": 30,
                    "width": 300, "height": 120,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#ffffff", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  }
                ]
              }
            ]""";

    private static final String CARD = """
            [
              {
                "id": "frame-card",
                "type": "frame",
                "name": "卡片",
                "x": 500, "y": 200,
                "width": 360, "height": 280,
                "rotation": 0,
                "visible": true,
                "locked": false,
                "style": { "fill": "#ffffff", "opacity": 1, "cornerRadius": 12 },
                "children": [
                  {
                    "id": "rect-avatar",
                    "type": "rectangle",
                    "name": "头像",
                    "x": 20, "y": 20,
                    "width": 56, "height": 56,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#1890ff", "opacity": 1, "cornerRadius": 28 },
                    "children": []
                  },
                  {
                    "id": "text-name",
                    "type": "text",
                    "name": "姓名",
                    "x": 90, "y": 24,
                    "width": 120, "height": 24,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 16, "fontWeight": 600, "color": "#1a1a1a" },
                    "content": "用户名",
                    "children": []
                  },
                  {
                    "id": "text-subtitle",
                    "type": "text",
                    "name": "副标题",
                    "x": 90, "y": 50,
                    "width": 150, "height": 20,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 13, "fontWeight": 400, "color": "#999999" },
                    "content": "前端工程师",
                    "children": []
                  },
                  {
                    "id": "text-desc",
                    "type": "text",
                    "name": "描述",
                    "x": 20, "y": 100,
                    "width": 320, "height": 60,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 14, "fontWeight": 400, "color": "#666666" },
                    "content": "这是一段描述文字，用于展示卡片的详细内容信息。",
                    "children": []
                  }
                ]
              }
            ]""";

    private static final String GENERIC = """
            [
              {
                "id": "frame-canvas",
                "type": "frame",
                "name": "画板",
                "x": 320, "y": 80,
                "width": 800, "height": 600,
                "rotation": 0,
                "visible": true,
                "locked": false,
                "style": { "fill": "#ffffff", "opacity": 1, "cornerRadius": 8 },
                "children": [
                  {
                    "id": "text-heading",
                    "type": "text",
                    "name": "标题",
                    "x": 300, "y": 240,
                    "width": 200, "height": 40,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fontSize": 28, "fontWeight": 700, "color": "#1a1a1a", "textAlign": "center" },
                    "content": "设计标题",
                    "children": []
                  },
                  {
                    "id": "rect-body",
                    "type": "rectangle",
                    "name": "内容区",
                    "x": 100, "y": 300,
                    "width": 600, "height": 200,
                    "rotation": 0,
                    "visible": true,
                    "locked": false,
                    "style": { "fill": "#f5f7fa", "opacity": 1, "cornerRadius": 8 },
                    "children": []
                  }
                ]
              }
            ]""";
}
