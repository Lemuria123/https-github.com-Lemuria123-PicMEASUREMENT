
# DXF 分析模块技术逻辑说明书 (v1.3)

## 1. 组 (Group/Component) 创建逻辑

系统的成组功能分为“手动框选成组”与“自动属性成组”两种模式，其核心目标是建立实体（Entity）与组件（Component）的归属关系。

### 1.1 精准成组结算 (Precise Group Settlement)
*   **选区判定**: 用户通过 `box_rect` 或 `box_poly` 定义一个感兴趣区域。该区域仅作为**成员过滤器**，用于识别被包围的散落实体和子组件。
*   **物理重心计算 (`computePreciseGeometry`)**: 
    *   **现行逻辑**: 遍历选定成员，根据其实际物理属性计算几何中心。
*   **边界聚合**: 组的 `bounds` 同样通过遍历所有成员的物理极值点重新生成。

---

## 2. 响应式几何重算 (Reactive Geometry Recalculation)

为了确保组的“准星 (Crosshair)”始终指向其物理重心，系统实现了响应式重算机制。

*   **递归重算链**: 
    1.  更新当前组件的成员列表。
    2.  调用 `computePreciseGeometry`。
    3.  同步更新组件的 `centroid` 和 `bounds`。

---

## 3. 父子嵌套关系逻辑 (Parent-Child Hierarchy)

系统采用逻辑引用的方式建立树状结构，而非物理合并数据。

*   **数据结构**:
    *   **父级视角**: `DxfComponent` 包含 `childGroupIds: string[]`。
    *   **子级视角**: `DxfComponent` 包含 `parentGroupId: string`。

---

## 4. 自动匹配功能逻辑 (Find/Auto-Match)

自动匹配引擎采用**旋转不变性几何比对算法**。

### 4.1 双锚点策略 (Two-Anchor Strategy)
1.  **主锚点 (Anchor S0)**: 特征最显著实体。
2.  **从锚点 (Anchor S1)**: 最远距离实体。

---

## 5. 交互拾取与渲染优先级 (Hit-Testing & Priority)

### 5.1 语义化加权拾取 (Weighted Hit-Testing)
拾取算法根据业务权重进行得分修正：
1.  **已选中家族**: `-1e15` (最高)。
2.  **焊接组件**: `-1e12`。
3.  **标记组件**: `-1e9`。
4.  **普通组件**: 原始几何得分。

### 5.2 渲染优先级与视觉分层 (Z-Index & Visual Logic)
渲染引擎采用基于优先级的 Painter's Algorithm：

1.  **Hovered (100-110)**: 悬停对象（黄色高亮 `#facc15`）。
2.  **Selected Direct (95)**: 用户直接点击的 **Seed**（白色描边 `#ffffff`）。
3.  **Selected Deep (80)**: 选中组件的 **递归后代**。
    *   **定义**: 当选中一个父容器（如装配体）时，其内部嵌套的所有子组、子零件及底层线段。
    *   **目的**: 确保“牵一发而动全身”的视觉反馈，让用户感知到操作影响的完整物理边界。
4.  **Selected Family (50)**: 选中组件的 **同族匹配项 (Matches)**。
5.  **Weld Class (30)** / **Mark Class (20)**: 标记业务属性的普通组件。

### 5.3 Seed 与 Matches 的区分逻辑
当在 UI 选中一个 Group 时，系统执行“家族式联动”：
*   **逻辑上**: Seed 和所有 Matches 均标记为 `isSelected: true`，进入高亮层级。
*   **视觉上**: 
    *   **Seed (主角)**: 变为纯白色。这是“定义源”，用于明确当前的编辑或查找基准。
    *   **Matches (配角)**: 保持组件原始颜色（如绿色）。它们会应用加粗描边和外发光阴影，以区别于背景背景，但不会变白，从而避免全图视觉过载。

---

## 6. 视觉效果补偿

### 6.1 矢量缩放补偿 (`vector-effect: non-scaling-stroke`)
确保所有 CAD 路径在不同缩放倍数下保持 1px 的基础视觉厚度。

### 6.2 精密准星环 (Reticle)
手动创建的点位（`isManual: true`）使用专用的 SVG 准星渲染：
*   包含 **外层热区环 (Halo)**、**十字十字线 (Crosshair)** 和 **核心点 (Core)**。
*   旨在模拟激光打标系统的焦点准星。
