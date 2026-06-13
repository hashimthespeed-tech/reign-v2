import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Dev-only middleware: serve netlify/functions/* at /.netlify/functions/<name>
// so the app runs full-stack under `npm run dev` without the Netlify CLI.
// In production Netlify serves the real functions; the client URL is identical.
function netlifyFunctionsDev(env) {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      // Expose server-only keys to the function handlers (mirrors Netlify env).
      for (const [k, v] of Object.entries(env)) {
        if (!k.startsWith('VITE_')) process.env[k] = v
      }
      server.middlewares.use(async (req, res, next) => {
        const match = req.url.match(/^\/\.netlify\/functions\/([\w-]+)(\?.*)?$/)
        if (!match) return next()
        const name = match[1]
        try {
          const modPath = fileURLToPath(new URL(`./netlify/functions/${name}.js`, import.meta.url))
          const mod = await server.ssrLoadModule(modPath)
          const handler = mod.handler || mod.default
          if (!handler) { res.statusCode = 404; return res.end(`No handler in ${name}`) }

          const url = new URL(req.url, 'http://localhost')
          const queryStringParameters = Object.fromEntries(url.searchParams.entries())

          let body = ''
          if (req.method === 'POST' || req.method === 'PUT') {
            await new Promise((resolve) => {
              req.on('data', (c) => { body += c })
              req.on('end', resolve)
            })
          }

          const result = await handler(
            { httpMethod: req.method, queryStringParameters, body, headers: req.headers },
            {}
          )
          res.statusCode = result.statusCode || 200
          for (const [h, val] of Object.entries(result.headers || {})) res.setHeader(h, val)
          res.end(result.body || '')
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'function dev error', detail: String(err?.message || err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), netlifyFunctionsDev(env)],
  }
})
