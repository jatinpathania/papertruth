export function connectedComponents(ids = [], edges = []) {
  const adjacency = new Map();
  const link = (id) => {
    if (!adjacency.has(id)) adjacency.set(id, []);
    return adjacency.get(id);
  };

  for (const id of ids) link(id);
  for (const [a, b] of edges) {
    link(a).push(b);
    link(b).push(a);
  }

  const seen = new Set();
  const components = [];
  for (const id of adjacency.keys()) {
    if (seen.has(id)) continue;
    const members = [];
    const stack = [id];
    seen.add(id);
    while (stack.length > 0) {
      const current = stack.pop();
      members.push(current);
      for (const next of adjacency.get(current)) {
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    components.push(members);
  }
  return components;
}

export default connectedComponents;
