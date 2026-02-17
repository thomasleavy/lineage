const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="#18181b"/><text x="16" y="22" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#facc15" text-anchor="middle">L</text></svg>`;

export function GET() {
  return new Response(SVG, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
