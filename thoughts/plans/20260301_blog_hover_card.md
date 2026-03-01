# Blog Hover Card Implementation Plan

## Overview

Add a preview hover card to each blog post row on the homepage. When a visitor hovers a post row, a 320px card slides in showing the post's emoji, title, description, date, tags, and optional image. The card uses Rose Pine colors consistent with the rest of the site.

Approach: a single `BlogList.tsx` React component receives serialized post data from `index.astro`, renders the list, and manages hover state with a 150ms entrance delay via `setTimeout`.

## Current State Analysis

- **Blog list**: `src/pages/index.astro:71-87` — server-rendered, maps `posts.slice(0, 8)` into flex rows using `<Link>` (`src/spans/link.astro`) and a date `<p>`
- **Link component**: `src/spans/link.astro` — applies `hover:bg-white hover:text-black` via scoped style (`#e0def4` bg, `#232136` text)
- **Existing tooltip**: `src/components/ToolTip.tsx` — pure CSS `group-hover` pattern with `opacity-0 invisible → opacity-100 visible` and `scale-95 → scale-100`. No delay support.
- **Theme**: `darkMode: "class"` in `tailwind.config.mjs:3`, dark class toggled on `<html>` by inline script in `base.astro:138-159`
- **Colors in use**: `text-rosePineDawn-subtle` / `dark:text-rosePine-subtle` for muted text (index.astro:84), hex `#e0def4`/`#232136` in link.astro
- **Blog frontmatter**: `title`, `date`, `description`, `emoji`, `color` (default "pine"), `bg`, `tags[]`, `img` (Astro `image()` → `ImageMetadata`) — `src/content/config.ts:3-20`
- **No custom Tailwind palette**: `tailwind.config.mjs` has no `theme.extend.colors`. rosePine class names seen in the codebase will be unknown to Tailwind; all rosePine colors must use arbitrary hex values or inline styles.

## Desired End State

- Hovering any blog post row on the homepage shows a preview card to the right of the row
- Card contains: emoji + title, truncated description, formatted date, tag pills
- Card uses the post's `color`/`bg` field as a left accent bar (colored `div`, 4px wide)
- If `img` is present, show it as a header image in the card
- 150ms entrance delay, immediate exit; fade + scale animation
- Works in light and dark mode
- No viewport overflow (card flips left if no room to the right)
- Non-hover behavior identical to current (the `<a>` tag wrapping still navigates on click)

## What We're NOT Doing

- Mobile/touch support — hover cards are desktop only
- Modifying `src/spans/link.astro` — the link styling stays as-is
- Click-to-persist cards
- Hover cards for any content collection other than blog
- Custom Tailwind color tokens — use inline styles or arbitrary values for rosePine hex colors

## Implementation Approach

Replace the server-rendered blog map in `index.astro` with a `<BlogList>` React component (`client:load`). This component receives a serialized array of post data as a prop and handles hover state internally. Each row is wrapped in a container with `position: relative`; the card is `position: absolute` offset to the right, toggled via `useState` + `setTimeout` for the delay.

## Phase 1: Create `BlogList.tsx`

### Overview

Single React component that owns both the list rendering and the hover card display. No separate file needed — the card markup lives inline.

### Changes Required

#### 1. File: `src/components/BlogList.tsx` (Create)

**Purpose**: Client-side interactive blog list with hover preview cards.

**Props**:
```typescript
interface PostData {
  slug: string;
  title: string;
  date: string;        // ISO string, formatted on render
  description: string;
  emoji?: string;
  color?: string;      // accent color hex or name — used as border-left color
  bg?: string;         // fallback accent
  tags?: string[];
  imgSrc?: string;     // ImageMetadata.src, passed from Astro
}

interface BlogListProps {
  posts: PostData[];
}
```

**Key logic**:

```tsx
export default function BlogList({ posts }: BlogListProps) {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [visibleSlug, setVisibleSlug] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function handleMouseEnter(slug: string) {
    timerRef.current = setTimeout(() => setVisibleSlug(slug), 150);
    setHoveredSlug(slug);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisibleSlug(null);
    setHoveredSlug(null);
  }

  // Determine card side: if row right edge + 340px > viewport width, show left
  function getCardSide(slug: string): "right" | "left" {
    const el = rowRefs.current[slug];
    if (!el) return "right";
    const rect = el.getBoundingClientRect();
    return rect.right + 340 < window.innerWidth ? "right" : "left";
  }

  return (
    <div>
      {posts.map((post) => {
        const isVisible = visibleSlug === post.slug;
        const side = isVisible ? getCardSide(post.slug) : "right";
        const accentColor = post.color ?? post.bg ?? "#6e6a86"; // rosePine iris fallback

        return (
          <div
            key={post.slug}
            ref={(el) => { rowRefs.current[post.slug] = el; }}
            className="pb-2 flex flex-row items-baseline justify-between gap-x-4 relative"
            onMouseEnter={() => handleMouseEnter(post.slug)}
            onMouseLeave={handleMouseLeave}
          >
            {/* Existing row markup — mirrors current index.astro output */}
            <h2 className="underline decoration-[0.5px] decoration-dotted">
              <a
                href={`/blog/${post.slug}`}
                className="underline decoration-dotted hover:no-underline p-0.5"
                style={{ ["--hover-bg" as string]: "#e0def4" }}
              >
                {post.title}
              </a>
            </h2>
            <p className="text-[#6e6a86] dark:text-[#908caa] text-sm">
              {new Date(post.date).toLocaleDateString()}
            </p>

            {/* Hover card */}
            <div
              className={[
                "absolute top-1/2 -translate-y-1/2 z-50 w-80 rounded-md shadow-lg overflow-hidden",
                "bg-white dark:bg-[#1f1d2e] border border-[#e0def4] dark:border-[#393552]",
                "transition-all duration-200 ease-out pointer-events-none",
                side === "right" ? "left-full ml-3" : "right-full mr-3",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
              ].join(" ")}
            >
              {/* Accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accentColor }} />

              {/* Optional image header */}
              {post.imgSrc && (
                <img src={post.imgSrc} alt="" className="w-full h-28 object-cover" />
              )}

              <div className="p-3 pl-4">
                {/* Emoji + title */}
                <div className="flex items-center gap-2 mb-1">
                  {post.emoji && <span className="text-lg">{post.emoji}</span>}
                  <span className="font-semibold text-sm text-[#232136] dark:text-[#e0def4] line-clamp-1">
                    {post.title}
                  </span>
                </div>

                {/* Description */}
                {post.description && (
                  <p className="text-xs text-[#6e6a86] dark:text-[#908caa] line-clamp-2 mb-2">
                    {post.description}
                  </p>
                )}

                {/* Date */}
                <p className="text-xs text-[#6e6a86] dark:text-[#908caa] mb-2">
                  {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>

                {/* Tags */}
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[#f2eff4] dark:bg-[#393552] text-[#6e6a86] dark:text-[#908caa]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Success Criteria**:
- [ ] Component renders without TypeScript errors (`npm run build`)
- [ ] Card appears after ~150ms on hover, disappears immediately on mouse leave
- [ ] Card is positioned to the right by default, flips left when near viewport edge

---

## Phase 2: Integrate into `index.astro`

### Overview

Replace the server-rendered blog map with `<BlogList client:load>`, passing serialized post data.

### Changes Required

#### 1. File: `src/pages/index.astro` (Modify)

**Current** (lines 71-87):
```astro
<div>
  {
    posts.slice(0, 8).map((post) => (
      <div class="pb-2 flex flex-row items-baseline justify-between gap-x-4">
        <h2 class="underline decoration-0.5 decoration-dotted">
          <Link href={`/blog/${post.slug}`}>{post.data.title}</Link>
        </h2>
        <p class="text-rosePineDawn-subtle dark:text-rosePine-subtle">
          {new Date(post.data.date).toLocaleDateString()}
        </p>
      </div>
    ))
  }
</div>
```

**Replace with**:
```astro
---
// Add import at top of frontmatter
import BlogList from "@/components/BlogList";

// Add serialization after posts are sorted
const postData = posts.slice(0, 8).map((post) => ({
  slug: post.slug,
  title: post.data.title,
  date: post.data.date.toISOString(),
  description: post.data.description ?? "",
  emoji: post.data.emoji,
  color: post.data.color,
  bg: post.data.bg,
  tags: post.data.tags,
  imgSrc: post.data.img?.src,
}));
---

<!-- Replace the <div> blog map with: -->
<BlogList posts={postData} client:load />
```

**Notes**:
- `post.data.img` is `ImageMetadata | undefined` — `.src` is the path string safe to pass as a prop
- `post.data.date` is a `Date` object — serialize to ISO string, parse back in the component
- The `Link` component from `src/spans/link.astro` is an Astro component and cannot be used inside a React component. The hover card replicates its styling via inline hex values (`#e0def4` bg, `#232136` text) on `<a>` directly.

**Success Criteria**:
- [ ] `npm run build` passes with no type errors
- [ ] Homepage renders 8 blog posts identical to before (visually)
- [ ] Hovering a post row shows the preview card
- [ ] Card dismisses on mouse leave
- [ ] Light and dark mode both render correctly

---

## References

- Ticket: `thoughts/ticket/20260301_blog_hover_card.md`
- Blog list: `src/pages/index.astro:71-87`
- Content schema: `src/content/config.ts:3-20`
- Tooltip pattern reference: `src/components/ToolTip.tsx`
- Link styling reference: `src/spans/link.astro`
- Theme system: `src/layouts/base.astro:138-159`
- rosePine hex values used in codebase: `#e0def4` (surface), `#232136` (base dark), `#6e6a86` (subtle light), `#908caa` (subtle dark), `#393552` (overlay dark), `#1f1d2e` (base dark bg)
