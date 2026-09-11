import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import satori from 'satori';
import sharp from 'sharp';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const prerender = true;

const WIDTH = 1200;
const HEIGHT = 630;

export async function getStaticPaths() {
  const blogPosts = await getCollection('blog');

  return blogPosts.map((post) => ({
    params: { slug: post.slug },
  }));
}

async function loadFont(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Geist:wght@${weight}&display=swap`
  ).then((r) => r.text());

  // Satori cannot parse woff2, and Google only serves ttf to clients that do
  // not advertise support for it — so this must stay a bare fetch.
  const url = css.match(/src: url\((.+?)\) format\('(truetype|woff)'\)/)?.[1];
  if (!url) {
    throw new Error(`No ttf/woff source for Geist ${weight}`);
  }

  return fetch(url).then((r) => r.arrayBuffer());
}

/**
 * The collection's `img` is already transformed, so its `src` is a hashed
 * `/_astro/name.HASH.webp`. The original still lives under src/assets, which is
 * what Satori needs; returns null when that lookup does not land.
 */
async function heroDataUri(src: string | undefined): Promise<string | null> {
  if (!src) return null;

  const base = path.basename(src.split('?')[0]);
  const name = base.split('.')[0];

  for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
    try {
      const file = await readFile(path.join('src/assets', `${name}.${ext}`));
      const png = await sharp(file)
        .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      continue;
    }
  }

  return null;
}

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;

  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  const post = await getEntry('blog', slug);

  if (!post) {
    return new Response('Post not found', { status: 404 });
  }

  const { title, description, author, date, img, bg, fg } = post.data;

  const hero = await heroDataUri(img?.src);
  const ground = hero ? (bg ?? '#111111') : (bg ?? '#ffffff');
  const ink = hero ? (fg ?? '#ffffff') : (fg ?? '#111111');

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const [regular, bold] = await Promise.all([loadFont(400), loadFont(700)]);

  const svg = await satori(
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: ground,
          fontFamily: 'Geist',
        },
      },
      hero &&
        createElement('img', {
          src: hero,
          width: WIDTH,
          height: HEIGHT,
          style: { position: 'absolute', top: 0, left: 0 },
        }),
      hero &&
        createElement('div', {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${WIDTH}px`,
            height: `${HEIGHT}px`,
            backgroundImage: `linear-gradient(to bottom, ${ground}00 0%, ${ground}cc 52%, ${ground} 78%)`,
          },
        }),
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${WIDTH}px`,
            height: `${HEIGHT}px`,
            padding: '64px',
          },
        },
        createElement(
          'div',
          {
            style: {
              display: 'block',
              fontSize: '64px',
              fontWeight: 700,
              color: ink,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              lineClamp: 3,
            },
          },
          title
        ),
        description &&
          createElement(
            'div',
            {
              style: {
                display: 'block',
                fontSize: '28px',
                color: ink,
                opacity: 0.85,
                lineHeight: 1.4,
                marginTop: '20px',
                lineClamp: 2,
              },
            },
            description
          ),
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '24px',
              color: ink,
              marginTop: '36px',
            },
          },
          createElement('div', { style: { opacity: 0.8 } }, `${author} · ${formattedDate}`),
          createElement('div', { style: { fontWeight: 700 } }, 'noobscience.in')
        )
      )
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Geist', data: regular, weight: 400, style: 'normal' },
        { name: 'Geist', data: bold, weight: 700, style: 'normal' },
      ],
    }
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
