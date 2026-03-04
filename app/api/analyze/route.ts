import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
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
      max_tokens: 1024,
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
              text: `You are an expert art cataloguer. Analyze this painting or artwork and return a JSON object with the following fields:
{
  "style": "The artistic style (e.g. Impressionism, Realism, Abstract Expressionism, Contemporary Realism, etc.)",
  "medium": "The likely medium (e.g. Oil on canvas, Watercolor, Acrylic, Mixed media, etc.)",
  "subject": "Brief description of the subject matter (e.g. Landscape, Portrait, Still life, Abstract composition, etc.)",
  "description": "A single evocative sentence describing the work as an art curator would — focus on mood, composition, and visual impact.",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "suggestedTitle": "A poetic, concise suggested title for this work (2-5 words)"
}

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
