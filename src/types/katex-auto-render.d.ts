declare module 'katex/contrib/auto-render/auto-render' {
  export default function renderMathInElement(
    element: HTMLElement,
    options?: {
      delimiters?: { left: string; right: string; display: boolean }[];
      throwOnError?: boolean;
    }
  ): void;
}
