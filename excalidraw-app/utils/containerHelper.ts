import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

export interface ContainerWrapOptions {
  title: string;
  originX?: number;
  originY?: number;
  locked?: boolean;
  createFrame?: boolean;
  createCard?: boolean;
  groupId?: string;
  paddingX?: number;
  paddingBottom?: number;
  headerHeight?: number;
}

export interface ContainerWrapResult {
  elements: ExcalidrawElementSkeleton[];
  frameId?: string;
  containerGroupId: string;
  containerCardId?: string;
  containerHeaderId?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

let nextId = 1;
const generateId = (prefix: string = "container") =>
  `${prefix}_${Date.now()}_${nextId++}`;

/**
 * Wraps any set of Excalidraw elements (Mermaid, AI wireframes, shapes)
 * inside a visually distinct, atomically grouped Container Frame.
 */
export function wrapInContainerFrame(
  childElements: ExcalidrawElementSkeleton[],
  options: ContainerWrapOptions,
): ContainerWrapResult {
  const isLocked = options.locked ?? false;
  const shouldCreateFrame = options.createFrame ?? true;
  const shouldCreateCard = options.createCard ?? true;
  const title = options.title || "AI Container";

  const containerGroupId = options.groupId || generateId("group_container");
  const frameId = generateId("frame_container");
  const containerCardId = generateId("container_card");
  const containerHeaderId = generateId("container_header");

  if (!childElements || childElements.length === 0) {
    return {
      elements: [],
      containerGroupId,
      bounds: { x: options.originX ?? 100, y: options.originY ?? 100, width: 400, height: 200 },
    };
  }

  // 1. Calculate raw bounding box of children
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of childElements) {
    const elX = el.x ?? 0;
    const elY = el.y ?? 0;
    const elW = (el as any).width ?? 0;
    const elH = (el as any).height ?? 0;
    minX = Math.min(minX, elX);
    minY = Math.min(minY, elY);
    maxX = Math.max(maxX, elX + elW);
    maxY = Math.max(maxY, elY + elH);
  }

  const rawWidth = Math.max(maxX - minX, 100);
  const rawHeight = Math.max(maxY - minY, 60);

  const PADDING_X = options.paddingX ?? 24;
  const HEADER_HEIGHT = options.headerHeight ?? 36;
  const PADDING_TOP = HEADER_HEIGHT + 16;
  const PADDING_BOTTOM = options.paddingBottom ?? 24;

  // Determine target placement origin
  const targetX = options.originX !== undefined ? options.originX : minX - PADDING_X;
  const targetY = options.originY !== undefined ? options.originY : minY - PADDING_TOP;

  // Offset children if originX/Y specified and differs from current bounding box
  const shiftX = options.originX !== undefined ? targetX + PADDING_X - minX : 0;
  const shiftY = options.originY !== undefined ? targetY + PADDING_TOP - minY : 0;

  const containerWidth = Math.round(rawWidth + PADDING_X * 2);
  const containerHeight = Math.round(rawHeight + PADDING_TOP + PADDING_BOTTOM);

  const updatedChildren: ExcalidrawElementSkeleton[] = childElements.map((el) => {
    const existingGroupIds = Array.isArray(el.groupIds) ? el.groupIds : [];
    return {
      ...el,
      x: Math.round((el.x ?? 0) + shiftX),
      y: Math.round((el.y ?? 0) + shiftY),
      locked: isLocked,
      groupIds: [...existingGroupIds, containerGroupId],
      ...(shouldCreateFrame ? { frameId } : {}),
    } as unknown as ExcalidrawElementSkeleton;
  });

  const childIds: string[] = [
    ...(shouldCreateCard ? [containerCardId, containerHeaderId] : []),
    ...(updatedChildren.map((el) => el.id).filter(Boolean) as string[]),
  ];

  const containerCard: ExcalidrawElementSkeleton = {
    type: "rectangle",
    id: containerCardId,
    x: Math.round(targetX),
    y: Math.round(targetY),
    width: containerWidth,
    height: containerHeight,
    backgroundColor: "#ffffff",
    strokeColor: "#94a3b8", // crisp slate-400 border
    strokeWidth: 2,
    strokeStyle: "solid",
    roundness: { type: 3 },
    roughness: 0,
    fillStyle: "solid",
    opacity: 100,
    locked: isLocked,
    groupIds: [containerGroupId],
    frameId: shouldCreateFrame ? frameId : undefined,
    customData: { isContainerCard: true },
  };

  const containerHeader: ExcalidrawElementSkeleton = {
    type: "rectangle",
    id: containerHeaderId,
    x: Math.round(targetX),
    y: Math.round(targetY),
    width: containerWidth,
    height: HEADER_HEIGHT,
    backgroundColor: "#f8fafc",
    strokeColor: "#cbd5e1",
    strokeWidth: 1,
    strokeStyle: "solid",
    roundness: { type: 3 },
    roughness: 0,
    fillStyle: "solid",
    opacity: 100,
    locked: isLocked,
    groupIds: [containerGroupId],
    frameId: shouldCreateFrame ? frameId : undefined,
    customData: { isContainerHeader: true },
    label: {
      text: `📦 [Container] ${title}${isLocked ? " 🔒" : ""}`,
      fontSize: 13,
      fontFamily: 2,
      strokeColor: "#1e293b",
      textAlign: "left",
      verticalAlign: "middle",
    },
  };

  const frameElement: ExcalidrawElementSkeleton = {
    type: "frame",
    id: frameId,
    name: `📦 ${title}`,
    children: childIds,
    x: Math.round(targetX),
    y: Math.round(targetY),
    width: containerWidth,
    height: containerHeight,
    locked: isLocked,
    groupIds: [containerGroupId],
  } as any;

  const resultElements: ExcalidrawElementSkeleton[] = [];
  if (shouldCreateFrame) {
    resultElements.push(frameElement);
  }
  if (shouldCreateCard) {
    resultElements.push(containerCard);
    resultElements.push(containerHeader);
  }
  resultElements.push(...updatedChildren);

  return {
    elements: resultElements,
    frameId: shouldCreateFrame ? frameId : undefined,
    containerGroupId,
    containerCardId: shouldCreateCard ? containerCardId : undefined,
    containerHeaderId: shouldCreateCard ? containerHeaderId : undefined,
    bounds: {
      x: Math.round(targetX),
      y: Math.round(targetY),
      width: containerWidth,
      height: containerHeight,
    },
  };
}
