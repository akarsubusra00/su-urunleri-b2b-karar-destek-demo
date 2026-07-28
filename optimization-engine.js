(function exposeOptimizationEngine(global) {
  "use strict";

  const EPSILON = 1e-7;

  function dayDifference(start, end) {
    const startDate = new Date(`${start}T12:00:00`);
    const endDate = new Date(`${end}T12:00:00`);
    return Math.max(0, Math.round((endDate - startDate) / 86400000));
  }

  function reservationMatches(resource, order) {
    if (resource.status !== "RESERVED") return true;
    const reservedFor = String(resource.reservedFor || "").toLocaleLowerCase("tr-TR");
    return reservedFor.includes(String(order.customer || "").toLocaleLowerCase("tr-TR")) ||
      reservedFor.includes(String(order.orderId || "").toLocaleLowerCase("tr-TR"));
  }

  function compatibility(resource, order) {
    if (resource.product !== order.product || resource.capacity <= EPSILON) return null;
    const direct = resource.calibre === order.calibre;
    const alternative = order.altAllowed && resource.calibre === order.altCalibre;
    if (!direct && !alternative) return null;

    if (resource.type === "stock") {
      if (!reservationMatches(resource, order)) return null;
      if (resource.date > order.planned || order.planned > resource.expiry) return null;
      return { direct, alternative, delayed: false, delayDays: 0 };
    }

    if (resource.date > order.latest) return null;
    const delayed = resource.date > order.planned;
    if (delayed && !order.deliveryFlexible) return null;
    return { direct, alternative, delayed, delayDays: delayed ? dayDifference(order.planned, resource.date) : 0 };
  }

  function allocationBenefit(resource, order, match) {
    // Her ek kg, kalemin karşılanma oranına katkısı üzerinden değerlendirilir.
    // Böylece yalnızca büyük siparişlere yüklenmek yerine kalemler arasında dengeli tahsis yapılır.
    const priorityWeight = { 1: 1, 2: 1.6, 3: 2.4 }[Number(order.priority)] || 1;
    const fulfilmentContribution = priorityWeight / Math.max(order.rawDemand, 1);
    let preference = 1;
    if (match.alternative) preference *= 0.88;
    if (resource.type === "extra") preference *= 0.94;
    if (match.delayed) preference *= Math.max(0.78, 1 - match.delayDays * 0.015);

    if (resource.type === "stock") {
      const stockAge = Math.max(0, dayDifference(resource.date, order.planned));
      // İç piyasa FIFO, ihracat ise mümkün olduğunca yeni parti tercihini küçük bir bağlayıcı puanla uygular.
      preference *= order.market === "İç piyasa"
        ? 1 + Math.min(stockAge, 10) * 0.001
        : 1 + Math.max(0, 10 - stockAge) * 0.001;
    }
    return fulfilmentContribution * preference;
  }

  function addEdge(graph, from, to, capacity, cost, metadata = null) {
    const forward = { to, reverse: graph[to].length, capacity, initialCapacity: capacity, cost, metadata };
    const reverse = { to: from, reverse: graph[from].length, capacity: 0, initialCapacity: 0, cost: -cost, metadata: null };
    graph[from].push(forward);
    graph[to].push(reverse);
    return forward;
  }

  function initialPotentials(graph, source) {
    const size = graph.length;
    const distance = Array(size).fill(Infinity);
    distance[source] = 0;
    for (let iteration = 0; iteration < size - 1; iteration += 1) {
      let changed = false;
      for (let node = 0; node < size; node += 1) {
        if (!Number.isFinite(distance[node])) continue;
        graph[node].forEach(edge => {
          if (edge.capacity <= EPSILON) return;
          const candidate = distance[node] + edge.cost;
          if (candidate + EPSILON < distance[edge.to]) {
            distance[edge.to] = candidate;
            changed = true;
          }
        });
      }
      if (!changed) break;
    }
    return distance.map(value => Number.isFinite(value) ? value : 0);
  }

  function heapPush(heap, item) {
    heap.push(item);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent][0] <= item[0]) break;
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = item;
  }

  function heapPop(heap) {
    if (!heap.length) return null;
    const root = heap[0];
    const tail = heap.pop();
    if (heap.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= heap.length) break;
        const child = right < heap.length && heap[right][0] < heap[left][0] ? right : left;
        if (heap[child][0] >= tail[0]) break;
        heap[index] = heap[child];
        index = child;
      }
      heap[index] = tail;
    }
    return root;
  }

  function shortestPath(graph, source, sink, potentials) {
    const size = graph.length;
    const distance = Array(size).fill(Infinity);
    const previousNode = Array(size).fill(-1);
    const previousEdge = Array(size).fill(-1);
    const heap = [];
    distance[source] = 0;
    heapPush(heap, [0, source]);

    while (heap.length) {
      const [currentDistance, node] = heapPop(heap);
      if (currentDistance > distance[node] + EPSILON) continue;
      if (node === sink) break;
      graph[node].forEach((edge, edgeIndex) => {
        if (edge.capacity <= EPSILON) return;
        const reducedCost = Math.max(0, edge.cost + potentials[node] - potentials[edge.to]);
        const candidate = currentDistance + reducedCost;
        if (candidate + EPSILON < distance[edge.to]) {
          distance[edge.to] = candidate;
          previousNode[edge.to] = node;
          previousEdge[edge.to] = edgeIndex;
          heapPush(heap, [candidate, edge.to]);
        }
      });
    }
    return { distance, previousNode, previousEdge, reachable: previousNode[sink] !== -1 };
  }

  function optimizeAllocation(resources, orders) {
    const source = 0;
    const resourceOffset = 1;
    const orderOffset = resourceOffset + resources.length;
    const sink = orderOffset + orders.length;
    const graph = Array.from({ length: sink + 1 }, () => []);
    const allocationEdges = [];

    resources.forEach((resource, resourceIndex) => {
      addEdge(graph, source, resourceOffset + resourceIndex, resource.capacity, 0);
    });
    orders.forEach((order, orderIndex) => {
      addEdge(graph, orderOffset + orderIndex, sink, order.rawDemand, 0);
    });

    resources.forEach((resource, resourceIndex) => {
      orders.forEach((order, orderIndex) => {
        const match = compatibility(resource, order);
        if (!match) return;
        const benefit = allocationBenefit(resource, order, match);
        const metadata = { resourceIndex, orderIndex, benefit, ...match };
        const edge = addEdge(
          graph,
          resourceOffset + resourceIndex,
          orderOffset + orderIndex,
          Math.min(resource.capacity, order.rawDemand),
          -benefit,
          metadata
        );
        allocationEdges.push(edge);
      });
    });

    let totalFlow = 0;
    let totalCost = 0;
    const potentials = initialPotentials(graph, source);
    while (true) {
      const path = shortestPath(graph, source, sink, potentials);
      if (!path.reachable) break;
      for (let node = 0; node < graph.length; node += 1) {
        if (Number.isFinite(path.distance[node])) potentials[node] += path.distance[node];
      }
      let amount = Infinity;
      let pathCost = 0;
      for (let node = sink; node !== source; node = path.previousNode[node]) {
        const edge = graph[path.previousNode[node]][path.previousEdge[node]];
        amount = Math.min(amount, edge.capacity);
        pathCost += edge.cost;
      }
      if (!Number.isFinite(amount) || amount <= EPSILON || pathCost >= -EPSILON) break;
      for (let node = sink; node !== source; node = path.previousNode[node]) {
        const previous = path.previousNode[node];
        const edge = graph[previous][path.previousEdge[node]];
        edge.capacity -= amount;
        graph[node][edge.reverse].capacity += amount;
      }
      totalFlow += amount;
      totalCost += amount * pathCost;
    }

    const allocations = allocationEdges.map(edge => ({
      ...edge.metadata,
      amount: Math.max(0, edge.initialCapacity - edge.capacity)
    })).filter(allocation => allocation.amount > EPSILON);

    return { allocations, totalFlow, objectiveValue: -totalCost };
  }

  global.OptimizationEngine = Object.freeze({
    EPSILON,
    compatibility,
    allocationBenefit,
    optimizeAllocation
  });
})(typeof window !== "undefined" ? window : globalThis);
