import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { renderPlanForRequest } from './src/server/renderPlanApi'

function renderPlanApiPlugin(): Plugin {
  return {
    name: 'md2html-render-plan-api',
    configureServer(server) {
      server.middlewares.use('/api/render-plan', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const response = await renderPlanForRequest(body)
          res.statusCode = 200
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(response))
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), renderPlanApiPlugin()],
  test: {
    environment: 'node',
    globals: true,
  },
})
