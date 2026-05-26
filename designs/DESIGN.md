# Design System Specification: "Get in!"

## 1. Overview & Creative North Star: "The Academic Concierge"
The college application process is often perceived as a clinical, high-stress gauntlet. This design system rejects that narrative. Our Creative North Star is **"The Academic Concierge"**—an editorial-inspired, high-end experience that feels less like a database and more like a supportive, organized mentor.

To move beyond the "standard SaaS" look, we employ **Soft Volume Layouts**. Instead of rigid grids and boxes, we use intentional asymmetry and oversized typography to guide the student's eye. We replace harsh borders with tonal layering, creating a UI that feels like physical sheets of premium stationery floating in a sunlit room. It is sophisticated enough for a prestigious institution, yet warm enough for a seventeen-year-old.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
Our palette avoids the "primary blue" cliché of tech. We use a sophisticated interplay of deep sapphire (`on_surface`) and luminous creams (`secondary_container`).

### The "No-Line" Rule
**Explicit Instruction:** You are prohibited from using 1px solid borders to define sections. Layouts must be defined through background shifts. 
- *Instead of a border:* Place a `surface_container_lowest` card atop a `surface_container_low` background. 
- *Instead of a divider:* Use a `3` (1rem) or `4` (1.4rem) spacing gap to let white space do the work.

### Surface Hierarchy & Nesting
Treat the screen as a series of nested physical layers. 
- **Base Layer:** `surface` (#f8f9ff)
- **Content Zones:** `surface_container` (#e6eeff)
- **Interactive Cards:** `surface_container_lowest` (#ffffff) for maximum "lift" and clarity.

### The "Glass & Signature" Rule
For floating action buttons or navigation overlays, utilize **Glassmorphism**. Apply `surface_container_lowest` at 80% opacity with a 20px backdrop blur. For high-impact CTAs, use a **Signature Texture**: a linear gradient from `primary` (#0060ad) to `primary_container` (#9ac3ff) at a 135-degree angle to provide a sense of "moving forward."

---

## 3. Typography: Editorial Authority
We pair **Plus Jakarta Sans** (Display/Headline) for a modern, geometric confidence with **Be Vietnam Pro** (Body/Labels) for its approachable, humanistic legibility.

- **Display-LG (3.5rem):** Use for celebratory moments (e.g., "You're 80% there!"). Set with tight letter-spacing (-0.02em) to feel premium.
- **Headline-MD (1.75rem):** Use for screen titles. These should often be asymmetrical—left-aligned with significant top padding (`12` or `16` scale) to create an editorial "magazine" feel.
- **Body-LG (1rem):** Our standard for student essays and application details. Increase line-height to 1.6 for maximum breathability.
- **Label-MD (0.75rem):** Always in `on_surface_variant` (#466084) to maintain a soft hierarchy.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are too "tech-heavy." We use **Ambient Shadows** and **Tonal Stacking**.

- **The Layering Principle:** Depth is achieved by placing a lighter surface on a darker surface. A `surface_container_highest` (#d4e3ff) element feels "deeper" than a `surface_container_low` (#eff3ff) element.
- **Ambient Shadows:** Only use shadows on elements that literally "float" (like Modals or Floating Action Buttons). Use the `on_surface` color at 6% opacity with a blur of 32px and an offset of 8px. It should look like a glow, not a shadow.
- **The "Ghost Border" Fallback:** If a container requires an edge (e.g., on a white background), use `outline_variant` at 15% opacity. It should be felt, not seen.

---

## 5. Components: Friendly Sophistication

### Buttons
- **Primary:** `primary` (#0060ad) background with `on_primary` (#f8f8ff) text. Corner radius: `full` (9999px) to emphasize the "friendly" brand pillar.
- **Secondary:** `secondary_container` (#ffe087) background. This "warm yellow" provides an encouraging contrast to the blues.

### Cards & Lists
- **Prohibition:** No divider lines.
- **Implementation:** Group related application tasks into a `surface_container_low` wrap. Each task item is a `surface_container_lowest` card with a `md` (1.5rem) corner radius. Use the Spacing Scale `2` (0.7rem) for internal gutters.

### Input Fields
- Avoid the "box" look. Use a `surface_container_high` background with no border. On focus, transition the background to `surface_container_lowest` and apply a 2px "Ghost Border" using `primary`.

### Progress Indicators (App Specific)
Instead of a thin line, use a thick, soft-ended track (`xl` roundedness) using `secondary_container` as the track and `secondary` as the fill. This makes progress feel substantial and rewarding.

---

## 6. Do’s and Don’ts

### Do
- **Do use generous white space.** If you think there’s enough room, add another `3` (1rem) of padding.
- **Do use "Plus Jakarta Sans" for numbers.** It makes application deadlines and SAT scores look elegant and less intimidating.
- **Do overlap elements.** Let a card partially "break" the container of a header to create a bespoke, non-template feel.

### Don’t
- **Don’t use pure black.** Use `on_background` (#173355) for all high-contrast text.
- **Don’t use "Default" corners.** A 4px or 8px radius is too corporate. Stick to `DEFAULT` (1rem) or `md` (1.5rem) for that "friendly" signature.
- **Don’t use icons alone.** High schoolers are navigating a complex system; always pair icons with a `label-sm` or `body-sm` for absolute clarity.

---
**Director's Final Note:** 
"Get in!" is a promise. Every time a student opens this app, they should feel like they are stepping into a well-organized, high-end workspace designed specifically for their success. Use the yellows (`secondary`) sparingly—like a highlighter on a page—to draw attention to the most important "Next Step."