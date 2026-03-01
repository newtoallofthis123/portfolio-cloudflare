import { useState, useRef } from "react";

interface PostData {
  slug: string;
  title: string;
  date: string;
  description: string;
  emoji?: string;
  color?: string;
  bg?: string;
  tags?: string[];
  imgSrc?: string;
}

interface BlogListProps {
  posts: PostData[];
}

export default function BlogList({ posts }: BlogListProps) {
  const [visibleSlug, setVisibleSlug] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter(slug: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisibleSlug(slug), 150);
  }

  function handleMouseLeave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisibleSlug(null);
  }

  return (
    <div>
      {posts.map((post) => {
        const isVisible = visibleSlug === post.slug;
        const accentColor = post.color ?? post.bg ?? "#6e6a86";

        return (
          <div
            key={post.slug}
            className="pb-2 flex flex-row items-baseline justify-between gap-x-4 relative"
            onMouseEnter={() => handleMouseEnter(post.slug)}
            onMouseLeave={handleMouseLeave}
          >
            <h2 className="underline decoration-[0.5px] decoration-dotted">
              <a
                href={`/blog/${post.slug}`}
                className="underline decoration-dotted hover:no-underline p-0.5 hover:bg-[#e0def4] hover:text-[#232136]"
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
                "absolute bottom-full left-0 mb-2 z-50 w-80 rounded-md shadow-lg overflow-hidden",
                "bg-white dark:bg-[#1f1d2e] border border-[#e0def4] dark:border-[#393552]",
                "transition-all duration-200 ease-out pointer-events-none",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
              ].join(" ")}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accentColor }} />

              {post.imgSrc && (
                <img src={post.imgSrc} alt="" className="w-full h-28 object-cover" />
              )}

              <div className="p-3 pl-4">
                <div className="flex items-center gap-2 mb-1">
                  {post.emoji && <span className="text-lg">{post.emoji}</span>}
                  <span className="font-semibold text-sm text-[#232136] dark:text-[#e0def4] line-clamp-1">
                    {post.title}
                  </span>
                </div>

                {post.description && (
                  <p className="text-xs text-[#6e6a86] dark:text-[#908caa] line-clamp-2 mb-2">
                    {post.description}
                  </p>
                )}

                <p className="text-xs text-[#6e6a86] dark:text-[#908caa] mb-2">
                  {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>

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
