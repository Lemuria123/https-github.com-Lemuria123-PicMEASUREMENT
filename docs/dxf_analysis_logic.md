# DXF 分析模块技术逻辑说明书 (v1.1)

## 1. 组 (Group/Component) 创建逻辑

系统的成组功能分为“手动框选成组”与“自动属性成组”两种模式，其核心目标是建立实体（Entity）与组件（Component）的归属关系。

### 1.1 精准成组结算 (Precise Group Settlement)
*   **选区判定**: 用户通过 `box_rect` 或 `box_poly` 定义一个感兴趣区域。该区域仅作为**成员过滤器**，用于识别被包围的散落实体和子组件。
*   **物理重心计算 (`computePreciseGeometry`)**: 
    *   **废弃逻辑**: 不再直接使用用户框选矩形的中心点作为组中心（避免操作偏差）。
    *   **现行逻辑**: 遍历选定成员，根据其实际物理属性计算几何中心：
        *   **圆形/圆弧**: 提取 `rawEntity.center` 坐标。
        *   **直线/多段线**: 计算所有顶点的算术平均值。
        *   **子组件**: 使用子组件已有的物理重心（Centroid）。
*   **边界聚合**: 组的 `bounds` (minX, maxX, minY, maxY) 同样通过遍历所有成员的物理极值点重新生成，确保包围盒完美贴合构件。

### 1.2 自动属性成组 (Auto Group)
*   **属性聚类**: 根据实体的类型（CIRCLE/LINE）和关键特征（直径/长度）进行分桶。
*   **种子生成**: 选取桶内的第一个实体作为“种子（Seed）”，利用 `computePreciseGeometry` 生成精准重心。

---

## 2. 响应式几何重算 (Reactive Geometry Recalculation)

为了确保组的“准星 (Crosshair)”始终指向其物理重心，系统实现了响应式重算机制。

*   **成员变动触发**: 当执行 `handleRemoveSingleEntity` (移除实体) 或 `handleRemoveChildGroup` (移除子组) 操作时，系统会立即触发重算流程。
*   **递归重算链**: 
    1.  更新当前组件的 `entityIds` 或 `childGroupIds` 列表。
    2.  调用 `computePreciseGeometry` 传入更新后的列表。
    3.  同步更新组件的 `centroid` 和 `bounds` 字段。
*   **视觉同步**: 由于 `useDxfOverlay` 渲染层直接绑定了组件的 `centroid`，重算后画布上的准星会立即平滑移动到新的物理中心位置。

---

## 3. 父子嵌套关系逻辑 (Parent-Child Hierarchy)

系统采用逻辑引用的方式建立树状结构，而非物理合并数据，以确保数据的可溯源性。

*   **数据结构**:
    *   **父级视角**: `DxfComponent` 包含 `childGroupIds: string[]`。
    *   **子级视角**: `DxfComponent` 包含 `parentGroupId: string`。
*   **实体归属保护 (Recursive Protection)**:
    *   在框选成组时，系统会递归收集被选中子组包含的所有实体 ID，确保新父组仅直接管理“散落实体”，避免实体的多重逻辑归属导致的数据冗余。

---

## 4. 自动匹配功能逻辑 (Find/Auto-Match)

自动匹配引擎旨在寻找与“种子组件”几何结构相似的所有实例，采用**旋转不变性几何比对算法**。

### 4.1 双锚点策略 (Two-Anchor Strategy)
1.  **主锚点 (Anchor S0)**: 选择几何特征最显著的实体（如最大圆）。
2.  **从锚点 (Anchor S1)**: 选择距离主锚点最远的实体。
3.  **几何指纹**: 计算 `S0` 与 `S1` 之间的物理距离 $D$ 和相对角度 $\theta_{ref}$。

### 4.2 匹配校验
*   **空间索引**: 使用 `Spatial Grid Hashing` 提升搜索效率。
*   **矩阵校验**: 应用旋转矩阵 $Rotate(\Delta\theta)$，校验种子内其余实体在目标位置是否存在对应的物理匹配项。

---

## 5. 交互渲染逻辑与优先级 (Interaction & Priority)

渲染引擎 `useDxfOverlay` 采用**基于优先级的 Painter's Algorithm**。

### 5.1 优先级定义 (从高到低)
1.  **Hovered (100-110)**: 鼠标悬停的对象（黄色高亮 `#facc15`）。
2.  **Selected Direct (95)**: 用户直接点击选中的组件（白色描边 `#ffffff`）。
3.  **Selected Deep (80)**: 选中组件的所有递归后代。
4.  **Selected Family (50)**: 选中组件的同族匹配项（Matches）。
5.  **Manual Points (20)**: 手动创建的点位（精密准星）。
6.  **Grouped Visible (10)**: 已成组的普通组件。

### 5.2 渲染策略
*   **动态层分离**: 将 `Hovered` 状态和 `Manual Points` 标记为动态实体，实时渲染复杂的 SVG 准星（Reticle）和十字辅助线。
*   **矢量缩放补偿 (`vector-effect: non-scaling-stroke`)**: 确保线条粗细在不同缩放倍数下视觉一致。