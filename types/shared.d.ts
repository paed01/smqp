interface RoutingKeyPattern {
  test(routingKey: string): boolean;
}

export function generateId(): string;
export function getRoutingKeyPattern(pattern: string): RegExp | RoutingKeyPattern;
export function sortByPriority(a: number, b: number): number;
