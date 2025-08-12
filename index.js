// index.js
const express = require("express");
const app = express();
app.use(express.json());

// Assumptions (adjust if needed)
const WAREHOUSES = {
  C1: ["A", "B", "C"],
  C2: ["D", "E", "F"],
  C3: ["G", "H", "I"]
};

const DISTANCES = {
  C1: { L1: 10, C2: 15, C3: 20 },
  C2: { L1: 8, C1: 15, C3: 12 },
  C3: { L1: 5, C1: 20, C2: 12 },
  L1: { C1: 10, C2: 8, C3: 5 }
};

const COST_PER_KM = 2;
const COST_PER_KG_PER_KM = 1;
const WEIGHT_PER_UNIT = 0.5;

// helper: which centers are required by the order
function getRequiredCenters(order) {
  const needed = new Set();
  for (const center in WAREHOUSES) {
    if (WAREHOUSES[center].some(p => (order[p] || 0) > 0)) {
      needed.add(center);
    }
  }
  return [...needed];
}

// calculate cost for a route (route is array of nodes, e.g. ["C1","L1","C3","L1"])
function calculateCost(route, order) {
  let totalCost = 0;
  let currentLoad = 0; // kg

  for (let i = 0; i < route.length - 1; i++) {
    const start = route[i];
    const end = route[i + 1];

    const distance = (DISTANCES[start] && DISTANCES[start][end]) ?? null;
    if (distance === null) {
      // invalid leg; return very large cost
      return Infinity;
    }

    // base running cost + cost depending on current load
    totalCost += distance * COST_PER_KM;
    totalCost += distance * currentLoad * COST_PER_KG_PER_KM;

    // If we reach a warehouse, pick up items (increase load)
    if (WAREHOUSES[end]) {
      for (const p of WAREHOUSES[end]) {
        currentLoad += (order[p] || 0) * WEIGHT_PER_UNIT;
      }
    }

    // If we reach L1, we deliver all current load (empty truck)
    if (end === "L1") {
      currentLoad = 0;
    }
  }

  return totalCost;
}

// small permutations helper
function permutations(arr) {
  if (arr.length === 0) return [[]];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

app.post("/min_cost", (req, res) => {
  const order = req.body || {};
  const centersNeeded = getRequiredCenters(order);

  if (centersNeeded.length === 0) {
    return res.json({ min_cost: 0, note: "No items requested." });
  }

  let best = Infinity;

  for (const start of centersNeeded) {
    const others = centersNeeded.filter(c => c !== start);
    const perms = permutations(others);
    // also handle the case where others is empty
    if (perms.length === 0) perms.push([]);

    for (const perm of perms) {
      // split point enumerates pickups before first delivery vs after
      for (let split = 0; split <= perm.length; split++) {
        const route = [start, ...perm.slice(0, split), "L1", ...perm.slice(split), "L1"];
        const cost = calculateCost(route, order);
        if (cost < best) best = cost;
      }
    }
  }

  if (!isFinite(best)) return res.status(400).json({ error: "Could not find a valid route." });
  return res.json({ min_cost: Math.round(best) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
