/// <reference types="react" />

// Augments React's JSX intrinsic elements to include our Lit web components.
// Merges into the global JSX namespace used by TypeScript's JSX checker.

// Vite raw imports: import foo from "./file.md?raw"
declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "a2ui-surface": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
          jsonl?: string | null;
        };
      }
    }
  }
}

export {};
