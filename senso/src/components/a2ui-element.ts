/**
 * <a2ui-surface> — minimal A2UI JSONL renderer using Lit.
 * Handles surfaceUpdate protocol messages.
 * Components: text, card, textField, timeline, button.
 *
 * Uses manual customElement.define (no @customElement decorator)
 * and property getter/setter pattern (no @property decorator)
 * to be compatible with erasableSyntaxOnly tsconfig.
 */
import { LitElement, html, css } from "lit"

interface A2UIComponent {
  type: "text" | "card" | "textField" | "timeline" | "button"
  id: string
  value?: string
  title?: string
  label?: string
  children?: A2UIComponent[]
  items?: Array<{ label: string; description: string }>
  action?: string
}

function renderComponent(c: A2UIComponent): ReturnType<typeof html> {
  switch (c.type) {
    case "text":
      return html`<p class="a2ui-text">${c.value ?? ""}</p>`
    case "textField":
      return html`<div class="a2ui-field">
        <span class="a2ui-label">${c.label}</span>
        <span class="a2ui-value">${c.value}</span>
      </div>`
    case "card":
      return html`<div class="a2ui-card">
        <div class="a2ui-card-title">${c.title}</div>
        ${(c.children ?? []).map(renderComponent)}
      </div>`
    case "timeline":
      return html`<ol class="a2ui-timeline">
        ${(c.items ?? []).map(
          (item) => html`<li><strong>${item.label}</strong> — ${item.description}</li>`,
        )}
      </ol>`
    case "button":
      return html`<button class="a2ui-button">${c.label}</button>`
    default:
      return html``
  }
}

export class A2UISurfaceElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: 0.85rem;
    }
    .a2ui-card {
      border: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
    }
    .a2ui-card-title {
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .a2ui-field {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid hsl(var(--border, 214.3 31.8% 91.4%) / 0.5);
    }
    .a2ui-label {
      color: hsl(var(--muted-foreground, 215.4 16.3% 46.9%));
    }
    .a2ui-value {
      font-weight: 500;
    }
    .a2ui-text {
      margin: 4px 0;
    }
    .a2ui-timeline {
      padding-left: 1.2em;
      margin: 4px 0;
    }
    .a2ui-timeline li {
      margin-bottom: 4px;
    }
    .a2ui-button {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid hsl(var(--border, 214.3 31.8% 91.4%));
      background: transparent;
      cursor: pointer;
      font-size: 0.85rem;
    }
  `

  // Manual reactive property (no @property decorator, compatible with erasableSyntaxOnly)
  private _jsonl: string | null = null

  get jsonl(): string | null {
    return this._jsonl
  }

  set jsonl(value: string | null) {
    const old = this._jsonl
    this._jsonl = value
    this.requestUpdate("jsonl", old)
  }

  render() {
    if (!this._jsonl) return html``
    try {
      const lines = this._jsonl
        .trim()
        .split("\n")
        .filter(Boolean)
      let surface: A2UIComponent | null = null
      for (const line of lines) {
        const msg = JSON.parse(line) as { type: string; surface?: A2UIComponent }
        if (msg.type === "surfaceUpdate" && msg.surface) {
          surface = msg.surface
        }
      }
      if (!surface) return html``
      return renderComponent(surface)
    } catch {
      return html``
    }
  }
}

// Register the custom element (no @customElement decorator needed)
if (!customElements.get("a2ui-surface")) {
  customElements.define("a2ui-surface", A2UISurfaceElement)
}
