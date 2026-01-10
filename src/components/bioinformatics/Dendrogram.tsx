import { useMemo } from "react";

export interface DendrogramNode {
  indices: number[];
  left?: DendrogramNode;
  right?: DendrogramNode;
  distance: number;
  x?: number;
  y?: number;
}

interface DendrogramProps {
  root: DendrogramNode | null;
  width: number;
  height: number;
  orientation: "horizontal" | "vertical" | "vertical-right";
  itemSize: number;
}

const getLeafPositions = (node: DendrogramNode, positions: Map<number, number>, currentPos: { value: number }, itemSize: number) => {
  if (!node.left && !node.right) {
    positions.set(node.indices[0], currentPos.value);
    currentPos.value += itemSize;
    return;
  }
  if (node.left) getLeafPositions(node.left, positions, currentPos, itemSize);
  if (node.right) getLeafPositions(node.right, positions, currentPos, itemSize);
};

const getNodePosition = (node: DendrogramNode, positions: Map<number, number>): number => {
  if (!node.left && !node.right) {
    return positions.get(node.indices[0]) || 0;
  }
  const leftPos = node.left ? getNodePosition(node.left, positions) : 0;
  const rightPos = node.right ? getNodePosition(node.right, positions) : 0;
  return (leftPos + rightPos) / 2;
};

const getMaxDistance = (node: DendrogramNode): number => {
  if (!node.left && !node.right) return 0;
  const leftMax = node.left ? getMaxDistance(node.left) : 0;
  const rightMax = node.right ? getMaxDistance(node.right) : 0;
  return Math.max(node.distance, leftMax, rightMax);
};

export const Dendrogram = ({ root, width, height, orientation, itemSize }: DendrogramProps) => {
  const paths = useMemo(() => {
    if (!root || (!root.left && !root.right)) return [];

    const leafPositions = new Map<number, number>();
    getLeafPositions(root, leafPositions, { value: itemSize / 2 }, itemSize);

    const maxDist = getMaxDistance(root);
    if (maxDist === 0) return [];

    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    const traverse = (node: DendrogramNode) => {
      if (!node.left || !node.right) return;

      const nodePos = getNodePosition(node, leafPositions);
      const leftPos = getNodePosition(node.left, leafPositions);
      const rightPos = getNodePosition(node.right, leafPositions);

      const leftDist = node.left.distance;
      const rightDist = node.right.distance;

      if (orientation === "horizontal") {
        // For top dendrogram (samples)
        const yNode = height - (node.distance / maxDist) * height;
        const yLeft = height - (leftDist / maxDist) * height;
        const yRight = height - (rightDist / maxDist) * height;

        // Horizontal line connecting children
        lines.push({ x1: leftPos, y1: yNode, x2: rightPos, y2: yNode });
        // Vertical lines to children
        lines.push({ x1: leftPos, y1: yNode, x2: leftPos, y2: yLeft });
        lines.push({ x1: rightPos, y1: yNode, x2: rightPos, y2: yRight });
      } else if (orientation === "vertical") {
        // For left dendrogram (genes)
        const xNode = width - (node.distance / maxDist) * width;
        const xLeft = width - (leftDist / maxDist) * width;
        const xRight = width - (rightDist / maxDist) * width;

        // Vertical line connecting children
        lines.push({ x1: xNode, y1: leftPos, x2: xNode, y2: rightPos });
        // Horizontal lines to children
        lines.push({ x1: xNode, y1: leftPos, x2: xLeft, y2: leftPos });
        lines.push({ x1: xNode, y1: rightPos, x2: xRight, y2: rightPos });
      } else {
        // vertical-right: For right dendrogram (genes) - mirrored
        const xNode = (node.distance / maxDist) * width;
        const xLeft = (leftDist / maxDist) * width;
        const xRight = (rightDist / maxDist) * width;

        // Vertical line connecting children
        lines.push({ x1: xNode, y1: leftPos, x2: xNode, y2: rightPos });
        // Horizontal lines to children
        lines.push({ x1: xNode, y1: leftPos, x2: xLeft, y2: leftPos });
        lines.push({ x1: xNode, y1: rightPos, x2: xRight, y2: rightPos });
      }

      traverse(node.left);
      traverse(node.right);
    };

    traverse(root);
    return lines;
  }, [root, width, height, orientation, itemSize]);

  if (!root || paths.length === 0) return null;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {paths.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={0.5}
          strokeOpacity={0.6}
        />
      ))}
    </svg>
  );
};
