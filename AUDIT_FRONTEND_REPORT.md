# SCOLIA Frontend Audit Report

**Date:** 2026-10-22  
**Auditor:** Design Engineering Review (Emil Kowalski methodology)  
**Scope:** Complete frontend codebase (`frontend/src/`)

---

## Executive Summary

The SCOLIA frontend is a well-structured React/TypeScript application with Tailwind CSS. It has solid architectural foundations (RLS-aware, proper auth flows, multi-tenant isolation). However, **significant issues exist in animation craft, mobile experience, and edge-case handling** that prevent it from feeling "native" and polished.

---

## 🎯 Animation & Motion Audit (`review-animations` + `emil-design-eng`)

### Critical Findings (Block-level)

| # | Severity | Location | Issue | Fix |
|---|----------|----------|-------|-----|
| 1 | **HIGH** | `index.css:23-25` | Custom cubic-bezier `0.22, 1, 0.36, 1` is **weaker than recommended** — lacks punch. Should use `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` | Update CSS custom properties |
| 2 | **HIGH** | `Hero.tsx:36` | `ease-in-out` on hero image fade (1000ms) — **ease-in delays the moment user watches most** | Use `ease-out` or custom `--ease-out` |
| 3 | **HIGH** | Multiple `.tsx` files | `transition-all` used extensively (`SchoolsPage.tsx:18`, `FeaturesPage.tsx:51`, `AboutPage.tsx:30`, `StatCard.tsx:16`, `TestimonialsSection.tsx:20`, `StepsBento.tsx:25`, `PricingSection.tsx:25`) — **animates unintended properties off-GPU** | Replace with explicit properties: `transition: transform 200ms ease-out, opacity 200ms ease-out` |
| 4 | **HIGH** | `Hero.tsx:36` | Hero image fade: `duration-1000` (1000ms) — **exceeds 300ms UI budget** for landing content | Reduce to 300-500ms max; hero is marketing so can be longer but 1s is too slow |
| 5 | **HIGH** | `LogoStrip.tsx:10` | `animate-marquee` infinite loop on logo strip — **runs 100+ times/day** (user sees on every page load). Should have **no animation** or drastically reduced | Remove animation or add `prefers-reduced-motion` to stop |
| 6 | **MEDIUM** | `Switch.tsx:35` | `transition-all` on thumb position — **should be `transition: transform 160ms ease-out`** | Specify exact property |
| 7 | **MEDIUM** | `Accordion.tsx:33` | `transition-all duration-300` on content grid — **layout property animation** (grid-rows). Should animate `max-height` or use `@starting-style` | Use `grid-template-rows` with `@starting-style` or `max-height` |
| 8 | **MEDIUM** | `Modal.tsx:45`, `PublicLayout.tsx:20`, `DashboardLayout.tsx:27`, `PageHero.tsx:56`, `Navbar.tsx:122` | `animate-page` (450ms keyframes) on **every route change** — keyboard navigation triggers this 100+ times/day | Remove animation on route change; keep only for modals/drawers |
| 9 | **MEDIUM** | `Sidebar.tsx:72` | `transition-opacity duration-200` on label — **good**, but missing `delay-[80ms]` for stagger | Add stagger delay as implemented |
| 10 | **MEDIUM** | `ArrowButton.tsx:37` | `transition-transform duration-300` on group-hover rotate — **300ms too slow for hover** | Reduce to 150-200ms |

### Missing Standards

| Standard | Status | Required Action |
|----------|--------|-----------------|
| `prefers-reduced-motion` | ❌ **Missing entirely** | Add `@media (prefers-reduced-motion: reduce)` to disable transform animations |
| Hover gating | ❌ **Missing** | All `:hover` transforms need `@media (hover: hover) and (pointer: fine)` |
| `transform-origin` on popovers | ⚠️ Partial | `MatriculeStep.tsx`, `FilterSheet.tsx`, `MoreSheet.tsx` — verify origin matches trigger |
| Asymmetric enter/exit | ❌ **Missing** | Symmetric timing everywhere; press should be slow, release fast |
| Stagger on lists | ❌ **Missing** | `StudentsPage`, `StaffPage`, `ClassesPage` — all items appear at once |
| Keyboard-triggered animations | ⚠️ Present | Route change animation (`animate-page`) fires on keyboard nav — **must remove** |

### Performance Concerns (`animation-performance`)

| Issue | Location | Impact |
|-------|----------|--------|
| `will-change: width` on `.will-change-width` | `index.css:179` | Promotes layer for width animation (layout property) — **wrong property for will-change** |
| `transition: width 250ms ease-out` | `index.css:175` | Animates layout property — triggers reflow every frame |
| `transition-all` on cards with many children | `StatCard.tsx`, `PricingSection.tsx`, etc. | May animate `box-shadow`, `border-radius` — paint tier |
| `animate-float` (5s infinite) on `ContactPage.tsx:36` | Runs continuously — **GPU layer promotion without need** | Remove or add `prefers-reduced-motion` |
| Framer Motion not used | N/A | Good — plain CSS/JS, but no hardware acceleration audit done |

---

## 📱 Mobile Native Audit (`mobile-native`)

### Critical Findings

| # | Severity | Issue | Location | Fix |
|---|----------|-------|----------|-----|
| 1 | **HIGH** | **No `-webkit-tap-highlight-color: transparent` on `html`** — only on `button, a, input, select, textarea` | `index.css:130` | Move to `html { -webkit-tap-highlight-color: transparent; }` |
| 2 | **HIGH** | **No `touch-action: manipulation` on buttons/links** — 300ms click delay on mobile | Global | Add to `button, a, [role="button"], .tappable` |
| 3 | **HIGH** | **Press feedback on `:active` only** — missing `pointerdown` for instant feedback | `Button.tsx:24` has `active:scale-[0.98]` | Add `pointerdown` listener or ensure `:active` works on touch |
| 4 | **HIGH** | **`100vh` used for sidebar** — `h-[calc(100svh-24px)]` | `Sidebar.tsx:214` | Use `100dvh` for app shell, `100svh` for hero |
| 5 | **HIGH** | **Input font-size not enforced at 16px** — iOS will zoom on focus | `Input.tsx`, `Select.tsx` | Add `font-size: 16px` minimum (or 1rem) |
| 6 | **MEDIUM** | **Hover states not gated** — `:hover` transforms on cards, buttons, rows | `SchoolsPage.tsx:18`, `Table.tsx:126`, `StatCard.tsx:16`, etc. | Wrap in `@media (hover: hover) and (pointer: fine)` |
| 7 | **MEDIUM** | **`overscroll-behavior: none` only on `html, body` missing `contain` on inner scrollables** | `DashboardLayout.tsx`, `MoreSheet.tsx:88` has `overscroll-contain` ✓ | Add `overscroll-behavior: contain` to all inner scroll containers |
| 8 | **MEDIUM** | **`env(safe-area-inset-*)` used but `viewport-fit=cover` present** ✓ | `index.html:5` ✓, `Sidebar.tsx`, `Topbar.tsx`, `BottomNav.tsx` ✓ | Good — but verify all fixed headers/bars have padding |
| 9 | **MEDIUM** | **`user-select: none` on `body`** — `index.css:151` applies globally | `index.css:151` | Remove from `body`; only on controls (`button`, `[role="button"]`, `.tab`, `.chip`) |
| 10 | **LOW** | **No `theme-color` per color scheme** — only single `#0F3D1E` | `index.html:17` | Add light/dark `theme-color` meta tags |

### Baseline Missing

The following baseline is **not fully implemented**:

```html
<!-- Missing from index.html -->
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a" />
<meta name="color-scheme" content="light dark" />
```

```css
/* Missing from index.css */
html {
  -webkit-text-size-adjust: 100%; /* no font inflation in landscape */
}

input, textarea, select {
  font-size: 16px; /* minimum for iOS zoom prevention */
}

button, a, [role="button"] {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

@media (hover: hover) and (pointer: fine) {
  /* all :hover rules with transforms must live here */
}
```

---

## 💥 Break UI Audit (`break-ui`)

### Worst-Case Data Mapping

| Component | Fields Rendered | Limits Found | Worst-Case Values to Test |
|-----------|-----------------|--------------|---------------------------|
| `StudentsPage` | name, email, matricule, child_code, class, status, count | `matricule`: 5-6 char, `child_code`: 6 char | Long name: "Aleksandra Wiśniewska-Kowalczyk", Long email: "bartholomew.fitzgerald@northwind-industries-holdings.example.com", Count: 1, 0, 1284 |
| `StaffPage` | name, email, role, specialties, status | `specialties`: unbounded | One-letter name "Jo", Missing optional, 50 specialties |
| `ClassesPage` | name, level, cycle, capacity, head_teacher | `capacity`: 1-500 | Capacity 1, 500, missing head_teacher |
| `GradeEntry` | student name, subject, period, devoir1/2, composition | 0-20 | NaN, undefined, 20.01, -1 |
| `FinancePayments` | student, kind, label, due_date, amount, paid, status | amount ≥ 0 | NaN, negative, huge numbers |
| `EnrollmentWizard` | birthDate, gender, class, name | birthDate: ISO | Far future, DST boundary, leap day |
| `Sidebar` | school name, role, user name | school name: unbounded | Very long school name, RTL |

### Predicted Breaks (High Confidence)

| # | Severity | Component | Field | Worst-Case | What Breaks | Fix |
|---|----------|-----------|-------|------------|-------------|-----|
| 1 | **Broken** | `StudentsPage` | email | `bartholomew.fitzgerald@northwind-industries-holdings.example.com` | Actions menu pushed off-screen at 400px | `min-width: 0` on text column, `overflow-wrap: anywhere` on email, `flex-shrink: 0` on menu |
| 2 | **Broken** | `StaffPage` | specialties | 50 items | Badge wraps, layout shifts | `white-space: nowrap; flex-shrink: 0` on badge, virtualize or limit display |
| 3 | **Broken** | `GradeEntry` | composition | `20.01` / `-1` | Validation allows out-of-bounds | Clamp 0-20 in `saveGrade` RPC and frontend |
| 4 | **Ugly** | `Sidebar` | schoolName | "Groupe Scolaire Les Baobabs de la Commune de Dakar Plateau" | Truncates or overflows | `truncate` or `flex-shrink: 0` with `min-width: 0` |
| 5 | **Ugly** | `StudentsPage` | count | `1` | "1 members" (hardcoded plural) | Use `Intl.PluralRules` |
| 6 | **Ugly** | `StatCard` / `PricingSection` | long label | "Abonnement Premium Annuel avec Support Dédié" | Wraps to 3+ lines, card height uneven | `line-clamp: 2` or `min-height` |
| 7 | **Fragile** | `EnrollmentWizard` | birthDate | `2024-03-10 02:30` (DST) | Date parsing off by hour | Use UTC dates, `inputMode="numeric"` |
| 8 | **Fragile** | `FinancePayments` | amount | `1,284.000000001` | Jitter, misaligned columns | `font-variant-numeric: tabular-nums`, `Intl.NumberFormat` |
| 9 | **Fragile** | `Table` | long text in any cell | Vietnamese "Người dùng có tên rất dài" | Clipped, line-height issues | Looser `line-height`, no `overflow: hidden` on text |
| 10 | **Fragile** | `Avatar` (MatriculeCard) | emoji name | "🎉 Party User" | Initials show `�` | `Intl.Segmenter` for grapheme clusters |

### Missing Empty/One/Huge States

| Component | Empty | One | Huge (1000+) |
|-----------|-------|-----|--------------|
| `StudentsPage` | ✓ `EmptyState` | ⚠️ "1 members" | ❌ No virtualization |
| `StaffPage` | ✓ | ⚠️ plural | ❌ |
| `ClassesPage` | ✓ | ⚠️ | ❌ |
| `FinancePayments` | ✓ | ⚠️ | ❌ |
| `MessagesPage` | ✓ | N/A | ❌ |

---

## 🛡️ Security & Accessibility

### Already Strong ✅

- CSP headers in `index.html` (defense-in-depth)
- `viewport-fit=cover` + `env(safe-area-inset-*)` for safe areas
- `overscroll-behavior: contain` on sheets/drawers
- Role-based route guards (`RoleRoute`, `ProtectedRoute`)
- Rate limiting on Edge Functions
- JWT verification in `login-guard`
- RLS policies on all tables

### Gaps

| Issue | Location | Risk |
|-------|----------|------|
| No `prefers-reduced-motion` handling | Global | Motion sickness, accessibility violation |
| Ungated `:hover` animations | Multiple | False hover on touch devices |
| No `tabular-nums` on numeric columns | `Table.tsx`, `FinancePayments` | Number jitter on update |
| Input `font-size: 16px` not enforced | `Input.tsx`, `Select.tsx` | iOS zoom on focus |
| No `theme-color` per scheme | `index.html` | Status bar mismatch in dark mode |
| `user-select: none` on `body` | `index.css:151` | Prevents copying addresses, errors |

---

## 📋 Prioritized Action Plan

### Phase 1: Critical Fixes (Week 1)

1. **Add global mobile baseline** (`index.css`, `index.html`)
   - `html { -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; overscroll-behavior: none; }`
   - `input, textarea, select { font-size: 16px; }`
   - `button, a, [role="button"] { touch-action: manipulation; user-select: none; -webkit-user-select: none; }`
   - Add `@media (hover: hover) and (pointer: fine) { /* hover transforms */ }`
   - Add `@media (prefers-reduced-motion: reduce) { /* disable transforms */ }`
   - Add light/dark `theme-color` meta tags

2. **Fix `transition-all` everywhere** — replace with explicit properties
   - Search: `transition-all` → Replace: `transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out), background 150ms var(--ease-out), border-color 150ms var(--ease-out)`

3. **Update easing tokens** in `index.css`
   ```css
   --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
   --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
   --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
   ```

4. **Remove `animate-page` from route changes** — keep only for modals/drawers

5. **Fix `will-change: width`** — remove or change to `will-change: transform`

### Phase 2: Animation Polish (Week 2)

1. **Add stagger delays** (30-80ms) to list items in `StudentsPage`, `StaffPage`, `ClassesPage`, `FinancePayments`
2. **Implement asymmetric timing** — press slow (200ms), release fast (100ms)
3. **Add `@starting-style`** for enter animations (toasts, modals, drawers)
4. **Verify `transform-origin`** on all popovers/dropdowns/tooltips
5. **Replace `animate-marquee`** on logo strip with static or reduced-motion aware

### Phase 3: Break UI Fixes (Week 3)

1. **Add `min-width: 0` + `overflow-wrap: anywhere`** to text columns in tables
2. **Add `flex-shrink: 0`** to avatars, icons, badges, action menus
3. **Implement `Intl.PluralRules`** for counts ("1 member" vs "2 members")
4. **Add `font-variant-numeric: tabular-nums`** to all numeric columns
5. **Add `Intl.NumberFormat`** for currency/numbers with locale
6. **Fix initials extraction** with `Intl.Segmenter` (grapheme clusters)
7. **Add virtualization** for 1000+ row lists (`react-virtual` or `tanstack-virtual`)

### Phase 4: Mobile Verification (Week 4)

1. **Test on real devices** (iOS Safari + Android Chrome)
2. **Verify all fixes** with hardware:
   - Tap highlight gone
   - No sticky hover
   - No input zoom
   - Safe areas respected
   - Pull-to-refresh contained
   - Status bar matches theme
   - Press feedback instant (`pointerdown`)

---

## 📊 Code Quality Metrics

| Metric | Current | Target |
|--------|---------|--------|
| `transition-all` occurrences | 15+ | 0 |
| `ease-in` / `ease-in-out` on UI | 3+ | 0 |
| Animations > 300ms on UI | 4 | 0 |
| Missing `prefers-reduced-motion` | 100% | 0% |
| Ungated hover transforms | 20+ | 0 |
| `touch-action: manipulation` | 0% | 100% |
| Input font-size 16px enforced | 0% | 100% |
| Pluralization with `Intl.PluralRules` | 0% | 100% |
| Tabular numbers | 0% | 100% |

---

## 🎓 Learning Resources

- **Easing curves:** [easing.dev](https://easing.dev/), [easings.co](https://easings.co/)
- **Animation performance:** Chrome DevTools Performance + Animations panels
- **Mobile testing:** Safari Web Inspector (iOS), `chrome://inspect` (Android)
- **Intl APIs:** `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.Segmenter`
- **Emil Kowalski's references:** [animations.dev](https://animations.dev/), [emilkowal.ski/ui](https://emilkowal.ski/ui/)

---

## Next Steps

1. **Apply Phase 1 fixes** — these are the highest leverage changes
2. **Run the audit again** after Phase 1 to verify
3. **Schedule real-device testing** with the team
4. **Create `animation-plans/`** for systematic fixes using `improve-animations` workflow

The codebase is structurally sound — these are craft issues that compound into the difference between "works" and "feels right."