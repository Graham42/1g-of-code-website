import { defineCollection, z } from 'astro:content'

const episodes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).default([]),
    twitchUrl: z.string(),
    twitchThumbnail: z.string(),
    youtubeUrl: z.string().optional(),
  }),
})

export const collections = {
  episodes,
}
