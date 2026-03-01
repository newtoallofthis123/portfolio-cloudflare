# Blog Post Hover Card

**Created**: 2026-03-01
**Status**: Draft

---

## Problem Statement

The homepage blog list is minimal — just titles and dates. Visitors have no way to preview what a post is about without clicking through. A hover card that surfaces the post's metadata (description, emoji, color, tags, image) would make the blog list more engaging and help users decide what to read.

---

## User Story

**As a** site visitor
**I want** to see a preview card when I hover over a blog post title
**So that** I can quickly scan what a post is about before clicking

---

## Requirements

### Must Have
1. React component (`BlogHoverCard.tsx`) that renders a preview card on hover
2. Card displays: emoji, title, description (truncated), date, tags as pills
3. Card uses the post's `color`/`bg` frontmatter as an accent (tint or color bar)
4. If the post has an `img`, show it as a card header/background
5. Animated entrance/exit (fade + subtle scale)
6. Works in both light and dark mode
7. Integrated into the homepage blog list, wrapping each post row

### Nice to Have
- Card flips above the row when near viewport bottom to avoid overflow
- Slight delay before showing (150-200ms) to avoid flickering on casual mouse movement

### Won't Have
- Mobile/touch support (hover is desktop-only; mobile falls back to current behavior)
- Click-to-preview or persistent cards
- Card for non-blog content collections

---

## Acceptance Criteria

- [ ] Hovering a blog post row on the homepage shows a preview card
- [ ] Card displays title, description, date, and tags from frontmatter
- [ ] Card uses the post's `color` or `bg` field as a visual accent
- [ ] Card shows post image when `img` is present in frontmatter
- [ ] Card has smooth enter/exit animation
- [ ] Card renders correctly in both light and dark mode
- [ ] Card does not overflow the viewport or cause layout shifts
- [ ] Moving the mouse away dismisses the card

---

## Technical Notes

- **Frontmatter fields available**: `title`, `date`, `description`, `emoji`, `color` (default: "pine"), `bg`, `tags`, `img` — defined in `src/content/config.ts`
- **Current blog list**: `src/pages/index.astro` lines 58-71, renders 8 posts as flex rows with `<Link>` component
- **Existing tooltip**: `src/components/ToolTip.tsx` — React component with position logic and animations. Can reference its positioning approach but the hover card needs richer content
- **Link component**: `src/spans/link.astro` — current hover style is background color change; hover card should complement, not conflict
- Card width ~320px, positioned absolutely relative to the row

---

## Open Questions

- [ ] Should the card trigger on the entire row or just the title text?
- [ ] How prominent should the `img` be — subtle background tint, or a proper thumbnail header?
