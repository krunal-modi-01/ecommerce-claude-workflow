---
name: design-system-conformance
description: >-
  Use this skill for ALL frontend/UI work in this project — building new pages,
  adding or editing components, wiring up forms, modals, tables, dashboards, or
  any task that produces or changes markup and styles. The design system is
  frozen, so new work must match the existing visual system rather than spin up
  a parallel one. Trigger this even when the user just says "add a settings
  page," "build a modal," "make this form," or "style this card" without
  mentioning the design system at all — conformance is the default, not an
  opt-in. Covers: reusing existing components and tokens, extending the
  component library in the same visual language when a primitive is missing,
  avoiding raw/unstyled HTML, and making sure every interactive element handles
  its loading, empty, error, and disabled states.
---

# Design System Conformance

The design system in this project is frozen. That means the visual language —
colors, typography, spacing, radii, shadows, and the set of components that
express them — has already been decided and lives in code. Your job when doing
UI work is to *speak that language*, not invent a dialect.

This matters because the entire value of a design system is consistency. Every
one-off color, ad-hoc spacing value, or inline-styled `<div>` that sneaks in
fragments the UI: it makes the product look subtly broken to users and creates
maintenance debt for whoever touches it next. A new screen should look like it
was always part of the app.

## Before you write any UI, read the system

Don't start from a blank mental model. Spend the first few minutes building an
inventory of what already exists so you reach for it instead of reinventing it:

- **Component library** — read `web/src/components/ui` (or this project's
  equivalent). Note every primitive that exists (Button, Input, Dialog, Card,
  Select, Toast, etc.), its props, and its variants. These are your building
  blocks.
- **Tokens and theme** — read `tailwind.config.*` and any global stylesheet or
  theme file (look for CSS custom properties / `:root` variables, a `tokens`
  file, or `theme.extend`). This is the *only* allowed source of colors, fonts,
  spacing, radii, and shadows.
- **Established patterns** — skim a couple of existing pages or feature
  components to see how primitives are composed in practice: how forms are laid
  out, how loading and error states are shown, how spacing rhythm is applied.

If the project layout differs from the paths above (e.g. tokens live in a CSS
file rather than the Tailwind config, or components are organized differently),
adapt — the principle is "find the frozen system and read it first," not the
exact file path.

## Core principles

**1. Reuse before you create.** Before writing a new component, search the
library for something that already does the job or comes close. Composing
existing primitives is almost always the right answer. Only when nothing fits
do you reach for principle 2.

**2. Extend in the same language, never one-off.** If a genuinely new primitive
is needed, add it to `web/src/components/ui` built from the existing tokens and
matching the conventions of its neighbors (same prop patterns, same variant
approach, same state handling). Do not drop a bespoke styled element inline in
a feature file — that's how parallel systems are born. A new primitive should be
indistinguishable in style from the ones already there.

**3. No raw or unstyled HTML for things the system already covers.** Reaching
for a bare `<button>`, `<input>`, or hand-rolled `<div>` "card" skips the
system's spacing, typography, focus rings, and accessibility behavior, so it
ends up looking and behaving off even when it seems fine in the happy path. Use
the styled primitive. (Plain semantic elements as structural scaffolding — a
`<section>`, `<ul>`, a layout `<div>` — are fine; the rule is about
re-implementing styled components that already exist.)

**4. Pull values only from tokens.** No new hex colors, font families, or
magic-number spacing/sizing values that aren't already in the theme. If you
catch yourself typing `#3b7df0` or `margin: 13px`, stop and find the token that
expresses the intent. Using an arbitrary Tailwind value like `mt-[13px]` or
`text-[#3b7df0]` is the same violation in a different costume.

**5. Every state, every time.** A component that only renders its happy path is
half-built. Every interactive or data-driven element must handle, in the style
already used elsewhere in the app:
- **loading** — skeletons or spinners consistent with existing ones
- **empty** — a real empty state, not a blank region
- **error** — a recoverable, on-brand error message
- **disabled** — proper disabled styling and non-interactivity

Missing states are the most common reason new UI feels broken to users, so treat
them as part of the definition of done, not a follow-up.

## When a token or primitive genuinely seems missing

Sometimes the design truly needs something the frozen system doesn't have. Since
the system is frozen, don't quietly invent it. Instead, surface it: tell the
user what's missing and why, propose the smallest in-language addition (a new
token value derived from the existing scale, or a new primitive built from
existing tokens), and let them decide. Treat genuinely-new values as the rare
exception that needs a human's sign-off, not a default you reach for under time
pressure.

## Before you finish, self-check

Run through this quickly against what you just built:

- Did I reuse existing components, or did I re-implement something the library
  already had?
- Is every color / font / spacing / radius / shadow value traceable to a token
  (no raw hex, no arbitrary `[…]` values)?
- Any new primitive added to the component library rather than inlined?
- Does every interactive element handle loading, empty, error, and disabled?
- Drop the new screen next to an existing one — does it look like the same app?

If any answer is "no," fix it before calling the work done.