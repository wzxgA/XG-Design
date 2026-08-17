declare module 'polybooljs' {
  /** 多边形：regions 为多个闭合环，每个环是 [x, y] 数组 */
  export interface PolyBoolShape {
    regions: number[][][]
    inverted?: boolean
  }
  const PolyBool: {
    segments(poly: PolyBoolShape): unknown
    combine(segments1: unknown, segments2: unknown): unknown
    selectUnion(combined: unknown): unknown
    selectDifference(combined: unknown): unknown
    selectIntersect(combined: unknown): unknown
    selectXor(combined: unknown): unknown
    polygon(selected: unknown): PolyBoolShape
  }
  export default PolyBool
}
