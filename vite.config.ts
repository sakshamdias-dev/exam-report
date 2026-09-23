import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function pdfProxyPlugin(): Plugin {
  return {
    name: 'pdf-proxy-middleware',
    configureServer(server) {
      server.middlewares.use('/api/proxy-pdf', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const reqUrl = new URL(req.url || '', 'http://localhost:3000');
          const fileId = reqUrl.searchParams.get('fileId') || reqUrl.searchParams.get('id');
          const targetUrl = reqUrl.searchParams.get('url');

          const urlsToTry: string[] = [];
          if (fileId) {
            urlsToTry.push(
              `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
              `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
              `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`
            );
          }
          if (targetUrl) {
            urlsToTry.push(targetUrl);
          }

          let fetchedBuffer: Buffer | null = null;
          let contentType = 'application/pdf';

          for (const u of urlsToTry) {
            try {
              const fetchRes = await fetch(u, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  Accept: '*/*',
                },
                redirect: 'follow',
              });

              if (fetchRes.ok) {
                const ct = fetchRes.headers.get('content-type') || '';
                const ab = await fetchRes.arrayBuffer();
                const buf = Buffer.from(ab);

                // If Google Drive returned an HTML warning/confirm page, check if it contains a confirm link
                if (ct.includes('text/html') && buf.includes(Buffer.from('confirm='))) {
                  const html = buf.toString('utf-8');
                  const match = html.match(/href="([^"]+confirm=[^"]+)"/);
                  if (match) {
                    const confirmUrl = match[1].replace(/&amp;/g, '&');
                    const secondRes = await fetch(confirmUrl, { redirect: 'follow' });
                    if (secondRes.ok) {
                      fetchedBuffer = Buffer.from(await secondRes.arrayBuffer());
                      contentType = secondRes.headers.get('content-type') || 'application/pdf';
                      break;
                    }
                  }
                }

                // Check magic bytes for PDF (%PDF) or Image
                if (
                  (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) ||
                  (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
                  (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
                ) {
                  fetchedBuffer = buf;
                  contentType = ct || 'application/pdf';
                  break;
                }
              }
            } catch (err) {
              console.warn('[proxy-pdf] Attempt failed for URL:', u, err);
            }
          }

          if (fetchedBuffer) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', fetchedBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.statusCode = 200;
            res.end(fetchedBuffer);
          } else {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'File could not be fetched from upstream sources' }));
          }
        } catch (serverErr: any) {
          console.error('[proxy-pdf] Server error:', serverErr);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 500;
          res.end(JSON.stringify({ error: serverErr?.message || 'Proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pdfProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
