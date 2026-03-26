import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getSubscription, getArtworkCount } from '@/lib/db'
import { canUploadMore } from '@/lib/plans'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
        const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
        if (user) {
          const [sub, count] = await Promise.all([
            getSubscription(user.id),
            getArtworkCount(user.id),
          ])
          const plan = sub?.plan ?? 'preserve'
          if (!canUploadMore(plan, count)) {
            return NextResponse.json(
              { error: 'PLAN_LIMIT', message: 'You have reached the 50-work limit for the Preserve plan. Upgrade to continue.' },
              { status: 403 },
            )
          }
        }
      }
    }

    const { imageData } = await req.json()

    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 })
    }

    // Strip the data URL prefix to get raw base64
    const base64 = imageData.replace(/^data:image\/(jpeg|jpg|png|gif|webp);base64,/, '')
    const mediaTypeMatch = imageData.match(/^data:(image\/[a-z]+);base64,/)
    const mediaType = (mediaTypeMatch ? mediaTypeMatch[1] : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are an expert art cataloguer. Analyze this artwork and return a JSON object with the following fields:
{
  "style": "The artistic style (e.g. Impressionism, Realism, Abstract Expressionism, Contemporary Realism, etc.)",
  "medium": "The likely medium (e.g. Oil on canvas, Watercolor, Acrylic, Mixed media, etc.)",
  "subject": "Brief description of the subject matter (e.g. Landscape, Portrait, Still life, Abstract composition, etc.)",
  "description": "A single clear, straightforward sentence describing the work — keep it simple and factual, focusing on what is depicted and the overall mood without being dramatic or poetic.",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "suggestedTitle": "A poetic, concise suggested title for this work (2-5 words)",
  "tags": [
    "REQUIRED — exactly one medium tag: e.g. medium:oil on canvas, medium:watercolour, medium:35mm film, medium:digital photography, medium:acrylic, medium:pencil, medium:charcoal",
    "OPTIONAL subject (1-2): subject:portrait, subject:landscape, subject:still life, subject:abstract, subject:figure, subject:cityscape, subject:seascape, subject:interior",
    "OPTIONAL content (1-5 visible elements): content:woman, content:tree, content:mountain, content:flowers, content:ocean, content:building, content:crowd, content:animal",
    "OPTIONAL mood (1-2): mood:serene, mood:melancholic, mood:joyful, mood:dramatic, mood:intimate, mood:mysterious, mood:raw, mood:contemplative",
    "OPTIONAL style tags (1-3): style:impressionist, style:expressionist, style:realist, style:gestural, style:minimalist, style:painterly, style:abstract, style:figurative",
    "OPTIONAL colour (1-2): colour:warm, colour:cool, colour:muted, colour:high contrast, colour:monochromatic, colour:dark, colour:light, colour:black and white"
  ]
}

For the tags array, output only the actual tag strings (e.g. ["medium:oil on canvas", "subject:landscape", "mood:serene"]), not the descriptions above.
Return ONLY the JSON object, no other text.`,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Parse the JSON response
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const analysis = JSON.parse(cleaned)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze artwork' },
      { status: 500 }
    )
  }
}
