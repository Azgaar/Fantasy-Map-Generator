// utils used for debugging (not in PROD) only
export function drawArrow([x1, y1]: TPoint, [x2, y2]: TPoint, width = 1, color = "#444"): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const normal = angle + Math.PI / 2;

  const [xMid, yMid] = [(x1 + x2) / 2, (y1 + y2) / 2];

  const [xLeft, yLeft] = [xMid + width * Math.cos(normal), yMid + width * Math.sin(normal)];
  const [xRight, yRight] = [xMid - width * Math.cos(normal), yMid - width * Math.sin(normal)];

  debug
    .append("path")
    .attr("d", `M${x1},${y1} L${xMid},${yMid} ${xLeft},${yLeft} ${x2},${y2} ${xRight},${yRight} ${xMid},${yMid} Z`)
    .attr("fill", color)
    .attr("stroke", color)
    .attr("stroke-width", width / 2);
}
