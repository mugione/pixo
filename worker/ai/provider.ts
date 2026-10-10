// AI provider abstraction. Cloudflare Workers AI is the default (and currently only enabled)
// provider; the interface is ready for Anthropic Claude (Phase 6), which will only be used when
// a key is configured AND an admin enables it.

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export interface TextProvider {
  readonly id: string
  readonly model: string
  complete(messages: ChatMessage[], opts: { maxTokens: number; schema?: object }): Promise<string>
}

/** Pulls the assistant text out of the different response shapes Workers AI models use. */
export function textFromResult(res: unknown): string {
  if (typeof res === 'string') return res
  const r = (res ?? {}) as Record<string, unknown>
  if (typeof r.response === 'string') return r.response
  if (r.response && typeof r.response === 'object') return JSON.stringify(r.response)
  const choices = r.choices as { message?: { content?: unknown } }[] | undefined
  const content = choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (content && typeof content === 'object') return JSON.stringify(content)
  const result = r.result as Record<string, unknown> | undefined
  if (result) return textFromResult(result)
  throw new Error('empty_response')
}

export class WorkersAiText implements TextProvider {
  readonly id = 'cloudflare'
  constructor(
    private ai: Ai,
    readonly model: string,
  ) {}

  async complete(messages: ChatMessage[], opts: { maxTokens: number; schema?: object }): Promise<string> {
    const base = { messages, max_tokens: opts.maxTokens, temperature: 0.7 }
    const run = (input: object) => (this.ai.run as (m: string, i: object) => Promise<unknown>)(this.model, input)
    let res: unknown
    try {
      res = opts.schema ? await run({ ...base, response_format: { type: 'json_schema', json_schema: opts.schema } }) : await run(base)
    } catch (e) {
      // Some models reject response_format; retry once in plain mode (output is validated anyway).
      if (!opts.schema) throw e
      res = await run(base)
    }
    return textFromResult(res)
  }
}

export type ImageResult = { base64: string; mime: string }

function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp'
  return 'application/octet-stream'
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** FLUX.2 models on Workers AI take multipart form data (even for prompt-only requests). */
export async function generateImage(
  ai: Ai,
  model: string,
  input: { prompt: string; width: number; height: number; reference?: Uint8Array<ArrayBuffer>; referenceMime?: string },
): Promise<ImageResult> {
  const form = new FormData()
  form.append('prompt', input.prompt)
  form.append('width', String(input.width))
  form.append('height', String(input.height))
  if (input.reference) form.append('input_image_0', new Blob([input.reference], { type: input.referenceMime ?? 'image/jpeg' }), 'reference')
  const req = new Response(form)
  const res = await (ai.run as (m: string, i: object) => Promise<unknown>)(model, {
    multipart: { body: req.body, contentType: req.headers.get('content-type') },
  })
  let bytes: Uint8Array
  if (res instanceof ReadableStream) bytes = new Uint8Array(await new Response(res).arrayBuffer())
  else if (res instanceof ArrayBuffer) bytes = new Uint8Array(res)
  else {
    const r = (res ?? {}) as Record<string, unknown>
    const b64 = (typeof r.image === 'string' && r.image) || ((r.result as Record<string, unknown> | undefined)?.image as string | undefined)
    if (!b64) throw new Error('empty_image')
    const clean = b64.replace(/^data:image\/\w+;base64,/, '')
    const bin = atob(clean.slice(0, 16))
    const head = new Uint8Array([...bin].map((c) => c.charCodeAt(0)))
    return { base64: clean, mime: sniffMime(head) === 'application/octet-stream' ? 'image/png' : sniffMime(head) }
  }
  if (bytes.length < 100) throw new Error('empty_image')
  return { base64: toBase64(bytes), mime: sniffMime(bytes) }
}
