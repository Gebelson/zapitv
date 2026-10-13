export function calculateSkipProgress(currentTime: number, startTime: number, endTime: number): number {
  const duration = endTime - startTime;
  if (duration <= 0) return 0;
  const elapsed = currentTime - startTime;
  return Math.max(0, Math.min(1, elapsed / duration));
}

export function generatePillPath(width: number, height: number, strokeWidth: number = 2.5): string {
  if (width <= 0 || height <= 0) return '';
  const pad = strokeWidth / 2;
  const effR = Math.max(0, (height - 2 * pad) / 2);
  const straightW = Math.max(0, width - 2 * pad - 2 * effR);
  
  const topY = pad;
  const botY = height - pad;
  const leftX = pad + effR;
  const rightX = width - pad - effR;
  const midX = width / 2;

  // Path starts at top-center (midX, topY) and traces clockwise:
  // 1. Line to right corner start
  // 2. Arc 180 deg around right cap
  // 3. Line along bottom to left
  // 4. Arc 180 deg around left cap
  // 5. Line back to top center and close
  return [
    `M ${midX.toFixed(2)} ${topY.toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${topY.toFixed(2)}`,
    `A ${effR.toFixed(2)} ${effR.toFixed(2)} 0 0 1 ${rightX.toFixed(2)} ${botY.toFixed(2)}`,
    `L ${leftX.toFixed(2)} ${botY.toFixed(2)}`,
    `A ${effR.toFixed(2)} ${effR.toFixed(2)} 0 0 1 ${leftX.toFixed(2)} ${topY.toFixed(2)}`,
    'Z'
  ].join(' ');
}

// Test calculations
const test1 = calculateSkipProgress(10, 10, 100);
console.log('Progress at start (10s of [10, 100]):', test1); // 0

const test2 = calculateSkipProgress(55, 10, 100);
console.log('Progress at mid (55s of [10, 100]):', test2); // 0.5

const test3 = calculateSkipProgress(100, 10, 100);
console.log('Progress at end (100s of [10, 100]):', test3); // 1.0

const path1 = generatePillPath(180, 42);
console.log('Generated path (180x42):', path1);
