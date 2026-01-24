# Mark & Weld - 焊接工序 (Welding Sequence) 模块需求规格说明书 (v1.2)

## 1. 模块定位与开发哲学
焊接工序模块属于系统的 **STAGE_PRODUCTION (生产准备阶段)**。
*   **核心哲学**: 严格增量开发。工序模块的逻辑必须与 `DXF Analysis` 模块物理隔离，互不干扰。
*   **核心目标**: 为已标记为 `isWeld` 的组件分配生产优先级（Sequence），并导出驱动激光振镜的顺序坐标。

## 2. 视觉表现与环境隔离 (Visual Isolation)
进入 `weld_sequence` 模式时，Canvas 渲染引擎应切换至专用的 `WeldSequenceLayer`。

### 2.1 环境压制
*   **背景层 (Background)**: 自动将所有非 `isWeld` 的组件及散乱 CAD 实体透明度调低至 **30% (0.3)**，保留环境参考。
*   **序号标签 (Sequence Labels)**: 
    *   在每个焊点中心上方渲染 `S{N}` 标签。
    *   标签背景颜色必须与组件定义颜色同步，文字为白色。

### 2.2 渲染优先级 (Priority Hierarchy)
从高到低排列：
1.  **Active Highlight (120)**: 鼠标直接悬停的点（Canvas 或侧边栏项），颜色：`#facc15` (黄色)。
2.  **Sequence Family (100)**: 侧边栏悬停于工序组（如 Sequence 1）时，该组内所有焊点同步高亮。
3.  **Selected State (80)**: 侧边栏选中的单个焊点，视觉：白色描边高亮。
4.  **Default Weld Point (40)**: 标记为焊接但未被选中的点，按原始组件色显示。
5.  **Suppressed Background (30)**: 非焊接相关的 CAD 线条，透明度 0.3。

## 3. 交互逻辑规范

### 3.1 独立状态机
*   工序模块拥有独立的 `hoveredSequenceNum` (工序编号悬停) 和 `selectedWeldPointId` (单个焊点选中) 状态。
*   在 `DXF Analysis` 模式下的任何选区和高亮状态在进入 `Weld Sequence` 模式时应处于挂起或隐藏状态。

### 3.2 分配交互
*   **快捷键分配**: 光标悬停在焊点上，直接按数字键 `0-9` 分配工序。
*   **一键清除**: 提供一键重置所有工序编号的功能。
*   **自动排序**: 按当前组件定义的自然顺序（或物理 Y 轴位置）批量分配序号。

## 4. 数据一致性与导出

### 4.1 数据结构扩展
*   在 `DxfComponent` 中新增 `sequence: number` 字段。未分配的默认为 `0`。

### 4.2 导出规范 (Moved to Project Data)
*   **出口位置**: `Export CSV` 统一移动至侧边栏的 `Project Data` 模块。
*   **CSV 格式**: 必须包含 `Sequence` 字段，且导出的行顺序应严格按照 `Sequence` 数字升序排列。