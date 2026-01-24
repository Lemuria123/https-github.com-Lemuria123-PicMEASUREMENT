# Mark & Weld - 焊接工序 (Welding Sequence) 模块需求规格说明书 (v1.1)

## 1. 模块定位与开发哲学
焊接工序模块属于系统的 **STAGE_PRODUCTION (生产准备阶段)**。
*   **核心哲学**: 严格增量开发。工序模块的逻辑必须与 `DXF Analysis` 模块物理隔离，互不干扰。
*   **核心目标**: 为已标记为 `isWeld` 的组件分配生产优先级（Sequence），并导出驱动激光振镜的顺序坐标。

## 2. 视觉表现与环境隔离 (Visual Isolation)
进入 `weld_sequence` 模式时，Canvas 渲染引擎应切换至专用的 `WeldSequenceLayer`。

### 2.1 环境压制
*   **背景层 (Background)**: 自动将所有非 `isWeld` 的组件及散乱 CAD 实体透明度调低至 `0.1`，仅保留轮廓参考。
*   **序号标签 (Sequence Labels)**: 
    *   在每个焊点中心上方渲染 `S{N}` 标签。
    *   标签背景颜色必须与组件定义颜色同步。

### 2.2 渲染优先级 (Priority Hierarchy)
从高到低排列：
1.  **Active Highlight (120)**: 鼠标直接悬停的点（Canvas 或侧边栏项），颜色：`#facc15` (黄色)。
2.  **Sequence Family (100)**: 悬停在工序组时，该组内所有焊点同步高亮。
3.  **Selected State (80)**: 侧边栏选中的单个焊点，视觉：组件色 + 白色中心光圈。
4.  **Default Weld Point (40)**: 标记为焊接但未被选中的点。
5.  **Suppressed Background (10)**: 非焊接相关的 CAD 线条。

## 3. 交互逻辑规范

### 3.1 独立状态机
*   工序模块拥有独立的 `hoveredSequenceId` 和 `selectedSequencePointId` 状态。
*   在 `DXF Analysis` 模式下的任何选区和高亮状态在进入 `Weld Sequence` 模式时应处于挂起或隐藏状态。

### 3.2 赋值交互
*   **Hover + Key**: 光标悬停在焊点上，直接按数字键 `0-9` 分配工序。
*   **Batch Assign**: 支持框选多个焊点并统一分配工序。

## 4. 数据一致性与导出

### 4.1 数据结构扩展
*   在 `DxfComponent` 中新增 `sequence: number` 字段。未分配的默认为 `0` 或 `null`。

### 4.2 导出规范 (Moved to Project Data)
*   **出口位置**: `Export CSV` 统一移动至侧边栏的 `Project Data` 模块。
*   **CSV 格式**: 必须包含 `Sequence` 字段，且导出的行顺序应严格按照 `Sequence` 数字升序排列。

## 5. 待讨论问题 (Q&A)
1.  **工序自动排序**: 是否需要“路径最短”自动排序算法？（当前版本暂定手动分配）。
2.  **层级显示**: 是否需要支持按工序层（Layer）显示/隐藏功能？
