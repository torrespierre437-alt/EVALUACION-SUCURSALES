/**
 * Verifica lib/scoring.ts contra valores reales tomados de DASHBOARD EDIFICIOS.xlsx
 * (sucursal BJX). Ejecutar con: npx tsx scripts/verify-scoring.ts
 */
import { categoryScore, evaluationScore, punctualityScore, monthlyPunctuality, finalScore } from "../src/lib/scoring";

function assertClose(label: string, actual: number | null, expected: number, tol = 0.001) {
  if (actual === null || Math.abs(actual - expected) > tol) {
    console.error(`FAIL ${label}: got ${actual}, expected ${expected}`);
    process.exitCode = 1;
  } else {
    console.log(`OK   ${label}: ${actual}`);
  }
}

// LIMPIEZA de BJX: pesos 0.4/0.3/0.1/0.2, todos valor 1 -> score 1.0
assertClose(
  "categoryScore LIMPIEZA (BJX)",
  categoryScore([
    { weight: 0.4, value: 1 },
    { weight: 0.3, value: 1 },
    { weight: 0.1, value: 1 },
    { weight: 0.2, value: 1 },
  ]),
  1.0
);

// PINTURA de BJX: pesos 0.2/0.5/0.3, valores 1/1/0 -> (0.2+0.5)/1.0 = 0.7
assertClose(
  "categoryScore PINTURA (BJX)",
  categoryScore([
    { weight: 0.2, value: 1 },
    { weight: 0.5, value: 1 },
    { weight: 0.3, value: 0 },
  ]),
  0.7
);

// evaluationScore promedio de las 10 categorías de BJX -> PROMEDIO GRAL = 0.875
assertClose(
  "evaluationScore (BJX, PROMEDIO GRAL)",
  evaluationScore([1.0, 0.7, 0.7, 1.0, 0.75, 0.6, 1.0, 1.0, 1.0, 1.0]),
  0.875
);

// CCA seguimiento: 2 días de retraso -> 1 - 0.03*2 = 0.94
assertClose("punctualityScore (CCA seguimiento, 2 días tarde)", punctualityScore(2, true), 0.94);

// No enviado -> 0
assertClose("punctualityScore (no enviado)", punctualityScore(null, false), 0);

// BJX: puntualidad inicial 1.0, seguimiento 1.0 -> mensual 1.0
assertClose("monthlyPunctuality (BJX)", monthlyPunctuality(1.0, 1.0), 1.0);

// BJX: score de seguimiento 0.88, puntualidad mensual 1.0 -> final 0.94
assertClose("finalScore (BJX)", finalScore(0.88, 1.0), 0.94);

if (process.exitCode === 1) {
  console.error("\nAlgunas verificaciones fallaron.");
} else {
  console.log("\nTodas las fórmulas coinciden con el Excel de referencia.");
}
