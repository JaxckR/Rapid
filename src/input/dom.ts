export function requireElement<TElement extends HTMLElement>(id: string): TElement {
  const element = document.querySelector<TElement>(`#${id}`);
  if (element === null) throw new Error(`Required element #${id} was not found.`);
  return element;
}
