/**
 * 预览交互模式下的可交互组件注册表（单一事实源）。
 * key 必须与前端组件库（COMPONENT_TEMPLATES）中的组件名一致。
 * kind:
 * - text   真实 <input> 覆盖，可输入文字（输入框 / 搜索框）
 * - toggle 点击切换，视觉由覆盖 props 驱动（开关）
 * - select 真实 <select> 覆盖，选择选项（下拉选择）
 * - radio  点击热区按行切换，选中行高亮（单选组）
 * - button 无需覆盖控件：pressed 视觉走 demoState，原型链接跳转由 HotspotLayer 提供
 */
export interface InteractionSpec {
  kind: 'text' | 'toggle' | 'select' | 'radio' | 'button'
  /** select / radio 的候选项 */
  options?: string[]
}

export const INTERACTIVE_COMPONENTS: Record<string, InteractionSpec> = {
  输入框: { kind: 'text' },
  搜索框: { kind: 'text' },
  开关: { kind: 'toggle' },
  下拉选择: { kind: 'select', options: ['选项一', '选项二', '选项三'] },
  单选组: { kind: 'radio', options: ['选项一', '选项二', '选项三'] },
  按钮: { kind: 'button' },
}
