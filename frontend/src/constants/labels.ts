/** 业务中文标签（集中管理，避免多组件重复定义） */

/** 图层类型名 */
export const LAYER_KINDS = {
  rectangle: '矩形',
  text: '文本',
  frame: '画板',
  group: '分组',
  chart: '图表',
  path: '路径',
  image: '图片',
  comment: '评论',
} as const

/** 协作角色名 */
export const ROLE_LABELS = {
  owner: '拥有者',
  editor: '可编辑',
  viewer: '仅查看',
} as const

/** 保存/加载等状态文案 */
export const STATUS_TEXT = {
  saving: '保存中',
  saved: '已保存',
  failed: '保存失败',
  loading: '加载中',
  exporting: '导出中',
  importing: '导入中',
  copying: '已复制',
} as const
