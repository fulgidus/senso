/// <reference types="react" />

// Augments React's JSX intrinsic elements to include our Lit web components.
// Merges into the global JSX namespace used by TypeScript's JSX checker.

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "a2ui-surface": React.DetailedHTMLProps<
          React.HTMLAttributes<HTMLElement>,
          HTMLElement
        > & { jsonl?: string | null }
      }
    }
  }
}

export {}
