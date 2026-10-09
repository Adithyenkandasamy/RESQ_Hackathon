---
name: Clinical Precision
colors:
  surface: '#f9f9ff'
  surface-dim: '#cadaff'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e8edff'
  surface-container-high: '#e0e8ff'
  surface-container-highest: '#d7e2ff'
  on-surface: '#041b3c'
  on-surface-variant: '#3f4850'
  inverse-surface: '#1d3052'
  inverse-on-surface: '#edf0ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#00668a'
  on-secondary: '#ffffff'
  secondary-container: '#40c2fd'
  on-secondary-container: '#004d6a'
  tertiary: '#006b2c'
  on-tertiary: '#ffffff'
  tertiary-container: '#00873a'
  on-tertiary-container: '#f7fff2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f9f9ff'
  on-background: '#041b3c'
  surface-variant: '#d7e2ff'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  mono-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for mission-critical emergency ambulance dispatch and hospital intake coordination. In acute-care operations, ambiguity costs lives. The visual language conveys quiet authority, clinical clarity, and rapid legibility under cognitive strain.

The design movement combines **Minimalism** with **Modern Enterprise Precision**:
- High-contrast hierarchy prioritizing dynamic, real-time clinical data over decorative accents.
- Zero visual noise: flat tinted surfaces, hairline dividers, and controlled status signals.
- Emotional resonance: reliable, methodical, and calm under high stress, removing cognitive load for dispatchers, paramedics, and triage nurses.

## Colors

The palette balances clinical legibility with high-signal urgency markers:
- **Primary Action (`#0284C7`)**: Anchors interactive commands, triage commitments, and primary CTAs. Transitions to `#0369A1` on hover and active states.
- **Accent Sky Blue (`#38BDF8`)**: Secondary focal point; highlights active live states, vehicle beacons, and focus rings.
- **Backgrounds**: Pure canvas `#FFFFFF` for primary work surfaces; `#F5FAFF` (ice tint) for structural sidebars, navigation panels, and card backdrops.
- **Typography & Structure**: Main content set in dark navy `#172B4D` for maximum contrast without harsh pure-black glare; secondary and metadata text set in slate `#64748B`.
- **System Borders**: 1px structural hairline `#E2EAF2` defines spatial separation cleanly without heavy contrast.
- **Operational Status Roles**:
  - Success / Stable: `#16A34A`
  - Warning / Delayed: `#F59E0B`
  - Critical / Immediate Hazard / Code Red: `#EF4444`

## Typography

The design system relies on **Inter** for all typographic hierarchies, selected for its tall x-height, open apertures, and exceptional readability across low-grade dispatch screens and tablets.

- **Numerics & Vital Stats**: Utilize tabular numbers (`font-variant-numeric: tabular-nums`) across metrics, bed capacities, dispatch timers, and telemetry streams to avoid layout twitch during real-time data syncs.
- **Hierarchy Rules**: Display levels are reserved for high-level operations dashboards and telemetry KPIs. Form inputs, table cells, and dispatch cards primarily live within `body-md` and `label-md` to preserve density and high information throughput.

## Layout & Spacing

The layout operates on a strict 8px structural spacing rhythm (with 4px substeps for compact badges and indicators). 

- **Layout Structure**: 
  - Standardizes on a 12-column fluid grid for mission control consoles, scaling down to a single-column contextual stacked layout on tablet/mobile field devices.
  - Multi-pane operations shell: fixed 260px collapsible fleet navigation, dynamic flex multi-column triage boards, and a dedicated 380px contextual live drawer for route maps or patient vital streams.
- **Responsive Adaptations**:
  - Desktop (>1024px): 24px gutters, persistent operational split views, 32px safe canvas margins.
  - Tablet (768px - 1023px): 16px gutters, slide-over telemetry panels, 24px margins.
  - Mobile (<768px): 16px gutters, tab-based view switching between Map, Queue, and Unit Status, 16px margins.

## Elevation & Depth

To maximize cognitive speed and maintain professional clinical utility, depth is achieved primarily through **low-contrast outlines and delicate surface stacking**, never deep drop shadows.

- **Border Hierarchy**: Containers, table headers, and structural panels are outlined with a crisp `1px solid #E2EAF2`.
- **Surfaces**: Stacking order moves from background canvas (`#F5FAFF`) to operational card surface (`#FFFFFF`).
- **Shadow Tiers**:
  - `elevation-flat`: 0px shadow with `1px solid #E2EAF2` (default cards, rows, side panels).
  - `elevation-low`: `0 1px 2px 0 rgba(23, 43, 77, 0.04), 0 1px 3px 0 rgba(2, 132, 199, 0.04)`, `1px solid #E2EAF2` (clickable cards, hover states).
  - `elevation-overlay`: `0 8px 16px -4px rgba(23, 43, 77, 0.08), 0 2px 6px -1px rgba(23, 43, 77, 0.04)`, `1px solid #E2EAF2` (dropdown menus, contextual popovers, triage drawer takeovers).
- **Critical Focus Rings**: Interactive elements feature a `0 0 0 3px rgba(56, 189, 248, 0.35)` focus ring for unambiguous keyboard and touch navigation.

## Shapes

The interface utilizes a disciplined, subtle curvature that projects architectural reliability:
- Default elements (buttons, text inputs, standard cards, and banners) use **Soft** `0.375rem` (6px) to `0.5rem` (8px) corner radii.
- Badges, status pills, and telemetry tags use full pill radiuses (`9999px`) to visually differentiate metadata from actionable input fields and containers.
- Modals, flyout panels, and large dashboard tiles adhere to `rounded-lg` (`0.5rem` / 8px) with no exaggerated organic shaping.

## Components

### Buttons
- **Primary**: Background `#0284C7`, text `#FFFFFF`, border `transparent`, border-radius 6px, height 36px (desktop) / 44px (touch). Hover `#0369A1`. Active `#0c4a6e`.
- **Secondary**: Background `#FFFFFF`, text `#0284C7`, border `1px solid #E2EAF2`. Hover background `#F5FAFF`, border `#0284C7`.
- **Destructive**: Background `#EF4444`, text `#FFFFFF`. Hover `#DC2626`.
- **Ghost/Tertiary**: Background `transparent`, text `#172B4D`, border `transparent`. Hover background `#F5FAFF`, text `#0284C7`.

### Status Badges & Chips
- **Geometry**: Height 22px, padding 0 8px, border-radius 9999px, font size 12px, font weight 600.
- **Variants**:
  - *Code Red / Critical*: `#FEE2E2` background, `#EF4444` text, `#FCA5A5` 1px border.
  - *En Route / In Transit*: `#E0F2FE` background, `#0284C7` text, `#BAE6FD` 1px border.
  - *Available / Cleared*: `#DCFCE7` background, `#16A34A` text, `#86EFAC` 1px border.
  - *Delayed / Caution*: `#FEF3C7` background, `#D97706` text, `#FDE68A` 1px border.

### Input Fields
- White background (`#FFFFFF`), text `#172B4D`, placeholder `#64748B`.
- 1px continuous border `#E2EAF2`. Height 38px, padding 0 12px, border-radius 6px.
- Focus: Border `#0284C7` with a 3px outer glow ring of `rgba(56, 189, 248, 0.35)`.
- Error: Border `#EF4444` with a 3px glow of `rgba(239, 68, 68, 0.20)`.

### Cards & Dispatch Panels
- Background `#FFFFFF`, border `1px solid #E2EAF2`, border-radius 8px, padding 16px.
- Live tracking cards incorporate a left-edge 4px colored accent border indicating patient triage tier (Green, Amber, Red).

### Tables & Live Queues
- Header: `#F5FAFF` background, `#64748B` uppercase text, `font-size: 11px`, `letter-spacing: 0.05em`, border bottom `1px solid #E2EAF2`.
- Row: `#FFFFFF` background, hover `#F5FAFF`, height 48px, horizontal borders `1px solid #E2EAF2`.

### Checkboxes & Radios
- Box size: 16x16px, border `1px solid #64748B`, border-radius 4px (checkbox) or circular (radio).
- Checked: Background `#0284C7`, checkmark icon white, border `#0284C7`.

### Specialized Healthcare Components
- **Ambulance ETA Tracker**: Compact horizontal bar with `#38BDF8` progress fill, `#0284C7` anchor pinpoint, and monospace countdown timer.
- **Hospital Bed Capacity Gauge**: Segmented pill bar visualizing ER, ICU, and General capacity using threshold alerts (`#16A34A` < 75%, `#F59E0B` 75-90%, `#EF4444` > 90%).